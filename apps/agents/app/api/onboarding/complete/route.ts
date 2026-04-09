import { NextResponse } from "next/server"

import {
  ConsumerAgentSettingsError,
  upsertConsumerAgentSetting,
} from "@/app/agents/data/consumer-agent-settings.server"
import {
  applyOnboardingWorkspaceFlavor,
  OnboardingProvisioningError,
  persistConsumerAgentOnboardingProfile,
  type CompleteOnboardingInput,
} from "@/app/agents/data/onboarding-provisioning.server"
import { listOpenClawAgents } from "@/app/agents/data/openclaw-agents.server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type CompleteOnboardingRequest = {
  agentId?: string
  userName?: string | null
  agentName?: string | null
  agentDescription?: string | null
  knowledgeSources?: unknown
  channels?: unknown
}

type JsonKnowledgeSource =
  | { type: "url"; value: string }
  | { type: "file"; name: string; size: number }

function normalizeAgentId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64)
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseKnowledgeSources(value: unknown): JsonKnowledgeSource[] {
  if (!Array.isArray(value)) return []

  const next: JsonKnowledgeSource[] = []

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue

    const source = entry as Record<string, unknown>
    if (source.type === "url") {
      const url = typeof source.value === "string" ? source.value.trim() : ""
      if (!url) continue
      next.push({ type: "url", value: url })
      continue
    }

    if (source.type === "file") {
      const name = typeof source.name === "string" ? source.name.trim() : ""
      if (!name) continue
      const rawSize = typeof source.size === "number" ? source.size : 0
      const size = Number.isFinite(rawSize) ? Math.max(0, rawSize) : 0
      next.push({ type: "file", name, size })
      continue
    }
  }

  return next
}

function parseChannels(value: unknown): Array<"whatsapp" | "telegram"> {
  if (!Array.isArray(value)) return []

  const valid = value.filter((entry): entry is "whatsapp" | "telegram" => {
    return entry === "whatsapp" || entry === "telegram"
  })

  return Array.from(new Set(valid))
}

function buildOnboardingInput(input: CompleteOnboardingRequest): CompleteOnboardingInput {
  return {
    userName: normalizeOptionalText(input.userName),
    agentName: normalizeOptionalText(input.agentName),
    agentDescription: normalizeOptionalText(input.agentDescription),
    knowledgeSources: parseKnowledgeSources(input.knowledgeSources),
    channels: parseChannels(input.channels),
  }
}

function toErrorResponse(error: unknown) {
  if (error instanceof ConsumerAgentSettingsError || error instanceof OnboardingProvisioningError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }

  return NextResponse.json(
    { error: "Unexpected server error while completing onboarding." },
    { status: 500 },
  )
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedRequestContext()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let input: CompleteOnboardingRequest

  try {
    input = (await request.json()) as CompleteOnboardingRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const agentId = normalizeAgentId(input.agentId ?? "")
  if (!agentId) {
    return NextResponse.json({ error: "Invalid agent id." }, { status: 400 })
  }

  const onboardingInput = buildOnboardingInput(input)

  try {
    const runtimeAgentsPayload = await listOpenClawAgents()
    const runtimeAgent = runtimeAgentsPayload.agents.find((agent) => agent.id === agentId)

    if (!runtimeAgent) {
      return NextResponse.json({ error: "Selected agent is not available in runtime catalog." }, { status: 404 })
    }

    const setting = await upsertConsumerAgentSetting({
      supabase: auth.supabase,
      userId: auth.userId,
      userEmail: auth.userEmail,
      userMetadata: auth.userMetadata,
      input: {
        agentId,
        isActive: true,
      },
    })

    await persistConsumerAgentOnboardingProfile({
      supabase: auth.supabase,
      userId: auth.userId,
      agentId,
      input: onboardingInput,
    })

    if (!setting.setting.workspacePath) {
      return NextResponse.json(
        { error: "Agent workspace could not be resolved after activation." },
        { status: 409 },
      )
    }

    await applyOnboardingWorkspaceFlavor({
      agentId,
      runtimeAgentName: runtimeAgent.name,
      runtimeWorkspacePath: runtimeAgent.workspace,
      workspacePath: setting.setting.workspacePath,
      input: onboardingInput,
    })

    const { error } = await auth.supabase
      .from("profiles")
      .update({ is_onboarded: true })
      .eq("id", auth.userId)

    if (error) {
      return NextResponse.json(
        { error: `Failed to update onboarding status: ${error.message}` },
        { status: 500 },
      )
    }

    return NextResponse.json({
      complete: true,
      setting: setting.setting,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

async function getAuthenticatedRequestContext() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  return {
    supabase,
    userId: user.id,
    userEmail: user.email ?? null,
    userMetadata:
      user.user_metadata && typeof user.user_metadata === "object"
        ? (user.user_metadata as Record<string, unknown>)
        : null,
  }
}
