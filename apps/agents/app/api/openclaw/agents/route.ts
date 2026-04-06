import { NextResponse } from "next/server"

import { OpenClawAgentsError, listOpenClawAgents } from "@/app/agents/data/openclaw-agents.server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function toErrorResponse(error: unknown) {
  if (error instanceof OpenClawAgentsError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }

  return NextResponse.json({ error: "Unexpected server error while loading OpenClaw agents." }, { status: 500 })
}

export async function GET() {
  const authError = await ensureAuthenticated()
  if (authError) return authError

  try {
    const payload = await listOpenClawAgents()
    return NextResponse.json(payload)
  } catch (error) {
    return toErrorResponse(error)
  }
}

async function ensureAuthenticated(): Promise<NextResponse | null> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}
