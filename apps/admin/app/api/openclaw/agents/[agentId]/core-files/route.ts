import { NextResponse } from "next/server"

import { getOpenClawAgentCoreFiles } from "@/app/agents/data/openclaw-agent-core-files.server"
import { OpenClawAgentsError } from "@/app/agents/data/openclaw-agents.server"
import { isAdminUser } from "@/lib/auth/profiles"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function toErrorResponse(error: unknown) {
  if (error instanceof OpenClawAgentsError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }

  if (error instanceof Error && error.message.trim()) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ error: "Unexpected server error while loading agent core files." }, { status: 500 })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ agentId: string }> },
) {
  const authError = await ensureAdmin()
  if (authError) return authError

  const params = await context.params
  const rawAgentId = typeof params.agentId === "string" ? params.agentId : ""

  try {
    const payload = await getOpenClawAgentCoreFiles(rawAgentId)
    return NextResponse.json(payload)
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
