import { NextResponse } from "next/server"

import type {
  DisconnectConsumerAgentWhatsAppRequest,
  StartConsumerAgentWhatsAppLoginRequest,
  WaitConsumerAgentWhatsAppLoginRequest,
} from "@/app/agents/data/contracts"
import {
  ConsumerAgentWhatsAppError,
  disconnectConsumerAgentWhatsApp,
  startConsumerAgentWhatsAppLogin,
  waitConsumerAgentWhatsAppLogin,
} from "@/app/agents/data/consumer-agent-whatsapp.server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

function toErrorResponse(error: unknown) {
  if (error instanceof ConsumerAgentWhatsAppError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }

  if (error instanceof Error && error.message.trim()) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { error: "Unexpected server error while handling WhatsApp connection." },
    { status: 500 },
  )
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedRequestContext()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let input: StartConsumerAgentWhatsAppLoginRequest

  try {
    input = (await request.json()) as StartConsumerAgentWhatsAppLoginRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  try {
    const payload = await startConsumerAgentWhatsAppLogin({
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

export async function PUT(request: Request) {
  const auth = await getAuthenticatedRequestContext()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let input: WaitConsumerAgentWhatsAppLoginRequest

  try {
    input = (await request.json()) as WaitConsumerAgentWhatsAppLoginRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  try {
    const payload = await waitConsumerAgentWhatsAppLogin({
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

  let input: DisconnectConsumerAgentWhatsAppRequest

  try {
    input = (await request.json()) as DisconnectConsumerAgentWhatsAppRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  try {
    const payload = await disconnectConsumerAgentWhatsApp({
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
