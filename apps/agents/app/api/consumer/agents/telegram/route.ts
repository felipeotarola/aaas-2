import { NextResponse } from "next/server"

import type {
  ConnectConsumerAgentTelegramRequest,
  DisconnectConsumerAgentTelegramRequest,
} from "@/app/agents/data/contracts"
import {
  ConsumerAgentTelegramError,
  connectConsumerAgentTelegram,
  disconnectConsumerAgentTelegram,
} from "@/app/agents/data/consumer-agent-telegram.server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function toErrorResponse(error: unknown) {
  if (error instanceof ConsumerAgentTelegramError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }

  if (error instanceof Error && error.message.trim()) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { error: "Unexpected server error while handling Telegram connection." },
    { status: 500 },
  )
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedRequestContext()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let input: ConnectConsumerAgentTelegramRequest

  try {
    input = (await request.json()) as ConnectConsumerAgentTelegramRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  try {
    const payload = await connectConsumerAgentTelegram({
      supabase: auth.supabase,
      userId: auth.userId,
      userEmail: auth.userEmail,
      userMetadata: auth.userMetadata,
      input,
    })

    return NextResponse.json(payload)
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthenticatedRequestContext()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let input: DisconnectConsumerAgentTelegramRequest

  try {
    input = (await request.json()) as DisconnectConsumerAgentTelegramRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  try {
    const payload = await disconnectConsumerAgentTelegram({
      supabase: auth.supabase,
      userId: auth.userId,
      userEmail: auth.userEmail,
      userMetadata: auth.userMetadata,
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
    userEmail: user.email ?? null,
    userMetadata:
      user.user_metadata && typeof user.user_metadata === "object"
        ? (user.user_metadata as Record<string, unknown>)
        : null,
  }
}
