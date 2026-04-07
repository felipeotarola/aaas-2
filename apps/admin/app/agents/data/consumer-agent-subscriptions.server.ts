import "server-only"

import { createClient } from "@supabase/supabase-js"
import type { User } from "@supabase/supabase-js"

import type { ActiveConsumerAgentSubscription, CatalogAgent } from "./contracts"
import { getSupabaseUrl } from "@/lib/supabase/config"

type ConsumerAgentSettingRow = {
  user_id: string
  agent_id: string
  workspace_ref: string | null
  updated_at: string
}

type ProfileRow = {
  [key: string]: unknown
  id: string
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function toNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? ""
  const fromLocal = localPart
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

  return fromLocal || "User"
}

function normalizeUserName(profile: ProfileRow | null, fallbackEmail: string, fallbackUserId: string): string {
  const fullName = asNonEmptyString(profile?.full_name)
  if (fullName) return fullName

  const name = asNonEmptyString(profile?.name)
  if (name) return name

  const firstName = asNonEmptyString(profile?.first_name)
  const lastName = asNonEmptyString(profile?.last_name)
  if (firstName && lastName) return `${firstName} ${lastName}`
  if (firstName) return firstName
  if (lastName) return lastName

  if (fallbackEmail !== "no-email") {
    return toNameFromEmail(fallbackEmail)
  }

  return fallbackUserId.slice(0, 8)
}

function toAgentDisplayName(agentId: string): string {
  return agentId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY. Add it in apps/admin/.env.local to list active subscriptions.")
  }

  return createClient(getSupabaseUrl(), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function listUsersForIds(args: {
  adminClient: ReturnType<typeof createSupabaseAdminClient>
  usersById: Map<string, User>
  targetUserIds: Set<string>
}): Promise<void> {
  if (args.targetUserIds.size === 0) return

  let page = 1
  const perPage = 200

  while (args.usersById.size < args.targetUserIds.size) {
    const { data, error } = await args.adminClient.auth.admin.listUsers({ page, perPage })
    if (error) {
      throw new Error(`Failed to list users for subscriptions: ${error.message}`)
    }

    for (const user of data.users) {
      if (args.targetUserIds.has(user.id)) {
        args.usersById.set(user.id, user)
      }
    }

    const total = data.total ?? data.users.length
    if (page * perPage >= total || data.users.length < perPage) {
      break
    }

    page += 1
  }
}

export async function listActiveConsumerAgentSubscriptions(args: {
  catalogAgents: CatalogAgent[]
}): Promise<ActiveConsumerAgentSubscription[]> {
  const adminClient = createSupabaseAdminClient()

  const { data, error } = await adminClient
    .from("consumer_agent_settings")
    .select("user_id, agent_id, workspace_ref, updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to load active subscriptions: ${error.message}`)
  }

  const rows = (data ?? []) as ConsumerAgentSettingRow[]
  if (rows.length === 0) {
    return []
  }

  const targetUserIds = new Set(rows.map((row) => row.user_id))
  const usersById = new Map<string, User>()

  await listUsersForIds({ adminClient, usersById, targetUserIds })

  const userIdList = Array.from(targetUserIds)
  const profilesById = new Map<string, ProfileRow>()

  const { data: profiles, error: profilesError } = await adminClient.from("profiles").select("*").in("id", userIdList)
  if (profilesError) {
    throw new Error(`Failed to load profile metadata for subscriptions: ${profilesError.message}`)
  }

  for (const profile of profiles ?? []) {
    const row = profile as ProfileRow
    if (typeof row.id === "string") {
      profilesById.set(row.id, row)
    }
  }

  const agentNameById = new Map(args.catalogAgents.map((agent) => [agent.id, agent.name]))

  return rows.map((row) => {
    const user = usersById.get(row.user_id)
    const profile = profilesById.get(row.user_id) ?? null
    const userEmail = user?.email ?? "no-email"

    return {
      userId: row.user_id,
      userEmail,
      userName: normalizeUserName(profile, userEmail, row.user_id),
      agentId: row.agent_id,
      agentName: agentNameById.get(row.agent_id) ?? toAgentDisplayName(row.agent_id),
      workspaceRef: row.workspace_ref,
      updatedAt: row.updated_at,
    }
  })
}
