import "server-only"

import { constants as fsConstants } from "node:fs"
import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

const OPENCLAW_CONFIG_PATH_ENV = "OPENCLAW_CONFIG_PATH"
const OPENCLAW_HOME_ENV = "OPENCLAW_HOME"
const OPENCLAW_GATEWAY_URL_ENV = "OPENCLAW_GATEWAY_URL"
const OPENCLAW_GATEWAY_WS_URL_ENV = "OPENCLAW_GATEWAY_WS_URL"
const OPENCLAW_GATEWAY_HOST_ENV = "OPENCLAW_GATEWAY_HOST"
const OPENCLAW_GATEWAY_PORT_ENV = "OPENCLAW_GATEWAY_PORT"
const OPENCLAW_GATEWAY_TOKEN_ENV = "OPENCLAW_GATEWAY_TOKEN"
const OPENCLAW_GATEWAY_TIMEOUT_MS = 45_000

type OpenClawConfig = Record<string, unknown>

type GatewayResponse = {
  ok?: unknown
  payload?: unknown
  error?: unknown
}

export class OpenClawWhatsAppBridgeError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
  }
}

function normalizeText(raw: string | undefined | null): string {
  return raw?.trim() ?? ""
}

function normalizePathInput(raw: string | undefined): string {
  if (!raw) return ""
  return raw.trim().replace(/^['"]|['"]$/g, "")
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }

  return value
}

function parseOptionalInteger(raw: string | undefined): number | null {
  if (!raw) return null
  const numeric = Number.parseInt(raw, 10)
  if (!Number.isFinite(numeric)) return null
  return numeric
}

function normalizeAccountId(raw: string | undefined, fallback = "default"): string {
  const value = normalizeText(raw)
  if (!value) return fallback

  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 48)

  return normalized || fallback
}

function normalizeTimeoutMs(raw: number | undefined, fallback: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return fallback
  }

  return Math.min(Math.max(Math.floor(raw), 1_000), 180_000)
}

async function fileExists(candidatePath: string): Promise<boolean> {
  try {
    await access(candidatePath, fsConstants.R_OK)
    return true
  } catch {
    return false
  }
}

async function resolveOpenClawConfigPath(): Promise<string> {
  const explicitConfigPath = normalizePathInput(process.env[OPENCLAW_CONFIG_PATH_ENV])
  if (explicitConfigPath) {
    return explicitConfigPath
  }

  const explicitHome = normalizePathInput(process.env[OPENCLAW_HOME_ENV])
  if (explicitHome) {
    return path.join(explicitHome, "openclaw.json")
  }

  const runtimeHome = normalizePathInput(homedir())
  const candidates = [
    runtimeHome ? path.join(runtimeHome, ".openclaw", "openclaw.json") : "",
    "/home/node/.openclaw/openclaw.json",
    "/root/.openclaw/openclaw.json",
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate
    }
  }

  return candidates[0] ?? "/root/.openclaw/openclaw.json"
}

async function readOpenClawConfig(configPath: string): Promise<OpenClawConfig> {
  try {
    const raw = await readFile(configPath, "utf8")
    return asRecord(JSON.parse(raw))
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === "ENOENT") return {}

    if (error instanceof SyntaxError) {
      throw new OpenClawWhatsAppBridgeError(`OpenClaw config at ${configPath} contains invalid JSON.`, 500)
    }

    throw error
  }
}

async function writeOpenClawConfig(configPath: string, config: OpenClawConfig): Promise<void> {
  await mkdir(path.dirname(configPath), { recursive: true })
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")
}

function ensureGatewayWsPath(url: URL): URL {
  const trimmed = url.pathname.replace(/\/+$/, "")
  if (!trimmed || trimmed === "/") {
    url.pathname = "/ws"
    return url
  }

  if (!trimmed.endsWith("/ws")) {
    url.pathname = `${trimmed}/ws`
  }

  return url
}

function normalizeGatewayUrl(raw: string | undefined): string | null {
  const value = normalizePathInput(raw)
  if (!value) return null

  try {
    const parsed = new URL(value)
    if (parsed.protocol === "http:") parsed.protocol = "ws:"
    if (parsed.protocol === "https:") parsed.protocol = "wss:"
    if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") return null

    parsed.search = ""
    parsed.hash = ""
    return ensureGatewayWsPath(parsed).toString()
  } catch {
    return null
  }
}

function resolveGatewayWsCandidates(config: OpenClawConfig): string[] {
  const directWs = normalizeGatewayUrl(process.env[OPENCLAW_GATEWAY_WS_URL_ENV])
  const genericGateway = normalizeGatewayUrl(process.env[OPENCLAW_GATEWAY_URL_ENV])

  const gateway = asRecord(config.gateway)
  const configuredPort =
    parseOptionalInteger(process.env[OPENCLAW_GATEWAY_PORT_ENV]) ??
    asNumber(gateway.port) ??
    parseOptionalInteger(asString(gateway.port) ?? undefined) ??
    18789

  const configuredHost = normalizeText(process.env[OPENCLAW_GATEWAY_HOST_ENV]) || "127.0.0.1"
  const derivedGateway = normalizeGatewayUrl(`ws://${configuredHost}:${configuredPort}/ws`)

  return Array.from(new Set([directWs, genericGateway, derivedGateway].filter(Boolean) as string[]))
}

function resolveGatewayToken(config: OpenClawConfig): string {
  const explicitToken = normalizeText(process.env[OPENCLAW_GATEWAY_TOKEN_ENV])
  if (explicitToken) {
    return explicitToken
  }

  const gateway = asRecord(config.gateway)
  const auth = asRecord(gateway.auth)
  const token = asString(auth.token)
  if (token && token !== "__OPENCLAW_SECRET__") {
    return token
  }

  throw new OpenClawWhatsAppBridgeError(
    `Gateway auth token is missing. Set ${OPENCLAW_GATEWAY_TOKEN_ENV} or ensure openclaw config stores gateway.auth.token.`,
    500,
  )
}

async function callGatewayMethod(args: {
  method: string
  params: Record<string, unknown>
  timeoutMs?: number
}): Promise<unknown> {
  const configPath = await resolveOpenClawConfigPath()
  const config = await readOpenClawConfig(configPath)
  const gatewayToken = resolveGatewayToken(config)
  const gatewayUrls = resolveGatewayWsCandidates(config)

  if (gatewayUrls.length === 0) {
    throw new OpenClawWhatsAppBridgeError(
      `Unable to resolve gateway URL. Set ${OPENCLAW_GATEWAY_WS_URL_ENV} or ${OPENCLAW_GATEWAY_URL_ENV}.`,
      500,
    )
  }

  const failures: string[] = []

  for (const gatewayUrl of gatewayUrls) {
    try {
      return await callGatewayMethodAtUrl({
        url: gatewayUrl,
        token: gatewayToken,
        method: args.method,
        params: args.params,
        timeoutMs: args.timeoutMs,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown gateway RPC failure"
      failures.push(`${gatewayUrl}: ${message}`)
    }
  }

  throw new OpenClawWhatsAppBridgeError(
    `Gateway request ${args.method} failed (${failures.join(" | ")}).`,
    502,
  )
}

async function callGatewayMethodAtUrl(args: {
  url: string
  token: string
  method: string
  params: Record<string, unknown>
  timeoutMs?: number
}): Promise<unknown> {
  const timeoutMs = Math.max(args.timeoutMs ?? OPENCLAW_GATEWAY_TIMEOUT_MS, 1_000)
  const connectRequestId = `connect-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const methodRequestId = `rpc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  return await new Promise<unknown>((resolve, reject) => {
    let settled = false
    let connectSent = false
    let methodSent = false
    let challengeReceived = false

    const socket = new WebSocket(args.url)
    const finish = (value: unknown, isError: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutHandle)
      clearTimeout(challengeFallbackHandle)
      try {
        socket.close()
      } catch {
        // no-op
      }

      if (isError) {
        reject(value)
      } else {
        resolve(value)
      }
    }

    const sendConnect = () => {
      if (connectSent || socket.readyState !== WebSocket.OPEN) return
      connectSent = true
      socket.send(
        JSON.stringify({
          type: "req",
          id: connectRequestId,
          method: "connect",
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: "aaas-2-config-bridge",
              version: "0.0.1",
              platform: "server",
              mode: "operator",
            },
            role: "operator",
            scopes: ["operator.read", "operator.write"],
            auth: { token: args.token },
            locale: "en-US",
            userAgent: "aaas-2-config-bridge/0.0.1",
          },
        }),
      )
    }

    const sendMethod = () => {
      if (methodSent || socket.readyState !== WebSocket.OPEN) return
      methodSent = true
      socket.send(
        JSON.stringify({
          type: "req",
          id: methodRequestId,
          method: args.method,
          params: args.params,
        }),
      )
    }

    const timeoutHandle = setTimeout(() => {
      finish(new Error(`Gateway request timed out after ${timeoutMs}ms.`), true)
    }, timeoutMs)

    const challengeFallbackHandle = setTimeout(() => {
      if (!challengeReceived) {
        sendConnect()
      }
    }, 250)

    socket.addEventListener("open", () => {
      if (!challengeReceived) {
        sendConnect()
      }
    })

    socket.addEventListener("message", (event) => {
      let frame: Record<string, unknown>
      try {
        frame = asRecord(JSON.parse(String(event.data)))
      } catch {
        return
      }

      const frameType = asString(frame.type)
      if (frameType === "event" && asString(frame.event) === "connect.challenge") {
        challengeReceived = true
        sendConnect()
        return
      }

      if (frameType !== "res") {
        return
      }

      const frameId = asString(frame.id)
      const response = frame as GatewayResponse & { id?: unknown }

      if (frameId === connectRequestId) {
        if (response.ok !== true) {
          const errorText =
            asString(response.error) ??
            asString(asRecord(response.error).message) ??
            "gateway connect request failed"
          finish(new Error(errorText), true)
          return
        }

        sendMethod()
        return
      }

      if (frameId === methodRequestId) {
        if (response.ok === true) {
          finish(response.payload, false)
          return
        }

        const errorText =
          asString(response.error) ??
          asString(asRecord(response.error).message) ??
          `${args.method} failed`
        finish(new Error(errorText), true)
      }
    })

    socket.addEventListener("error", () => {
      finish(new Error("websocket error while calling gateway"), true)
    })

    socket.addEventListener("close", (event) => {
      if (!settled) {
        finish(
          new Error(`gateway websocket closed before response (code=${event.code}, reason=${event.reason || "n/a"})`),
          true,
        )
      }
    })
  })
}

export async function syncBridgeWhatsAppAccount(args: { accountId: string }): Promise<{ accountId: string }> {
  const accountId = normalizeAccountId(args.accountId)
  const configPath = await resolveOpenClawConfigPath()
  const config = await readOpenClawConfig(configPath)

  const channels = asRecord(config.channels)
  const whatsapp = asRecord(channels.whatsapp)
  const accounts = asRecord(whatsapp.accounts)
  const existingAccount = asRecord(accounts[accountId])

  const nextConfig: OpenClawConfig = {
    ...config,
    channels: {
      ...channels,
      whatsapp: {
        ...whatsapp,
        enabled: true,
        defaultAccount: asString(whatsapp.defaultAccount) ?? accountId,
        accounts: {
          ...accounts,
          [accountId]: {
            ...existingAccount,
            enabled: true,
          },
        },
      },
    },
  }

  await writeOpenClawConfig(configPath, nextConfig)
  return { accountId }
}

export async function bridgeStartWhatsAppLogin(args: {
  accountId: string
  timeoutMs?: number
  force?: boolean
}): Promise<{ connected: boolean; message: string; qrDataUrl: string | null }> {
  const payload = asRecord(
    await callGatewayMethod({
      method: "web.login.start",
      params: {
        accountId: normalizeAccountId(args.accountId),
        timeoutMs: normalizeTimeoutMs(args.timeoutMs, 35_000),
        force: Boolean(args.force),
      },
      timeoutMs: normalizeTimeoutMs(args.timeoutMs, OPENCLAW_GATEWAY_TIMEOUT_MS),
    }),
  )

  const qrDataUrl = asString(payload.qrDataUrl)
  const message = asString(payload.message) ?? (qrDataUrl ? "QR generated." : "WhatsApp login started.")
  const connected = payload.connected === true || (!qrDataUrl && message.toLowerCase().includes("already linked"))

  return {
    connected,
    message,
    qrDataUrl,
  }
}

export async function bridgeWaitWhatsAppLogin(args: {
  accountId: string
  timeoutMs?: number
}): Promise<{ connected: boolean; message: string }> {
  const payload = asRecord(
    await callGatewayMethod({
      method: "web.login.wait",
      params: {
        accountId: normalizeAccountId(args.accountId),
        timeoutMs: normalizeTimeoutMs(args.timeoutMs, 30_000),
      },
      timeoutMs: normalizeTimeoutMs(args.timeoutMs, OPENCLAW_GATEWAY_TIMEOUT_MS),
    }),
  )

  const connected = payload.connected === true
  const message = asString(payload.message) ?? (connected ? "WhatsApp linked." : "Waiting for QR scan.")

  return { connected, message }
}

export async function bridgeLogoutWhatsApp(args: { accountId: string }): Promise<{ cleared: boolean }> {
  const payload = asRecord(
    await callGatewayMethod({
      method: "channels.logout",
      params: {
        channel: "whatsapp",
        accountId: normalizeAccountId(args.accountId),
      },
    }),
  )

  return {
    cleared: payload.cleared !== false,
  }
}
