import { NextResponse } from "next/server"

import type { CreateOpenClawAgentRequest } from "@/app/agents/data/contracts"
import {
  listAgentCatalogMetadata,
  upsertAgentCatalogMetadata,
} from "@/app/agents/data/agent-catalog-metadata.server"
import { listActiveConsumerAgentSubscriptions } from "@/app/agents/data/consumer-agent-subscriptions.server"
import {
  OpenClawAgentsError,
  createOpenClawAgent,
  deleteOpenClawAgent,
  listOpenClawAgents,
} from "@/app/agents/data/openclaw-agents.server"
import { isAdminUser } from "@/lib/auth/profiles"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type AdminContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
  userId: string
}

type UpdateAgentMetadataRequest = {
  agentId?: string
  onboardingDescription?: string | null
  onboardingCapabilities?: unknown
}

function toErrorResponse(error: unknown) {
  if (error instanceof OpenClawAgentsError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }

  if (error instanceof Error && error.message.trim()) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ error: "Unexpected server error while handling OpenClaw agents." }, { status: 500 })
}

function normalizeCapabilities(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const normalized = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0)
    .slice(0, 8)

  return Array.from(new Set(normalized))
}

export async function GET() {
  const auth = await getAdminContext()
  if (auth instanceof NextResponse) return auth

  try {
    const payload = await listOpenClawAgents()
    let subscriptionsError: string | null = null
    let metadataError: string | null = null
    let activeSubscriptions = payload.activeSubscriptions ?? []
    let metadataByAgentId = new Map<
      string,
      { onboardingDescription: string | null; onboardingCapabilities: string[] }
    >()

    try {
      activeSubscriptions = await listActiveConsumerAgentSubscriptions({
        catalogAgents: payload.agents,
      })
    } catch (error) {
      subscriptionsError =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Failed to load active user subscriptions."
    }

    try {
      metadataByAgentId = await listAgentCatalogMetadata({
        supabase: auth.supabase,
        agentIds: payload.agents.map((agent) => agent.id),
      })
    } catch (error) {
      metadataError =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Failed to load agent onboarding metadata."
    }

    return NextResponse.json({
      ...payload,
      agents: payload.agents.map((agent) => {
        const metadata = metadataByAgentId.get(agent.id)
        return metadata
          ? {
              ...agent,
              onboardingDescription: metadata.onboardingDescription,
              onboardingCapabilities: metadata.onboardingCapabilities,
            }
          : agent
      }),
      activeSubscriptions,
      subscriptionsError,
      metadataError,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const auth = await getAdminContext()
  if (auth instanceof NextResponse) return auth

  let input: CreateOpenClawAgentRequest

  try {
    input = (await request.json()) as CreateOpenClawAgentRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  try {
    const agent = await createOpenClawAgent(input)
    let metadataWarning: string | null = null
    let nextAgent = agent

    try {
      const metadata = await upsertAgentCatalogMetadata({
        supabase: auth.supabase,
        agentId: agent.id,
        description: input.onboardingDescription,
        capabilities: input.onboardingCapabilities,
        updatedByUserId: auth.userId,
      })

      if (metadata) {
        nextAgent = {
          ...agent,
          onboardingDescription: metadata.onboardingDescription,
          onboardingCapabilities: metadata.onboardingCapabilities,
        }
      }
    } catch (error) {
      metadataWarning =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Agent was created, but onboarding metadata could not be saved."
    }

    return NextResponse.json({ agent: nextAgent, metadataWarning }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  const admin = await getAdminContext()
  if (admin instanceof NextResponse) return admin

  const url = new URL(request.url)
  const rawId = url.searchParams.get("id") ?? ""
  const agentId = rawId.trim()

  if (!agentId) {
    return NextResponse.json({ error: "Agent id is required." }, { status: 400 })
  }

  try {
    const deleted = await deleteOpenClawAgent(agentId)
    return NextResponse.json({ deleted })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  const auth = await getAdminContext()
  if (auth instanceof NextResponse) return auth

  let input: UpdateAgentMetadataRequest

  try {
    input = (await request.json()) as UpdateAgentMetadataRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const agentId = typeof input.agentId === "string" ? input.agentId.trim() : ""
  if (!agentId) {
    return NextResponse.json({ error: "Agent id is required." }, { status: 400 })
  }

  try {
    const payload = await listOpenClawAgents()
    const agent = payload.agents.find((candidate) => candidate.id === agentId)
    if (!agent) {
      return NextResponse.json({ error: `Agent '${agentId}' was not found.` }, { status: 404 })
    }

    const metadata = await upsertAgentCatalogMetadata({
      supabase: auth.supabase,
      agentId,
      description: input.onboardingDescription,
      capabilities: normalizeCapabilities(input.onboardingCapabilities),
      updatedByUserId: auth.userId,
      allowEmpty: true,
    })

    return NextResponse.json({
      agent: {
        ...agent,
        onboardingDescription: metadata?.onboardingDescription ?? null,
        onboardingCapabilities: metadata?.onboardingCapabilities ?? [],
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

async function getAdminContext(): Promise<AdminContext | NextResponse> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = await isAdminUser(supabase, user)
  if (!admin) {
    return NextResponse.json({ error: "Forbidden: admin access required." }, { status: 403 })
  }

  return {
    supabase,
    userId: user.id,
  }
}
