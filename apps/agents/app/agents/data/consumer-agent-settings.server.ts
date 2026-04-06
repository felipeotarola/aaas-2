import "server-only"

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

const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i

export class ConsumerAgentSettingsError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
  }
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
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toSetting(row: ConsumerAgentSettingRow): ConsumerAgentSetting {
  return {
    agentId: row.agent_id,
    isActive: row.is_active,
    toolOverrides: asPlainObject(row.tool_overrides),
    workspaceRef: normalizeWorkspaceRef(row.workspace_ref),
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
    settings: rows.map(toSetting),
  }
}

export async function upsertConsumerAgentSetting(args: {
  supabase: SupabaseClient
  userId: string
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

  const workspaceRef =
    args.input.workspaceRef === undefined
      ? normalizeWorkspaceRef(existing?.workspace_ref)
      : normalizeWorkspaceRef(args.input.workspaceRef)

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
    setting: toSetting(data),
  }
}
