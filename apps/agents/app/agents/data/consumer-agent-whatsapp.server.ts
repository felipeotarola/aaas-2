import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  ConsumerAgentSetting,
  ConsumerWhatsAppConnection,
  DisconnectConsumerAgentWhatsAppRequest,
  DisconnectConsumerAgentWhatsAppResponse,
  StartConsumerAgentWhatsAppLoginRequest,
  StartConsumerAgentWhatsAppLoginResponse,
  WaitConsumerAgentWhatsAppLoginRequest,
  WaitConsumerAgentWhatsAppLoginResponse,
} from "./contracts"
import { listConsumerAgentSettings, upsertConsumerAgentSetting } from "./consumer-agent-settings.server"
import {
  OpenClawWhatsAppSyncError,
  logoutWhatsAppChannelAccount,
  startWhatsAppWebLogin,
  syncWhatsAppChannelAccount,
  waitForWhatsAppWebLogin,
} from "./openclaw-whatsapp-sync.server"
import {
  OpenClawWhatsAppBridgeError,
  bindBridgeWhatsAppAccountToAgent,
  removeBridgeWhatsAppAccount,
} from "./openclaw-whatsapp-bridge.server"

type UserMetadata = Record<string, unknown> | null | undefined

const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i
const DEFAULT_WHATSAPP_ACCOUNT_PLACEHOLDER = "default"

export class ConsumerAgentWhatsAppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
  }
}

function normalizeText(raw: string | undefined | null): string {
  return raw?.trim() ?? ""
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value
  return fallback
}

function normalizeAgentId(raw: string | undefined): string {
  const value = normalizeText(raw).toLowerCase()
  if (!value) return ""

  const slug = value
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 64)

  return AGENT_ID_PATTERN.test(slug) ? slug : ""
}

function normalizeAccountId(raw: string | undefined, fallback = "default"): string {
  const value = normalizeText(raw)
  if (!value) return fallback

  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 48)

  return normalized || fallback
}

function buildScopedDefaultAccountId(agentId: string): string {
  return normalizeAccountId(`wa-${agentId}`, DEFAULT_WHATSAPP_ACCOUNT_PLACEHOLDER)
}

function resolveWhatsAppAccountId(args: {
  requestedAccountId: string | undefined
  previousConnection: ConsumerWhatsAppConnection | null
  agentId: string
}): string {
  const requestedAccountId = normalizeAccountId(args.requestedAccountId, "")
  if (requestedAccountId && requestedAccountId !== DEFAULT_WHATSAPP_ACCOUNT_PLACEHOLDER) {
    return requestedAccountId
  }

  const previousAccountId = normalizeAccountId(args.previousConnection?.accountId, "")
  if (previousAccountId && previousAccountId !== DEFAULT_WHATSAPP_ACCOUNT_PLACEHOLDER) {
    return previousAccountId
  }

  if (previousAccountId === DEFAULT_WHATSAPP_ACCOUNT_PLACEHOLDER && args.previousConnection?.connected) {
    return DEFAULT_WHATSAPP_ACCOUNT_PLACEHOLDER
  }

  return buildScopedDefaultAccountId(args.agentId)
}

function normalizeTimeoutMs(raw: number | undefined, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return fallback
  }

  return Math.min(Math.max(Math.floor(raw), 1_000), 180_000)
}

function parseWhatsAppConnection(setting: ConsumerAgentSetting): ConsumerWhatsAppConnection | null {
  const channels = asRecord(setting.toolOverrides.channels)
  const whatsapp = asRecord(channels.whatsapp)
  if (Object.keys(whatsapp).length === 0) {
    return null
  }

  return {
    connected: asBoolean(whatsapp.connected, false),
    accountId: asString(whatsapp.accountId) ?? "default",
    linkedIdentity: asString(whatsapp.linkedIdentity),
    lastLoginMessage: asString(whatsapp.lastLoginMessage),
    connectedAt: asString(whatsapp.connectedAt),
    disconnectedAt: asString(whatsapp.disconnectedAt),
    lastVerifiedAt: asString(whatsapp.lastVerifiedAt),
  }
}

function withWhatsAppConnection(
  setting: ConsumerAgentSetting,
  connection: ConsumerWhatsAppConnection,
): Record<string, unknown> {
  const channels = asRecord(setting.toolOverrides.channels)

  return {
    ...setting.toolOverrides,
    channels: {
      ...channels,
      whatsapp: connection,
    },
  }
}

function extractLinkedIdentity(message: string | null | undefined): string | null {
  const text = normalizeText(message)
  if (!text) return null

  const identityFromParens = text.match(/\(([^()]+)\)/)?.[1]
  if (identityFromParens?.trim()) {
    return identityFromParens.trim()
  }

  return null
}

function isTerminalDisconnectedMessage(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes("logged out") || normalized.includes("login failed") || normalized.includes("not linked")
}

async function persistWhatsAppConnection(args: {
  supabase: SupabaseClient
  userId: string
  userEmail?: string | null
  userMetadata?: UserMetadata
  setting: ConsumerAgentSetting
  agentId: string
  connection: ConsumerWhatsAppConnection
}) {
  await upsertConsumerAgentSetting({
    supabase: args.supabase,
    userId: args.userId,
    userEmail: args.userEmail,
    userMetadata: args.userMetadata,
    input: {
      agentId: args.agentId,
      isActive: true,
      workspaceRef: args.setting.workspaceRef,
      toolOverrides: withWhatsAppConnection(args.setting, args.connection),
    },
  })
}

async function disconnectOtherAgentWhatsAppConnectionsForAccount(args: {
  supabase: SupabaseClient
  userId: string
  userEmail?: string | null
  userMetadata?: UserMetadata
  accountId: string
  excludeAgentId: string
  reason: string
}) {
  const settingsPayload = await listConsumerAgentSettings({
    supabase: args.supabase,
    userId: args.userId,
  })

  const now = new Date().toISOString()
  for (const candidate of settingsPayload.settings) {
    if (!candidate.isActive || candidate.agentId === args.excludeAgentId) continue

    const existingConnection = parseWhatsAppConnection(candidate)
    if (!existingConnection?.connected) continue

    const candidateAccountId = normalizeAccountId(existingConnection.accountId, "")
    if (candidateAccountId !== args.accountId) continue

    const disconnectedConnection: ConsumerWhatsAppConnection = {
      connected: false,
      accountId: args.accountId,
      linkedIdentity: null,
      lastLoginMessage: args.reason,
      connectedAt: null,
      disconnectedAt: now,
      lastVerifiedAt: null,
    }

    await persistWhatsAppConnection({
      supabase: args.supabase,
      userId: args.userId,
      userEmail: args.userEmail,
      userMetadata: args.userMetadata,
      setting: candidate,
      agentId: candidate.agentId,
      connection: disconnectedConnection,
    })
  }
}

async function findActiveSetting(args: {
  supabase: SupabaseClient
  userId: string
  agentId: string
}): Promise<ConsumerAgentSetting> {
  const settingsPayload = await listConsumerAgentSettings({
    supabase: args.supabase,
    userId: args.userId,
  })

  const setting = settingsPayload.settings.find((item) => item.agentId === args.agentId && item.isActive)
  if (!setting) {
    throw new ConsumerAgentWhatsAppError("Agent is not active for this account.", 404)
  }

  return setting
}

export async function startConsumerAgentWhatsAppLogin(args: {
  supabase: SupabaseClient
  userId: string
  userEmail?: string | null
  userMetadata?: UserMetadata
  input: StartConsumerAgentWhatsAppLoginRequest
}): Promise<StartConsumerAgentWhatsAppLoginResponse> {
  const agentId = normalizeAgentId(args.input.agentId)
  if (!agentId) {
    throw new ConsumerAgentWhatsAppError("Invalid agent id.", 400)
  }

  const setting = await findActiveSetting({
    supabase: args.supabase,
    userId: args.userId,
    agentId,
  })

  const previousConnection = parseWhatsAppConnection(setting)
  const accountId = resolveWhatsAppAccountId({
    requestedAccountId: args.input.accountId,
    previousConnection,
    agentId,
  })
  const forceFreshLogin =
    args.input.force === true ||
    (previousConnection?.connected === false &&
      normalizeText(previousConnection.lastLoginMessage).toLowerCase().includes("disconnected"))

  let syncFailureMessage: string | null = null
  try {
    await syncWhatsAppChannelAccount({ accountId })
  } catch (error) {
    if (error instanceof OpenClawWhatsAppSyncError) {
      // Best effort: some deployments expose QR login via bridge APIs but do not
      // ship the local openclaw CLI binary on the web app host.
      syncFailureMessage = error.message
    } else {
      throw error
    }
  }

  let login
  try {
    login = await startWhatsAppWebLogin({
      accountId,
      timeoutMs: normalizeTimeoutMs(args.input.timeoutMs, 35_000),
      force: forceFreshLogin,
    })
  } catch (error) {
    if (error instanceof OpenClawWhatsAppSyncError) {
      if (syncFailureMessage) {
        throw new ConsumerAgentWhatsAppError(
          `${error.message} Account pre-sync also failed: ${syncFailureMessage}`,
          error.statusCode,
        )
      }

      throw new ConsumerAgentWhatsAppError(error.message, error.statusCode)
    }

    throw error
  }

  const now = new Date().toISOString()
  const linkedIdentity = extractLinkedIdentity(login.message) ?? previousConnection?.linkedIdentity ?? null

  const connection: ConsumerWhatsAppConnection = {
    connected: login.connected,
    accountId,
    linkedIdentity,
    lastLoginMessage: login.message,
    connectedAt: login.connected ? (previousConnection?.connectedAt ?? now) : previousConnection?.connectedAt ?? null,
    disconnectedAt:
      login.connected
        ? null
        : previousConnection?.disconnectedAt ?? (previousConnection?.connected ? now : null),
    lastVerifiedAt: login.connected ? now : previousConnection?.lastVerifiedAt ?? null,
  }

  if (connection.connected) {
    try {
      await bindBridgeWhatsAppAccountToAgent({ accountId, agentId })
    } catch (error) {
      if (error instanceof OpenClawWhatsAppBridgeError) {
        throw new ConsumerAgentWhatsAppError(`WhatsApp linked but route binding failed: ${error.message}`, error.statusCode)
      }
      const detail = error instanceof Error ? error.message : "unknown route-binding failure"
      throw new ConsumerAgentWhatsAppError(`WhatsApp linked but route binding failed: ${detail}`, 502)
    }
  }

  await persistWhatsAppConnection({
    supabase: args.supabase,
    userId: args.userId,
    userEmail: args.userEmail,
    userMetadata: args.userMetadata,
    setting,
    agentId,
    connection,
  })

  if (connection.connected) {
    await disconnectOtherAgentWhatsAppConnectionsForAccount({
      supabase: args.supabase,
      userId: args.userId,
      userEmail: args.userEmail,
      userMetadata: args.userMetadata,
      accountId,
      excludeAgentId: agentId,
      reason: `Disconnected because WhatsApp account "${accountId}" is now bound to "${agentId}".`,
    }).catch(() => {})
  }

  return {
    whatsapp: connection,
    login,
  }
}

export async function waitConsumerAgentWhatsAppLogin(args: {
  supabase: SupabaseClient
  userId: string
  userEmail?: string | null
  userMetadata?: UserMetadata
  input: WaitConsumerAgentWhatsAppLoginRequest
}): Promise<WaitConsumerAgentWhatsAppLoginResponse> {
  const agentId = normalizeAgentId(args.input.agentId)
  if (!agentId) {
    throw new ConsumerAgentWhatsAppError("Invalid agent id.", 400)
  }

  const setting = await findActiveSetting({
    supabase: args.supabase,
    userId: args.userId,
    agentId,
  })

  const previousConnection = parseWhatsAppConnection(setting)
  const accountId = resolveWhatsAppAccountId({
    requestedAccountId: args.input.accountId,
    previousConnection,
    agentId,
  })

  let login
  try {
    login = await waitForWhatsAppWebLogin({
      accountId,
      timeoutMs: normalizeTimeoutMs(args.input.timeoutMs, 25_000),
    })
  } catch (error) {
    if (error instanceof OpenClawWhatsAppSyncError) {
      throw new ConsumerAgentWhatsAppError(error.message, error.statusCode)
    }

    throw error
  }

  const now = new Date().toISOString()
  const terminalDisconnected = isTerminalDisconnectedMessage(login.message)
  const connected = login.connected || (previousConnection?.connected === true && !terminalDisconnected)

  const connection: ConsumerWhatsAppConnection = {
    connected,
    accountId,
    linkedIdentity: extractLinkedIdentity(login.message) ?? previousConnection?.linkedIdentity ?? null,
    lastLoginMessage: login.message,
    connectedAt: connected ? (previousConnection?.connectedAt ?? now) : previousConnection?.connectedAt ?? null,
    disconnectedAt: connected ? null : previousConnection?.disconnectedAt ?? (terminalDisconnected ? now : null),
    lastVerifiedAt: connected ? now : previousConnection?.lastVerifiedAt ?? null,
  }

  if (connection.connected) {
    try {
      await bindBridgeWhatsAppAccountToAgent({ accountId, agentId })
    } catch (error) {
      if (error instanceof OpenClawWhatsAppBridgeError) {
        throw new ConsumerAgentWhatsAppError(`WhatsApp linked but route binding failed: ${error.message}`, error.statusCode)
      }
      const detail = error instanceof Error ? error.message : "unknown route-binding failure"
      throw new ConsumerAgentWhatsAppError(`WhatsApp linked but route binding failed: ${detail}`, 502)
    }
  }

  await persistWhatsAppConnection({
    supabase: args.supabase,
    userId: args.userId,
    userEmail: args.userEmail,
    userMetadata: args.userMetadata,
    setting,
    agentId,
    connection,
  })

  if (connection.connected) {
    await disconnectOtherAgentWhatsAppConnectionsForAccount({
      supabase: args.supabase,
      userId: args.userId,
      userEmail: args.userEmail,
      userMetadata: args.userMetadata,
      accountId,
      excludeAgentId: agentId,
      reason: `Disconnected because WhatsApp account "${accountId}" is now bound to "${agentId}".`,
    }).catch(() => {})
  }

  return {
    whatsapp: connection,
    login,
  }
}

export async function disconnectConsumerAgentWhatsApp(args: {
  supabase: SupabaseClient
  userId: string
  userEmail?: string | null
  userMetadata?: UserMetadata
  input: DisconnectConsumerAgentWhatsAppRequest
}): Promise<DisconnectConsumerAgentWhatsAppResponse> {
  const agentId = normalizeAgentId(args.input.agentId)
  if (!agentId) {
    throw new ConsumerAgentWhatsAppError("Invalid agent id.", 400)
  }

  const setting = await findActiveSetting({
    supabase: args.supabase,
    userId: args.userId,
    agentId,
  })

  const previousConnection = parseWhatsAppConnection(setting)
  const accountId = resolveWhatsAppAccountId({
    requestedAccountId: args.input.accountId,
    previousConnection,
    agentId,
  })

  let disconnectFailureMessage: string | null = null
  let localCleanupApplied = false
  try {
    await logoutWhatsAppChannelAccount({ accountId })
  } catch (error) {
    if (error instanceof OpenClawWhatsAppSyncError || error instanceof OpenClawWhatsAppBridgeError) {
      disconnectFailureMessage = error.message
    } else if (error instanceof Error) {
      disconnectFailureMessage = error.message
    } else {
      disconnectFailureMessage = "unknown WhatsApp disconnect failure"
    }
  }

  if (disconnectFailureMessage) {
    await removeBridgeWhatsAppAccount({ accountId })
      .then((result) => {
        localCleanupApplied = result.removed
      })
      .catch(() => {})
  }

  const now = new Date().toISOString()
  const disconnectDetail = normalizeText(disconnectFailureMessage).slice(0, 320)
  const disconnectedMessage = disconnectDetail
    ? localCleanupApplied
      ? `Disconnected locally from WhatsApp. Remote logout failed: ${disconnectDetail}`
      : `Disconnected in AAAS-2, but remote logout could not be confirmed: ${disconnectDetail}`
    : "Disconnected from WhatsApp."

  const connection: ConsumerWhatsAppConnection = {
    connected: false,
    accountId,
    linkedIdentity: null,
    lastLoginMessage: disconnectedMessage,
    connectedAt: null,
    disconnectedAt: now,
    lastVerifiedAt: null,
  }

  await persistWhatsAppConnection({
    supabase: args.supabase,
    userId: args.userId,
    userEmail: args.userEmail,
    userMetadata: args.userMetadata,
    setting,
    agentId,
    connection,
  })

  await disconnectOtherAgentWhatsAppConnectionsForAccount({
    supabase: args.supabase,
    userId: args.userId,
    userEmail: args.userEmail,
    userMetadata: args.userMetadata,
    accountId,
    excludeAgentId: agentId,
    reason: `Disconnected because WhatsApp account "${accountId}" was disconnected.`,
  }).catch(() => {})

  return {
    whatsapp: connection,
  }
}
