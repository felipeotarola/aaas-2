import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import type {
  ChatStepId,
  OnboardingCollectedData,
  PersistedOnboardingProgress,
} from "../domain/types"

type JsonKnowledgeSource =
  | { type: "url"; value: string }
  | { type: "file"; name: string; size: number }

type OnboardingProgressRow = {
  agent_id: string
  user_name: string | null
  agent_name: string | null
  agent_description: string | null
  knowledge_sources: unknown
  channels: unknown
  onboarding_payload: unknown
  updated_at: string | null
}

const CHAT_STEPS: ChatStepId[] = [
  "greet",
  "ask-user-name",
  "ask-agent-name",
  "ask-agent-description",
  "ask-files",
  "ask-urls",
  "ask-channels",
  "connect-channels",
  "confirm",
  "done",
]

const IN_PROGRESS_STATUS = "in_progress"

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object"
}

function normalizeAgentId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64)
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeChatStep(value: unknown): ChatStepId | null {
  if (typeof value !== "string") return null
  return CHAT_STEPS.includes(value as ChatStepId) ? (value as ChatStepId) : null
}

function sanitizeChannels(value: unknown): Array<"whatsapp" | "telegram"> {
  if (!Array.isArray(value)) return []

  const valid = value.filter((entry): entry is "whatsapp" | "telegram" => {
    return entry === "whatsapp" || entry === "telegram"
  })

  return Array.from(new Set(valid))
}

function sanitizeKnowledgeSources(value: unknown): JsonKnowledgeSource[] {
  if (!Array.isArray(value)) return []

  const next: JsonKnowledgeSource[] = []

  for (const entry of value) {
    if (!isRecord(entry)) continue

    if (entry.type === "url") {
      const url = normalizeOptionalText(entry.value)
      if (!url) continue
      next.push({ type: "url", value: url })
      continue
    }

    if (entry.type === "file") {
      const name = normalizeOptionalText(entry.name)
      if (!name) continue
      const rawSize = typeof entry.size === "number" ? entry.size : 0
      const size = Number.isFinite(rawSize) ? Math.max(0, rawSize) : 0
      next.push({ type: "file", name, size })
    }
  }

  return next
}

function parsePersistedProgress(row: OnboardingProgressRow): PersistedOnboardingProgress | null {
  const payload = isRecord(row.onboarding_payload) ? row.onboarding_payload : null
  if (!payload || payload.status !== IN_PROGRESS_STATUS) {
    return null
  }

  const agentId = normalizeAgentId(row.agent_id)
  if (!agentId) {
    return null
  }

  const chatStep = normalizeChatStep(payload.chatStep)
  if (!chatStep || chatStep === "done") {
    return null
  }

  const draft = isRecord(payload.draft) ? payload.draft : null

  return {
    agentId,
    chatStep,
    collected: {
      userName: normalizeOptionalText(draft?.userName) ?? normalizeOptionalText(row.user_name),
      agentName: normalizeOptionalText(draft?.agentName) ?? normalizeOptionalText(row.agent_name),
      agentDescription: normalizeOptionalText(draft?.agentDescription) ?? normalizeOptionalText(row.agent_description),
      knowledgeSources: sanitizeKnowledgeSources(draft?.knowledgeSources ?? row.knowledge_sources),
      channels: sanitizeChannels(draft?.channels ?? row.channels),
    },
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  }
}

async function getAuthenticatedUserId(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user?.id ?? null
}

export async function fetchOnboardingStatus(): Promise<{
  isOnboarded: boolean
  isAdmin: boolean
}> {
  const supabase = createSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { isOnboarded: false, isAdmin: false }
  }

  const { data } = await supabase
    .from("profiles")
    .select("is_onboarded, is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_onboarded: boolean; is_admin: boolean }>()

  return {
    isOnboarded: data?.is_onboarded === true,
    isAdmin: data?.is_admin === true,
  }
}

export async function markOnboarded(): Promise<void> {
  const supabase = createSupabaseBrowserClient()
  const userId = await getAuthenticatedUserId(supabase)

  if (!userId) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("profiles")
    .update({ is_onboarded: true })
    .eq("id", userId)

  if (error) throw new Error(error.message)
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { error?: string } & T

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status})`)
  }

  return payload
}

export async function completeOnboarding(args: {
  agentId: string
  collected: OnboardingCollectedData
}): Promise<void> {
  const response = await fetch("/api/onboarding/complete", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      agentId: args.agentId,
      userName: args.collected.userName,
      agentName: args.collected.agentName,
      agentDescription: args.collected.agentDescription,
      knowledgeSources: args.collected.knowledgeSources,
      channels: args.collected.channels,
    }),
  })

  await parseResponse<{ complete: boolean }>(response)
}

export async function saveOnboardingProgress(args: {
  agentId: string
  chatStep: ChatStepId
  collected: OnboardingCollectedData
}): Promise<void> {
  const supabase = createSupabaseBrowserClient()
  const userId = await getAuthenticatedUserId(supabase)

  if (!userId) throw new Error("Not authenticated")

  const agentId = normalizeAgentId(args.agentId)
  const chatStep = normalizeChatStep(args.chatStep)

  if (!agentId || !chatStep || chatStep === "done") {
    return
  }

  const payload = {
    user_name: normalizeOptionalText(args.collected.userName),
    agent_name: normalizeOptionalText(args.collected.agentName),
    agent_description: normalizeOptionalText(args.collected.agentDescription),
    knowledge_sources: sanitizeKnowledgeSources(args.collected.knowledgeSources),
    channels: sanitizeChannels(args.collected.channels),
    onboarding_payload: {
      status: IN_PROGRESS_STATUS,
      chatStep,
      draft: {
        userName: normalizeOptionalText(args.collected.userName),
        agentName: normalizeOptionalText(args.collected.agentName),
        agentDescription: normalizeOptionalText(args.collected.agentDescription),
        knowledgeSources: sanitizeKnowledgeSources(args.collected.knowledgeSources),
        channels: sanitizeChannels(args.collected.channels),
      },
      capturedAt: new Date().toISOString(),
    },
  }

  const { error } = await supabase
    .from("consumer_agent_onboarding_profiles")
    .upsert(
      {
        user_id: userId,
        agent_id: agentId,
        ...payload,
      },
      { onConflict: "user_id,agent_id" },
    )

  if (error) {
    throw new Error(error.message)
  }
}

export async function fetchOnboardingProgressForAgent(agentId: string): Promise<PersistedOnboardingProgress | null> {
  const supabase = createSupabaseBrowserClient()
  const userId = await getAuthenticatedUserId(supabase)

  if (!userId) return null

  const normalizedAgentId = normalizeAgentId(agentId)
  if (!normalizedAgentId) return null

  const { data, error } = await supabase
    .from("consumer_agent_onboarding_profiles")
    .select("agent_id,user_name,agent_name,agent_description,knowledge_sources,channels,onboarding_payload,updated_at")
    .eq("user_id", userId)
    .eq("agent_id", normalizedAgentId)
    .maybeSingle<OnboardingProgressRow>()

  if (error) {
    console.error("Failed to fetch onboarding progress for agent", error)
    return null
  }

  if (!data) return null

  return parsePersistedProgress(data)
}

export async function fetchLatestOnboardingProgress(availableAgentIds: string[]): Promise<PersistedOnboardingProgress | null> {
  const supabase = createSupabaseBrowserClient()
  const userId = await getAuthenticatedUserId(supabase)

  if (!userId) return null

  const allowedAgentIds = new Set(
    availableAgentIds
      .map((entry) => normalizeAgentId(entry))
      .filter((entry) => entry.length > 0),
  )

  if (allowedAgentIds.size === 0) return null

  const { data, error } = await supabase
    .from("consumer_agent_onboarding_profiles")
    .select("agent_id,user_name,agent_name,agent_description,knowledge_sources,channels,onboarding_payload,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50)
    .returns<OnboardingProgressRow[]>()

  if (error) {
    console.error("Failed to fetch latest onboarding progress", error)
    return null
  }

  for (const row of data ?? []) {
    const parsed = parsePersistedProgress(row)
    if (!parsed) continue
    if (!allowedAgentIds.has(parsed.agentId)) continue
    return parsed
  }

  return null
}
