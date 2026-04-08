import { NextResponse } from "next/server"

import {
  OpenClawWhatsAppBridgeError,
  bridgeLogoutWhatsApp,
  bridgeStartWhatsAppLogin,
  bridgeWaitWhatsAppLogin,
  syncBridgeWhatsAppAccount,
} from "@/app/agents/data/openclaw-whatsapp-bridge.server"

const OPENCLAW_CONFIG_BRIDGE_TOKEN_ENV = "OPENCLAW_CONFIG_BRIDGE_TOKEN"
const OPENCLAW_AGENT_BRIDGE_TOKEN_ENV = "OPENCLAW_AGENT_BRIDGE_TOKEN"

type BasePayload = {
  accountId?: string
}

type StartPayload = BasePayload & {
  timeoutMs?: number
  force?: boolean
}

type WaitPayload = BasePayload & {
  timeoutMs?: number
}

function normalizeText(raw: string | undefined | null): string {
  return raw?.trim() ?? ""
}

function getConfiguredBridgeToken(): string {
  return (
    normalizeText(process.env[OPENCLAW_CONFIG_BRIDGE_TOKEN_ENV]) ||
    normalizeText(process.env[OPENCLAW_AGENT_BRIDGE_TOKEN_ENV])
  )
}

function getBearerToken(request: Request): string {
  const authHeader = request.headers.get("authorization") ?? ""
  const [scheme, token] = authHeader.split(/\s+/, 2)
  if (scheme?.toLowerCase() !== "bearer") {
    return ""
  }

  return normalizeText(token)
}

export function ensureBridgeAuthorized(request: Request): NextResponse | null {
  const expectedToken = getConfiguredBridgeToken()
  if (!expectedToken) {
    return null
  }

  const receivedToken = getBearerToken(request)
  if (!receivedToken || receivedToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized bridge token." }, { status: 401 })
  }

  return null
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof OpenClawWhatsAppBridgeError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode })
  }

  if (error instanceof Error && error.message.trim()) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ error: "Unexpected WhatsApp bridge error." }, { status: 500 })
}

async function parseRequestBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw new OpenClawWhatsAppBridgeError("Invalid JSON payload.", 400)
  }
}

export async function handleSyncWhatsAppAccount(request: Request): Promise<NextResponse> {
  const authError = ensureBridgeAuthorized(request)
  if (authError) return authError

  try {
    const input = await parseRequestBody<BasePayload>(request)
    const payload = await syncBridgeWhatsAppAccount({
      accountId: input.accountId ?? "default",
    })

    return NextResponse.json({
      ok: true,
      channel: "whatsapp",
      accountId: payload.accountId,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function handleStartWhatsAppLogin(request: Request): Promise<NextResponse> {
  const authError = ensureBridgeAuthorized(request)
  if (authError) return authError

  try {
    const input = await parseRequestBody<StartPayload>(request)
    const payload = await bridgeStartWhatsAppLogin({
      accountId: input.accountId ?? "default",
      timeoutMs: input.timeoutMs,
      force: input.force,
    })

    return NextResponse.json(payload)
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function handleWaitWhatsAppLogin(request: Request): Promise<NextResponse> {
  const authError = ensureBridgeAuthorized(request)
  if (authError) return authError

  try {
    const input = await parseRequestBody<WaitPayload>(request)
    const payload = await bridgeWaitWhatsAppLogin({
      accountId: input.accountId ?? "default",
      timeoutMs: input.timeoutMs,
    })

    return NextResponse.json(payload)
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function handleLogoutWhatsApp(request: Request): Promise<NextResponse> {
  const authError = ensureBridgeAuthorized(request)
  if (authError) return authError

  try {
    const input = await parseRequestBody<BasePayload>(request)
    const payload = await bridgeLogoutWhatsApp({
      accountId: input.accountId ?? "default",
    })

    return NextResponse.json(payload)
  } catch (error) {
    return toErrorResponse(error)
  }
}
