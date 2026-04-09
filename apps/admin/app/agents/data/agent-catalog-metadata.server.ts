import "server-only"

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

export type AgentCatalogMetadata = {
  onboardingDescription: string | null
  onboardingCapabilities: string[]
}

type AgentCatalogMetadataRow = {
  agent_id: string
  description: string | null
  capabilities: string[] | null
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeCapabilities(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) return []

  const next = values
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0)
    .slice(0, 8)

  return Array.from(new Set(next))
}

function toMetadataErrorMessage(error: PostgrestError): string {
  if (error.code === "42P01") {
    return "Missing agent_catalog_metadata table. Run latest Supabase migrations."
  }

  if (error.code === "PGRST204") {
    return "Missing agent_catalog_metadata columns in schema cache. Run latest Supabase migrations."
  }

  return error.message
}

export async function listAgentCatalogMetadata(args: {
  supabase: SupabaseClient
  agentIds: string[]
}): Promise<Map<string, AgentCatalogMetadata>> {
  if (args.agentIds.length === 0) return new Map()

  const { data, error } = await args.supabase
    .from("agent_catalog_metadata")
    .select("agent_id, description, capabilities")
    .in("agent_id", args.agentIds)
    .returns<AgentCatalogMetadataRow[]>()

  if (error) {
    throw new Error(toMetadataErrorMessage(error))
  }

  const map = new Map<string, AgentCatalogMetadata>()

  for (const row of data ?? []) {
    const agentId = typeof row.agent_id === "string" ? row.agent_id.trim() : ""
    if (!agentId) continue

    map.set(agentId, {
      onboardingDescription: normalizeText(row.description),
      onboardingCapabilities: normalizeCapabilities(row.capabilities),
    })
  }

  return map
}

export async function upsertAgentCatalogMetadata(args: {
  supabase: SupabaseClient
  agentId: string
  description?: string | null
  capabilities?: string[] | null
  updatedByUserId?: string | null
  allowEmpty?: boolean
}): Promise<AgentCatalogMetadata | null> {
  const description = normalizeText(args.description)
  const capabilities = normalizeCapabilities(args.capabilities)
  const agentId = args.agentId.trim()

  if (!agentId) return null
  if (!args.allowEmpty && !description && capabilities.length === 0) return null

  const { error } = await args.supabase
    .from("agent_catalog_metadata")
    .upsert(
      {
        agent_id: agentId,
        description,
        capabilities,
        updated_by_user_id: args.updatedByUserId ?? null,
      },
      { onConflict: "agent_id" },
    )

  if (error) {
    throw new Error(toMetadataErrorMessage(error))
  }

  return {
    onboardingDescription: description,
    onboardingCapabilities: capabilities,
  }
}
