import { NextResponse } from "next/server"

import type { UpsertConsumerAgentSettingRequest } from "@/app/agents/data/contracts"
import {
  ConsumerAgentSettingsError,
  listConsumerAgentSettings,
  upsertConsumerAgentSetting,
} from "@/app/agents/data/consumer-agent-settings.server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function toErrorResponse(error: unknown) {
  if (error instanceof ConsumerAgentSettingsError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }

  return NextResponse.json(
    { error: "Unexpected server error while handling consumer agent settings." },
    { status: 500 },
  )
}

export async function GET() {
  const auth = await getAuthenticatedRequestContext()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const payload = await listConsumerAgentSettings({
      supabase: auth.supabase,
      userId: auth.userId,
    })

    return NextResponse.json(payload)
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  const auth = await getAuthenticatedRequestContext()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let input: UpsertConsumerAgentSettingRequest

  try {
    input = (await request.json()) as UpsertConsumerAgentSettingRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  try {
    const payload = await upsertConsumerAgentSetting({
      supabase: auth.supabase,
      userId: auth.userId,
      input,
    })

    return NextResponse.json(payload)
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
