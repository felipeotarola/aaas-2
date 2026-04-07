import "server-only"

import { mkdir, readFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

import type {
  ConsumerAgentSetting,
  ListConsumerAgentSettingsResponse,
  UpsertConsumerAgentSettingRequest,
  UpsertConsumerAgentSettingResponse,
} from "./contracts"

type ConsumerAgentSettingRow = {
  agent_id: string
  is_active: boolean
  tool_overrides: Record<string, unknown> | null
  workspace_ref: string | null
  updated_at: string
}

export type WorkspaceResolution = {
  workspaceRoot: string
  workspaceRef: string
  workspacePath: string
}

type UserMetadata = Record<string, unknown> | null | undefined

type OpenClawConfig = {
  agents?: {
    defaults?: {
      workspace?: unknown
    }
  }
}

const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i

export class ConsumerAgentSettingsError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
  }
}

function normalizePathInput(raw: string | undefined): string {
  if (!raw) return ""
  return raw.trim().replace(/^['"]|['"]$/g, "")
}

function sanitizeWorkspacePart(raw: string): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")

  return normalized.slice(0, 96)
}

function normalizeAgentId(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return ""

  const slug = trimmed
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 64)

  return AGENT_ID_PATTERN.test(slug) ? slug : ""
}

function asPlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function normalizeWorkspaceRef(value: unknown): string | null {
  if (typeof value !== "string") return null

  const slug = sanitizeWorkspacePart(value)
  return slug.length > 0 ? slug : null
}

function getEmailLocalPart(email: string | null | undefined): string | null {
  if (!email) return null
  const [localPart] = email.split("@")
  if (!localPart) return null

  const normalized = sanitizeWorkspacePart(localPart)
  return normalized.length > 0 ? normalized : null
}

function getMetadataName(metadata: UserMetadata): string | null {
  if (!metadata || typeof metadata !== "object") return null

  const candidate = metadata.full_name ?? metadata.name
  if (typeof candidate !== "string") return null

  const normalized = sanitizeWorkspacePart(candidate)
  return normalized.length > 0 ? normalized : null
}

function buildWorkspaceRef(args: {
  userId: string
  userEmail?: string | null
  userMetadata?: UserMetadata
  agentId: string
}): string {
  const preferredUserSegment =
    getEmailLocalPart(args.userEmail) ?? getMetadataName(args.userMetadata) ?? "consumer"

  const userIdSegment = sanitizeWorkspacePart(args.userId).slice(0, 12)
  const agentSegment = sanitizeWorkspacePart(args.agentId)

  return `${preferredUserSegment}-${userIdSegment}-${agentSegment}`.slice(0, 96)
}

function getOpenClawHomeCandidates(): string[] {
  const explicitHome = normalizePathInput(process.env.OPENCLAW_HOME)
  const home = normalizePathInput(homedir())

  return Array.from(
    new Set(
      [
        explicitHome,
        explicitHome ? path.join(explicitHome, ".openclaw") : "",
        home,
        home ? path.join(home, ".openclaw") : "",
        "/home/node",
        "/home/node/.openclaw",
        "/root",
        "/root/.openclaw",
      ].filter(Boolean),
    ),
  )
}

function toOpenClawHome(candidate: string): string {
  return candidate.endsWith(`${path.sep}.openclaw`) ? candidate : path.join(candidate, ".openclaw")
}

async function resolveWorkspaceRootFromConfig(openClawHome: string): Promise<string | null> {
  const configPath = path.join(openClawHome, "openclaw.json")

  try {
    const raw = await readFile(configPath, "utf8")
    const parsed = JSON.parse(raw) as OpenClawConfig
    const workspace = parsed.agents?.defaults?.workspace

    if (typeof workspace === "string" && workspace.trim().length > 0) {
      return workspace.trim()
    }
  } catch {
    // Ignore missing/unreadable config and fall back
  }

  return null
}

async function resolveWorkspaceRoot(): Promise<string> {
  const candidates = getOpenClawHomeCandidates()

  for (const candidate of candidates) {
    const openClawHome = toOpenClawHome(candidate)
    const fromConfig = await resolveWorkspaceRootFromConfig(openClawHome)
    if (fromConfig) {
      return path.isAbsolute(fromConfig) ? fromConfig : path.join(openClawHome, fromConfig)
    }
  }

  const normalizedHome = normalizePathInput(homedir()) || "/home/node"
  return path.join(toOpenClawHome(normalizedHome), "workspace")
}

export async function resolveWorkspaceForRef(workspaceRef: string): Promise<WorkspaceResolution> {
  const workspaceRoot = await resolveWorkspaceRoot()

  return {
    workspaceRoot,
    workspaceRef,
    workspacePath: path.join(workspaceRoot, workspaceRef),
  }
}

async function ensureWorkspaceDirectory(workspaceRef: string): Promise<WorkspaceResolution> {
  const resolution = await resolveWorkspaceForRef(workspaceRef)
  await mkdir(resolution.workspacePath, { recursive: true })
  return resolution
}

async function toSetting(row: ConsumerAgentSettingRow): Promise<ConsumerAgentSetting> {
  const workspaceRef = normalizeWorkspaceRef(row.workspace_ref)
  const workspacePath = workspaceRef ? (await resolveWorkspaceForRef(workspaceRef)).workspacePath : null

  return {
    agentId: row.agent_id,
    isActive: row.is_active,
    toolOverrides: asPlainObject(row.tool_overrides),
    workspaceRef,
    workspacePath,
    updatedAt: row.updated_at,
  }
}

function toDataErrorMessage(error: PostgrestError): string {
  if (error.code === "42P01") {
    return "Missing consumer_agent_settings table. Run latest Supabase migrations."
  }

  if (error.code === "PGRST204") {
    return "Missing consumer_agent_settings columns in schema cache. Run latest Supabase migrations."
  }

  return error.message
}

export async function listConsumerAgentSettings(args: {
  supabase: SupabaseClient
  userId: string
}): Promise<ListConsumerAgentSettingsResponse> {
  const { data, error } = await args.supabase
    .from("consumer_agent_settings")
    .select("agent_id, is_active, tool_overrides, workspace_ref, updated_at")
    .eq("user_id", args.userId)
    .order("updated_at", { ascending: false })

  if (error) {
    throw new ConsumerAgentSettingsError(toDataErrorMessage(error), 500)
  }

  const rows = (data ?? []) as ConsumerAgentSettingRow[]

  return {
    settings: await Promise.all(rows.map((row) => toSetting(row))),
  }
}

export async function upsertConsumerAgentSetting(args: {
  supabase: SupabaseClient
  userId: string
  userEmail?: string | null
  userMetadata?: UserMetadata
  input: UpsertConsumerAgentSettingRequest
}): Promise<UpsertConsumerAgentSettingResponse> {
  const agentId = normalizeAgentId(args.input.agentId)

  if (!agentId) {
    throw new ConsumerAgentSettingsError(
      "Invalid agent id. Use letters, numbers, hyphen, or underscore (max 64 chars).",
      400,
    )
  }

  const existingResult = await args.supabase
    .from("consumer_agent_settings")
    .select("tool_overrides, workspace_ref")
    .eq("user_id", args.userId)
    .eq("agent_id", agentId)
    .maybeSingle<{ tool_overrides: Record<string, unknown> | null; workspace_ref: string | null }>()

  if (existingResult.error && existingResult.error.code !== "PGRST116") {
    throw new ConsumerAgentSettingsError(toDataErrorMessage(existingResult.error), 500)
  }

  const existing = existingResult.data

  const toolOverrides =
    args.input.toolOverrides === undefined
      ? asPlainObject(existing?.tool_overrides)
      : asPlainObject(args.input.toolOverrides)

  let workspaceRef =
    args.input.workspaceRef === undefined
      ? normalizeWorkspaceRef(existing?.workspace_ref)
      : normalizeWorkspaceRef(args.input.workspaceRef)

  if (!workspaceRef && args.input.isActive) {
    workspaceRef = buildWorkspaceRef({
      userId: args.userId,
      userEmail: args.userEmail,
      userMetadata: args.userMetadata,
      agentId,
    })
  }

  if (workspaceRef && args.input.isActive) {
    try {
      await ensureWorkspaceDirectory(workspaceRef)
    } catch (error) {
      const reason = error instanceof Error && error.message ? ` ${error.message}` : ""
      throw new ConsumerAgentSettingsError(
        `Failed to create consumer workspace directory for this agent.${reason}`,
        500,
      )
    }
  }

  const { data, error } = await args.supabase
    .from("consumer_agent_settings")
    .upsert(
      {
        user_id: args.userId,
        agent_id: agentId,
        is_active: args.input.isActive,
        tool_overrides: toolOverrides,
        workspace_ref: workspaceRef,
      },
      {
        onConflict: "user_id,agent_id",
      },
    )
    .select("agent_id, is_active, tool_overrides, workspace_ref, updated_at")
    .single<ConsumerAgentSettingRow>()

  if (error) {
    throw new ConsumerAgentSettingsError(toDataErrorMessage(error), 500)
  }

  return {
    setting: await toSetting(data),
  }
}
