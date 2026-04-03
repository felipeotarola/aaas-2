import { NextResponse } from "next/server"

import type { CreateOpenClawAgentRequest } from "@/app/agents/data/contracts"
import {
  OpenClawAgentsError,
  createOpenClawAgent,
  listOpenClawAgents,
} from "@/app/agents/data/openclaw-agents.server"
import { isAdminUser } from "@/lib/auth/profiles"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function toErrorResponse(error: unknown) {
  if (error instanceof OpenClawAgentsError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }

  return NextResponse.json({ error: "Unexpected server error while handling OpenClaw agents." }, { status: 500 })
}

export async function GET() {
  const authError = await ensureAdmin()
  if (authError) return authError

  try {
    const payload = await listOpenClawAgents()
    return NextResponse.json(payload)
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
