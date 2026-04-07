import { NextResponse } from "next/server"

import type { ChatWithConsumerAgentRequest } from "@/app/agents/data/contracts"
import { ConsumerAgentChatError, chatWithConsumerAgent } from "@/app/agents/data/consumer-agent-chat.server"
import { ConsumerAgentSettingsError, listConsumerAgentSettings } from "@/app/agents/data/consumer-agent-settings.server"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i
const MAX_CHAT_MESSAGE_LENGTH = 4_000

function normalizeAgentId(raw: string | undefined): string {
  const value = raw?.trim().toLowerCase() ?? ""
  if (!value) return ""
  const slug = value
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 64)
  return AGENT_ID_PATTERN.test(slug) ? slug : ""
}

function normalizeText(raw: string | undefined): string {
  return raw?.trim() ?? ""
}

function normalizeSessionId(raw: string | null | undefined): string | null {
  const value = normalizeText(raw ?? undefined)
  if (!value) return null
  return value.slice(0, 128)
}

function toErrorResponse(error: unknown) {
  if (error instanceof ConsumerAgentSettingsError || error instanceof ConsumerAgentChatError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }

  return NextResponse.json(
    { error: "Unexpected server error while preview-chatting with this agent." },
    { status: 500 },
  )
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedRequestContext()
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let input: ChatWithConsumerAgentRequest
  try {
    input = (await request.json()) as ChatWithConsumerAgentRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 })
  }

  const agentId = normalizeAgentId(input.agentId)
  if (!agentId) {
    return NextResponse.json({ error: "Invalid agent id." }, { status: 400 })
  }

  const message = normalizeText(input.message)
  if (!message) {
    return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 })
  }

  if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `Message is too long. Limit is ${MAX_CHAT_MESSAGE_LENGTH} characters.` },
      { status: 400 },
    )
  }

  try {
    const settings = await listConsumerAgentSettings({
      supabase: auth.supabase,
      userId: auth.userId,
    })

    const isActiveForUser = settings.settings.some((setting) => setting.agentId === agentId && setting.isActive)
    if (!isActiveForUser) {
      return NextResponse.json({ error: "Agent is not active for this account." }, { status: 404 })
    }

    const payload = await chatWithConsumerAgent({
      agentId,
      message,
      sessionId: normalizeSessionId(input.sessionId),
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
