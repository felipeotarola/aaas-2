import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  ConnectConsumerAgentTelegramRequest,
  ConnectConsumerAgentTelegramResponse,
  ConsumerAgentSetting,
  ConsumerTelegramConnection,
  DisconnectConsumerAgentTelegramRequest,
  DisconnectConsumerAgentTelegramResponse,
  TelegramDmPolicy,
} from "./contracts"
import { listConsumerAgentSettings, upsertConsumerAgentSetting } from "./consumer-agent-settings.server"
import { OpenClawChannelSyncError, syncTelegramChannelAccount } from "./openclaw-channel-sync.server"

type UserMetadata = Record<string, unknown> | null | undefined

type TelegramApiPayload = {
  ok?: unknown
  result?: unknown
  description?: unknown
}

const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i
const TELEGRAM_BOT_TOKEN_PATTERN = /^\d{6,}:[A-Za-z0-9_-]{20,}$/
const TELEGRAM_API_TIMEOUT_MS = 12_000
const TELEGRAM_DM_POLICIES: TelegramDmPolicy[] = ["pairing", "allowlist", "open", "disabled"]

export class ConsumerAgentTelegramError extends Error {
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

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }

  return value
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

function normalizeDmPolicy(raw: string | undefined, fallback: TelegramDmPolicy = "pairing"): TelegramDmPolicy {
  const candidate = normalizeText(raw).toLowerCase()
  if (TELEGRAM_DM_POLICIES.includes(candidate as TelegramDmPolicy)) {
    return candidate as TelegramDmPolicy
  }

  return fallback
}

function normalizeAllowFrom(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return []

  const normalized = values
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .map((value) => value.slice(0, 64))

  return Array.from(new Set(normalized)).slice(0, 64)
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

function normalizeWebhookUrl(raw: string | null | undefined): string | null {
  const value = normalizeText(raw)
  if (!value) return null

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new ConsumerAgentTelegramError("Webhook URL must be a valid absolute URL.", 400)
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ConsumerAgentTelegramError("Webhook URL must start with https:// or http://.", 400)
  }

  return parsed.toString()
}

function isValidBotToken(token: string): boolean {
  return TELEGRAM_BOT_TOKEN_PATTERN.test(token)
}

function maskTelegramBotToken(token: string): string {
  const [prefix = "", secret = ""] = token.split(":", 2)
  if (!prefix || !secret) return "configured"

  if (secret.length <= 8) {
    return `${prefix}:${secret}`
  }

  return `${prefix}:${secret.slice(0, 4)}…${secret.slice(-4)}`
}

function parseTelegramConnection(setting: ConsumerAgentSetting): ConsumerTelegramConnection | null {
  const channels = asRecord(setting.toolOverrides.channels)
  const telegram = asRecord(channels.telegram)
  if (Object.keys(telegram).length === 0) {
    return null
  }

  return {
    connected: asBoolean(telegram.connected, false),
    accountId: asString(telegram.accountId) ?? "default",
    botId: asNumber(telegram.botId),
    botUsername: asString(telegram.botUsername),
    botDisplayName: asString(telegram.botDisplayName),
    tokenHint: asString(telegram.tokenHint),
    webhookUrl: asString(telegram.webhookUrl),
    webhookConfigured: asBoolean(telegram.webhookConfigured, false),
    dmPolicy: normalizeDmPolicy(asString(telegram.dmPolicy) ?? undefined),
    allowFrom: normalizeAllowFrom(Array.isArray(telegram.allowFrom) ? (telegram.allowFrom as string[]) : undefined),
    requireMention: asBoolean(telegram.requireMention, true),
    connectedAt: asString(telegram.connectedAt),
    disconnectedAt: asString(telegram.disconnectedAt),
    lastVerifiedAt: asString(telegram.lastVerifiedAt),
  }
}

function withTelegramConnection(
  setting: ConsumerAgentSetting,
  connection: ConsumerTelegramConnection,
): Record<string, unknown> {
  const channels = asRecord(setting.toolOverrides.channels)

  return {
    ...setting.toolOverrides,
    channels: {
      ...channels,
      telegram: connection,
    },
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
    throw new ConsumerAgentTelegramError("Agent is not active for this account.", 404)
  }

  return setting
}

async function callTelegramApi(
  botToken: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(TELEGRAM_API_TIMEOUT_MS),
  })

  const payload = (await response.json().catch(() => null)) as TelegramApiPayload | null
  const description = asString(payload?.description)
  const ok = payload?.ok === true

  if (!response.ok || !ok) {
    if (response.status >= 400 && response.status < 500) {
      throw new ConsumerAgentTelegramError(description ?? "Telegram rejected the provided credentials.", 400)
    }

    throw new ConsumerAgentTelegramError(description ?? "Telegram API request failed.", 502)
  }

  return asRecord(payload?.result)
}

export async function connectConsumerAgentTelegram(args: {
  supabase: SupabaseClient
  userId: string
  userEmail?: string | null
  userMetadata?: UserMetadata
  input: ConnectConsumerAgentTelegramRequest
}): Promise<ConnectConsumerAgentTelegramResponse> {
  const agentId = normalizeAgentId(args.input.agentId)
  if (!agentId) {
    throw new ConsumerAgentTelegramError("Invalid agent id.", 400)
  }

  const botToken = normalizeText(args.input.botToken)
  if (!botToken || !isValidBotToken(botToken)) {
    throw new ConsumerAgentTelegramError("Invalid Telegram bot token format.", 400)
  }

  const setting = await findActiveSetting({
    supabase: args.supabase,
    userId: args.userId,
    agentId,
  })

  const previousConnection = parseTelegramConnection(setting)
  const accountId = normalizeAccountId(args.input.accountId, previousConnection?.accountId ?? "default")

  const botInfo = await callTelegramApi(botToken, "getMe")
  try {
    await syncTelegramChannelAccount({ accountId, botToken })
  } catch (error) {
    if (error instanceof OpenClawChannelSyncError) {
      throw new ConsumerAgentTelegramError(error.message, error.statusCode)
    }

    throw error
  }

  const webhookUrl = normalizeWebhookUrl(args.input.webhookUrl)
  if (webhookUrl) {
    await callTelegramApi(botToken, "setWebhook", { url: webhookUrl })
  }

  const now = new Date().toISOString()

  const connection: ConsumerTelegramConnection = {
    connected: true,
    accountId,
    botId: asNumber(botInfo.id),
    botUsername: asString(botInfo.username),
    botDisplayName: asString(botInfo.first_name),
    tokenHint: maskTelegramBotToken(botToken),
    webhookUrl,
    webhookConfigured: Boolean(webhookUrl),
    dmPolicy: normalizeDmPolicy(args.input.dmPolicy, previousConnection?.dmPolicy ?? "pairing"),
    allowFrom: normalizeAllowFrom(args.input.allowFrom),
    requireMention: typeof args.input.requireMention === "boolean" ? args.input.requireMention : true,
    connectedAt: previousConnection?.connectedAt ?? now,
    disconnectedAt: null,
    lastVerifiedAt: now,
  }

  await upsertConsumerAgentSetting({
    supabase: args.supabase,
    userId: args.userId,
    userEmail: args.userEmail,
    userMetadata: args.userMetadata,
    input: {
      agentId,
      isActive: true,
      workspaceRef: setting.workspaceRef,
      toolOverrides: withTelegramConnection(setting, connection),
    },
  })

  return { telegram: connection }
}

export async function disconnectConsumerAgentTelegram(args: {
  supabase: SupabaseClient
  userId: string
  userEmail?: string | null
  userMetadata?: UserMetadata
  input: DisconnectConsumerAgentTelegramRequest
}): Promise<DisconnectConsumerAgentTelegramResponse> {
  const agentId = normalizeAgentId(args.input.agentId)
  if (!agentId) {
    throw new ConsumerAgentTelegramError("Invalid agent id.", 400)
  }

  const setting = await findActiveSetting({
    supabase: args.supabase,
    userId: args.userId,
    agentId,
  })

  const previousConnection = parseTelegramConnection(setting)
  const now = new Date().toISOString()

  const connection: ConsumerTelegramConnection = {
    connected: false,
    accountId: previousConnection?.accountId ?? "default",
    botId: previousConnection?.botId ?? null,
    botUsername: previousConnection?.botUsername ?? null,
    botDisplayName: previousConnection?.botDisplayName ?? null,
    tokenHint: previousConnection?.tokenHint ?? null,
    webhookUrl: null,
    webhookConfigured: false,
    dmPolicy: previousConnection?.dmPolicy ?? "pairing",
    allowFrom: previousConnection?.allowFrom ?? [],
    requireMention: previousConnection?.requireMention ?? true,
    connectedAt: previousConnection?.connectedAt ?? null,
    disconnectedAt: now,
    lastVerifiedAt: previousConnection?.lastVerifiedAt ?? null,
  }

  await upsertConsumerAgentSetting({
    supabase: args.supabase,
    userId: args.userId,
    userEmail: args.userEmail,
    userMetadata: args.userMetadata,
    input: {
      agentId,
      isActive: true,
      workspaceRef: setting.workspaceRef,
      toolOverrides: withTelegramConnection(setting, connection),
    },
  })

  return { telegram: connection }
}
