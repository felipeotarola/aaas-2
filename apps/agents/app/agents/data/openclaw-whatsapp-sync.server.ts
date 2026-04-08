import "server-only"

import { execFile } from "node:child_process"
import { constants as fsConstants } from "node:fs"
import { access } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

const OPENCLAW_EXECUTABLE_ENV = "OPENCLAW_CLI_PATH"
const OPENCLAW_CONFIG_BRIDGE_TOKEN_ENV = "OPENCLAW_CONFIG_BRIDGE_TOKEN"
const OPENCLAW_AGENT_BRIDGE_TOKEN_ENV = "OPENCLAW_AGENT_BRIDGE_TOKEN"
const DEFAULT_OPENCLAW_CONFIG_BRIDGE_URL = "http://127.0.0.1:4311/api/openclaw/config"
const OPENCLAW_COMMAND_MAX_BUFFER_BYTES = 1 * 1024 * 1024
const OPENCLAW_COMMAND_TIMEOUT_MS = 45_000
const OPENCLAW_LOGIN_WAIT_TIMEOUT_MS = 140_000
const OPENCLAW_CONFIG_BRIDGE_TIMEOUT_MS = 3_000

type ExecCommandResult = {
  stdout: string
  stderr: string
}

type ExecCommandError = Error & {
  code?: string | number
  stdout?: string
  stderr?: string
}

type WhatsAppWebLoginPayload = {
  connected: boolean
  message: string
  qrDataUrl: string | null
}

export class OpenClawWhatsAppSyncError extends Error {
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

async function isExecutableFile(candidatePath: string): Promise<boolean> {
  try {
    await access(candidatePath, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

async function getOpenClawExecutableCandidates(): Promise<string[]> {
  const explicit = normalizePathInput(process.env[OPENCLAW_EXECUTABLE_ENV])
  const runtimeHome = normalizePathInput(homedir())
  const candidates = [
    explicit,
    runtimeHome ? path.join(runtimeHome, ".local", "bin", "openclaw") : "",
    runtimeHome ? path.join(runtimeHome, ".npm-global", "bin", "openclaw") : "",
    "/usr/local/bin/openclaw",
    "/usr/bin/openclaw",
    "/opt/homebrew/bin/openclaw",
    "/root/.local/bin/openclaw",
    "/home/node/.local/bin/openclaw",
    "openclaw",
  ].filter(Boolean)

  const usable: string[] = []

  for (const candidate of candidates) {
    const hasPathSeparator = candidate.includes(path.sep)
    if (!hasPathSeparator) {
      usable.push(candidate)
      continue
    }

    if (await isExecutableFile(candidate)) {
      usable.push(candidate)
    }
  }

  return Array.from(new Set(usable))
}

function runOpenClawCommand(
  command: string,
  args: string[],
  opts?: {
    timeoutMs?: number
  },
): Promise<ExecCommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        timeout: opts?.timeoutMs ?? OPENCLAW_COMMAND_TIMEOUT_MS,
        maxBuffer: OPENCLAW_COMMAND_MAX_BUFFER_BYTES,
      },
      (error, stdout, stderr) => {
        if (error) {
          const execError = error as ExecCommandError
          execError.stdout = stdout
          execError.stderr = stderr
          reject(execError)
          return
        }

        resolve({ stdout, stderr })
      },
    )
  })
}

function truncateErrorDetail(value: string, maxLength = 220): string {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1)}…`
}

function toExecErrorMessage(error: unknown): string {
  const execError = error as ExecCommandError

  const rawDetails =
    normalizeText(execError?.stderr) || normalizeText(execError?.stdout) || normalizeText(execError?.message)

  return rawDetails.replace(/\s+/g, " ").trim() || "unknown execution error"
}

function parseJsonOutput(stdout: string): Record<string, unknown> {
  const normalized = normalizeText(stdout)
  if (!normalized) {
    throw new Error("OpenClaw command returned an empty JSON payload.")
  }

  const parsed = JSON.parse(normalized) as unknown
  return asRecord(parsed)
}

function normalizeLoginMessage(payload: Record<string, unknown>, fallback: string): string {
  const raw = payload.message
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim()
  }

  return fallback
}

function deriveConfigBridgeUrlFromAgentBridge(raw: string | undefined): string {
  const normalized = normalizePathInput(raw)
  if (!normalized) return ""

  const untemplated = normalized.replace(/\{agentId\}/gi, "assistant-agent")

  try {
    const url = new URL(untemplated)
    url.pathname = "/api/openclaw/config"
    url.search = ""
    url.hash = ""
    return url.toString()
  } catch {
    return ""
  }
}

function shouldDisableBridgeFallback(): boolean {
  const raw = normalizePathInput(process.env.OPENCLAW_DISABLE_CONFIG_BRIDGE_FALLBACK).toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on"
}

function getOpenClawConfigBridgeCandidates(): string[] {
  const explicitBridgeUrl = normalizePathInput(process.env.OPENCLAW_CONFIG_BRIDGE_URL)
  const derivedBridgeUrl = deriveConfigBridgeUrlFromAgentBridge(process.env.OPENCLAW_AGENT_BRIDGE_URL)
  const candidates: string[] = []

  if (explicitBridgeUrl) candidates.push(explicitBridgeUrl)
  if (derivedBridgeUrl) candidates.push(derivedBridgeUrl)
  if (!explicitBridgeUrl && !shouldDisableBridgeFallback()) {
    candidates.push(DEFAULT_OPENCLAW_CONFIG_BRIDGE_URL)
  }

  return Array.from(new Set(candidates))
}

function buildBridgeEndpoints(bridgeUrl: string, suffixes: string[]): string[] {
  try {
    const url = new URL(bridgeUrl)
    const basePath = url.pathname.replace(/\/+$/, "") || "/"

    return suffixes.map((suffix) => {
      const endpoint = new URL(bridgeUrl)
      endpoint.pathname = `${basePath}${suffix}`
      endpoint.search = ""
      endpoint.hash = ""
      return endpoint.toString()
    })
  } catch {
    return []
  }
}

function getBridgeBearerToken(): string {
  return (
    normalizePathInput(process.env[OPENCLAW_CONFIG_BRIDGE_TOKEN_ENV]) ||
    normalizePathInput(process.env[OPENCLAW_AGENT_BRIDGE_TOKEN_ENV])
  )
}

function extractBridgeError(payload: unknown): string | null {
  const parsed = asRecord(payload)

  const direct =
    (typeof parsed.error === "string" ? normalizeText(parsed.error) : "") ||
    (typeof parsed.message === "string" ? normalizeText(parsed.message) : "")

  if (direct) return direct

  const nestedError = asRecord(parsed.error)
  const nestedMessage = typeof nestedError.message === "string" ? normalizeText(nestedError.message) : ""
  return nestedMessage || null
}

type BridgeAttemptResult = {
  payload: Record<string, unknown> | null
  failures: string[]
}

async function tryBridgeCall(args: {
  suffixes: string[]
  body: Record<string, unknown>
  timeoutMs?: number
}): Promise<BridgeAttemptResult> {
  const bridgeUrls = getOpenClawConfigBridgeCandidates()
  if (bridgeUrls.length === 0) {
    return { payload: null, failures: [] }
  }

  const failures: string[] = []
  const bearerToken = getBridgeBearerToken()

  for (const bridgeUrl of bridgeUrls) {
    const endpoints = buildBridgeEndpoints(bridgeUrl, args.suffixes)
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          cache: "no-store",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
          },
          body: JSON.stringify(args.body),
          signal: AbortSignal.timeout(args.timeoutMs ?? OPENCLAW_CONFIG_BRIDGE_TIMEOUT_MS),
        })

        const payload = (await response.json().catch(() => null)) as unknown
        if (response.ok) {
          return { payload: asRecord(payload), failures }
        }

        if (response.status === 404) {
          continue
        }

        const detail = extractBridgeError(payload) ?? `HTTP ${response.status}`
        failures.push(`${endpoint}: ${truncateErrorDetail(detail)}`)
      } catch (error) {
        const detail = error instanceof Error ? error.message : "unknown bridge request failure"
        failures.push(`${endpoint}: ${truncateErrorDetail(detail)}`)
      }
    }
  }

  return { payload: null, failures }
}

function ensureExecutableCandidates(candidates: string[]): void {
  if (candidates.length === 0) {
    throw new OpenClawWhatsAppSyncError(
      `OpenClaw CLI executable was not found. Set ${OPENCLAW_EXECUTABLE_ENV} to an absolute binary path.`,
      500,
    )
  }
}

export async function syncWhatsAppChannelAccount(args: { accountId: string }): Promise<void> {
  const bridgeAttempt = await tryBridgeCall({
    suffixes: ["/whatsapp/accounts", "/channels/whatsapp/accounts"],
    body: { accountId: args.accountId },
  })
  if (bridgeAttempt.payload) {
    return
  }

  const executableCandidates = await getOpenClawExecutableCandidates()
  ensureExecutableCandidates(executableCandidates)

  const failures: string[] = [...bridgeAttempt.failures]
  const commandArgs = ["channels", "add", "--channel", "whatsapp", "--account", args.accountId]

  for (const executable of executableCandidates) {
    try {
      await runOpenClawCommand(executable, commandArgs)
      return
    } catch (error) {
      failures.push(`${executable}: ${truncateErrorDetail(toExecErrorMessage(error))}`)
    }
  }

  throw new OpenClawWhatsAppSyncError(
    `Unable to sync WhatsApp channel account (${failures.join(" | ")}).`,
    502,
  )
}

export async function startWhatsAppWebLogin(args: {
  accountId: string
  timeoutMs?: number
  force?: boolean
}): Promise<WhatsAppWebLoginPayload> {
  const timeoutMs = Math.max(args.timeoutMs ?? OPENCLAW_COMMAND_TIMEOUT_MS, 1_000)
  const bridgeAttempt = await tryBridgeCall({
    suffixes: ["/whatsapp/login/start", "/channels/whatsapp/login/start"],
    body: {
      accountId: args.accountId,
      force: Boolean(args.force),
      timeoutMs,
    },
    timeoutMs: Math.max(timeoutMs, OPENCLAW_CONFIG_BRIDGE_TIMEOUT_MS),
  })
  if (bridgeAttempt.payload) {
    const qrDataUrl = typeof bridgeAttempt.payload.qrDataUrl === "string" ? bridgeAttempt.payload.qrDataUrl : null
    const message = normalizeLoginMessage(bridgeAttempt.payload, "WhatsApp login started.")
    const connected =
      bridgeAttempt.payload.connected === true || (!qrDataUrl && message.toLowerCase().includes("already linked"))
    return { connected, message, qrDataUrl }
  }

  const executableCandidates = await getOpenClawExecutableCandidates()
  ensureExecutableCandidates(executableCandidates)

  const failures: string[] = [...bridgeAttempt.failures]
  const commandArgs = [
    "gateway",
    "call",
    "web.login.start",
    "--params",
    JSON.stringify({
      accountId: args.accountId,
      force: Boolean(args.force),
      timeoutMs,
    }),
    "--timeout",
    String(Math.max(timeoutMs, OPENCLAW_COMMAND_TIMEOUT_MS)),
    "--json",
  ]

  for (const executable of executableCandidates) {
    try {
      const result = await runOpenClawCommand(executable, commandArgs)
      const payload = parseJsonOutput(result.stdout)
      const qrDataUrl = typeof payload.qrDataUrl === "string" ? payload.qrDataUrl : null
      const message = normalizeLoginMessage(payload, "WhatsApp login started.")
      const connected = !qrDataUrl && message.toLowerCase().includes("already linked")

      return {
        connected,
        message,
        qrDataUrl,
      }
    } catch (error) {
      failures.push(`${executable}: ${truncateErrorDetail(toExecErrorMessage(error))}`)
    }
  }

  throw new OpenClawWhatsAppSyncError(
    `Failed to start WhatsApp QR login (${failures.join(" | ")}). Make sure the OpenClaw gateway is running and reachable.`,
    502,
  )
}

export async function waitForWhatsAppWebLogin(args: {
  accountId: string
  timeoutMs?: number
}): Promise<WhatsAppWebLoginPayload> {
  const timeoutMs = Math.max(args.timeoutMs ?? 30_000, 1_000)
  const bridgeAttempt = await tryBridgeCall({
    suffixes: ["/whatsapp/login/wait", "/channels/whatsapp/login/wait"],
    body: {
      accountId: args.accountId,
      timeoutMs,
    },
    timeoutMs: Math.max(timeoutMs, OPENCLAW_CONFIG_BRIDGE_TIMEOUT_MS),
  })
  if (bridgeAttempt.payload) {
    const connected = bridgeAttempt.payload.connected === true
    const message = normalizeLoginMessage(bridgeAttempt.payload, connected ? "WhatsApp linked." : "Waiting for QR scan.")
    return { connected, message, qrDataUrl: null }
  }

  const executableCandidates = await getOpenClawExecutableCandidates()
  ensureExecutableCandidates(executableCandidates)

  const failures: string[] = [...bridgeAttempt.failures]
  const commandArgs = [
    "gateway",
    "call",
    "web.login.wait",
    "--params",
    JSON.stringify({
      accountId: args.accountId,
      timeoutMs,
    }),
    "--timeout",
    String(Math.max(timeoutMs, OPENCLAW_LOGIN_WAIT_TIMEOUT_MS)),
    "--json",
  ]

  for (const executable of executableCandidates) {
    try {
      const result = await runOpenClawCommand(executable, commandArgs, {
        timeoutMs: Math.max(timeoutMs, OPENCLAW_LOGIN_WAIT_TIMEOUT_MS),
      })
      const payload = parseJsonOutput(result.stdout)
      const connected = payload.connected === true
      const message = normalizeLoginMessage(payload, connected ? "WhatsApp linked." : "Waiting for QR scan.")

      return {
        connected,
        message,
        qrDataUrl: null,
      }
    } catch (error) {
      failures.push(`${executable}: ${truncateErrorDetail(toExecErrorMessage(error))}`)
    }
  }

  throw new OpenClawWhatsAppSyncError(
    `Failed to confirm WhatsApp login (${failures.join(" | ")}).`,
    502,
  )
}

export async function logoutWhatsAppChannelAccount(args: { accountId: string }): Promise<void> {
  const bridgeAttempt = await tryBridgeCall({
    suffixes: ["/whatsapp/logout", "/channels/whatsapp/logout"],
    body: { accountId: args.accountId },
  })
  if (bridgeAttempt.payload) {
    return
  }

  const executableCandidates = await getOpenClawExecutableCandidates()
  ensureExecutableCandidates(executableCandidates)

  const failures: string[] = [...bridgeAttempt.failures]
  const commandArgs = ["channels", "logout", "--channel", "whatsapp", "--account", args.accountId]

  for (const executable of executableCandidates) {
    try {
      await runOpenClawCommand(executable, commandArgs)
      return
    } catch (error) {
      failures.push(`${executable}: ${truncateErrorDetail(toExecErrorMessage(error))}`)
    }
  }

  throw new OpenClawWhatsAppSyncError(
    `Failed to disconnect WhatsApp account (${failures.join(" | ")}).`,
    502,
  )
}
