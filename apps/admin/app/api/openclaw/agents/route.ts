import { NextResponse } from "next/server"

import type { CreateOpenClawAgentRequest } from "@/app/agents/data/contracts"
import { listActiveConsumerAgentSubscriptions } from "@/app/agents/data/consumer-agent-subscriptions.server"
import {
  OpenClawAgentsError,
  createOpenClawAgent,
  deleteOpenClawAgent,
  listOpenClawAgents,
} from "@/app/agents/data/openclaw-agents.server"
import { isAdminUser } from "@/lib/auth/profiles"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function toErrorResponse(error: unknown) {
  if (error instanceof OpenClawAgentsError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }

  if (error instanceof Error && error.message.trim()) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ error: "Unexpected server error while handling OpenClaw agents." }, { status: 500 })
}

export async function GET() {
  const authError = await ensureAdmin()
  if (authError) return authError

  try {
    const payload = await listOpenClawAgents()
    let subscriptionsError: string | null = null
    let activeSubscriptions = payload.activeSubscriptions ?? []

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

    return NextResponse.json({
      ...payload,
      activeSubscriptions,
      subscriptionsError,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: Request) {
  const authError = await ensureAdmin()
  if (authError) return authError

  let input: CreateOpenClawAgentRequest

  try {
    input = (await request.json()) as CreateOpenClawAgentRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  try {
    const agent = await createOpenClawAgent(input)
    return NextResponse.json({ agent }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  const authError = await ensureAdmin()
  if (authError) return authError

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

async function ensureAdmin(): Promise<NextResponse | null> {
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

  return null
}
