import { NextResponse } from "next/server"

import {
  ConsumerAgentSettingsError,
  listConsumerAgentSettings,
  resolveWorkspaceForRef,
} from "@/app/agents/data/consumer-agent-settings.server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type LaunchConsumerAgentRequest = {
  agentId?: string
}

function normalizeAgentId(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64)
}

function toErrorResponse(error: unknown) {
  if (error instanceof ConsumerAgentSettingsError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }

  return NextResponse.json(
    { error: "Unexpected server error while launching consumer agent." },
    { status: 500 },
  )
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedRequestContext()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let input: LaunchConsumerAgentRequest

  try {
    input = (await request.json()) as LaunchConsumerAgentRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const agentId = normalizeAgentId(input.agentId ?? "")
  if (!agentId) {
    return NextResponse.json({ error: "Invalid agent id." }, { status: 400 })
  }

  try {
    const payload = await listConsumerAgentSettings({
      supabase: auth.supabase,
      userId: auth.userId,
    })

    const setting = payload.settings.find((item) => item.agentId === agentId && item.isActive)

    if (!setting) {
      return NextResponse.json({ error: "Agent is not active for this account." }, { status: 404 })
    }

    if (!setting.workspaceRef) {
      return NextResponse.json({ error: "Agent has no provisioned workspace." }, { status: 409 })
    }

    const workspace = await resolveWorkspaceForRef(setting.workspaceRef)

    return NextResponse.json({
      launch: {
        agentId,
        workspaceRef: setting.workspaceRef,
        workspacePath: workspace.workspacePath,
        status: "ready",
      },
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
  }
}
