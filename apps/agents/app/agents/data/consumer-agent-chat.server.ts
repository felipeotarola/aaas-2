import "server-only"

import { execFile } from "node:child_process"
import { constants as fsConstants } from "node:fs"
import { access } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

import type { ChatWithConsumerAgentResponse } from "./contracts"

const OPENCLAW_AGENT_TIMEOUT_MS = 90_000
const OPENCLAW_AGENT_MAX_BUFFER_BYTES = 2 * 1024 * 1024
const OPENCLAW_EXECUTABLE_ENV = "OPENCLAW_CLI_PATH"
const OPENCLAW_AGENT_BRIDGE_URL_ENV = "OPENCLAW_AGENT_BRIDGE_URL"
const OPENCLAW_AGENT_BRIDGE_TOKEN_ENV = "OPENCLAW_AGENT_BRIDGE_TOKEN"

type OpenClawPayload = {
  text?: unknown
}

type OpenClawAgentMeta = {
  sessionId?: unknown
  model?: unknown
  provider?: unknown
}

type OpenClawRunResult = {
  payloads?: unknown
  meta?: {
    agentMeta?: OpenClawAgentMeta
  }
}

type OpenClawRunResponse = {
  runId?: unknown
  status?: unknown
  summary?: unknown
  result?: OpenClawRunResult
  error?: unknown
}

type ExecCommandResult = {
  stdout: string
  stderr: string
}

type ExecCommandError = Error & {
  code?: string | number
  stdout?: string
  stderr?: string
}

export class ConsumerAgentChatError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
  }
}

function normalizePathInput(raw: string | undefined): string {
  if (!raw) return ""
  return raw.trim().replace(/^['"]|['"]$/g, "")
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
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

function normalizePayloadReply(payloads: unknown): string | null {
  if (!Array.isArray(payloads)) return null

  for (const payload of payloads as OpenClawPayload[]) {
    const text = asNonEmptyString(payload?.text)
    if (text) return text
  }

  return null
}

function parseOpenClawResponse(stdout: string): OpenClawRunResponse {
  try {
    return JSON.parse(stdout) as OpenClawRunResponse
  } catch {
    throw new ConsumerAgentChatError("OpenClaw preview runtime returned invalid JSON output.", 502)
  }
}

function toChatFromRun(run: OpenClawRunResponse, agentId: string): ChatWithConsumerAgentResponse {
  const status = asNonEmptyString(run.status)
  if (status && status !== "ok") {
    const errorText = asNonEmptyString(run.error) ?? asNonEmptyString(run.summary) ?? "Unknown runtime error."
    throw new ConsumerAgentChatError(`OpenClaw preview runtime reported an error: ${errorText}`, 502)
  }

  const reply = normalizePayloadReply(run.result?.payloads)
  if (!reply) {
    throw new ConsumerAgentChatError("OpenClaw preview runtime returned an empty response.", 502)
  }

  return {
    chat: {
      agentId,
      reply,
      sessionId: asNonEmptyString(run.result?.meta?.agentMeta?.sessionId),
      runId: asNonEmptyString(run.runId),
      model: asNonEmptyString(run.result?.meta?.agentMeta?.model),
      provider: asNonEmptyString(run.result?.meta?.agentMeta?.provider),
    },
  }
}

function runOpenClawAgentCommand(command: string, args: string[]): Promise<ExecCommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        timeout: OPENCLAW_AGENT_TIMEOUT_MS,
        maxBuffer: OPENCLAW_AGENT_MAX_BUFFER_BYTES,
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

function toExecErrorMessage(error: ExecCommandError): string {
  const stderr = asNonEmptyString(error.stderr)
  const stdout = asNonEmptyString(error.stdout)
  const details = stderr ?? stdout ?? asNonEmptyString(error.message)

  if (!details) {
    return "OpenClaw preview runtime failed to execute."
  }

  return `OpenClaw preview runtime failed: ${details}`
}

function deriveBridgeUrlFromConfigBridge(rawConfigBridgeUrl: string): string | null {
  try {
    const url = new URL(rawConfigBridgeUrl)
    if (url.pathname.endsWith("/api/openclaw/config")) {
      url.pathname = "/api/openclaw/assistant-chat"
      return url.toString()
    }
  } catch {
    // Ignore invalid URL and let callers rely on explicit bridge URL
  }

  return null
}

function getOpenClawBridgeUrlCandidates(agentId: string): string[] {
  const explicitBridgeUrl = normalizePathInput(process.env[OPENCLAW_AGENT_BRIDGE_URL_ENV])
  const configBridgeUrl = normalizePathInput(process.env.OPENCLAW_CONFIG_BRIDGE_URL)
  const derivedBridgeUrl = configBridgeUrl ? deriveBridgeUrlFromConfigBridge(configBridgeUrl) : null

  const rawCandidates = [explicitBridgeUrl, derivedBridgeUrl ?? ""].filter(Boolean)
  const expanded: string[] = []

  for (const rawCandidate of rawCandidates) {
    const trimmed = rawCandidate.replace(/\/+$/, "")
    if (!trimmed) continue

    if (trimmed.includes("{agentId}")) {
      expanded.push(trimmed.replaceAll("{agentId}", encodeURIComponent(agentId)))
      continue
    }

    const normalizedSuffix = `/${agentId.toLowerCase()}`
    if (trimmed.toLowerCase().endsWith(normalizedSuffix)) {
      expanded.push(trimmed)
    } else {
      expanded.push(`${trimmed}/${encodeURIComponent(agentId)}`)
      expanded.push(trimmed)
    }
  }

  return Array.from(new Set(expanded))
}

function extractBridgeError(payload: unknown): string | null {
  const parsed = asRecord(payload)
  const direct = asNonEmptyString(parsed.error) ?? asNonEmptyString(parsed.message)
  if (direct) return direct

  const nestedError = asRecord(parsed.error)
  return asNonEmptyString(nestedError.message)
}

function parseBridgePayload(payload: unknown, agentId: string): ChatWithConsumerAgentResponse {
  const parsed = asRecord(payload)

  const chat = asRecord(parsed.chat)
  const chatReply = asNonEmptyString(chat.reply)
  if (chatReply) {
    return {
      chat: {
        agentId: asNonEmptyString(chat.agentId) ?? agentId,
        reply: chatReply,
        sessionId: asNonEmptyString(chat.sessionId),
        runId: asNonEmptyString(chat.runId),
        model: asNonEmptyString(chat.model),
        provider: asNonEmptyString(chat.provider),
      },
    }
  }

  const directReply = asNonEmptyString(parsed.reply) ?? asNonEmptyString(parsed.text)
  if (directReply) {
    return {
      chat: {
        agentId,
        reply: directReply,
        sessionId: asNonEmptyString(parsed.sessionId),
        runId: asNonEmptyString(parsed.runId),
        model: asNonEmptyString(parsed.model),
        provider: asNonEmptyString(parsed.provider),
      },
    }
  }

  if ("result" in parsed || "status" in parsed || "runId" in parsed) {
    return toChatFromRun(parsed as OpenClawRunResponse, agentId)
  }

  throw new ConsumerAgentChatError("OpenClaw bridge returned an unsupported payload shape.", 502)
}

async function chatWithBridge(args: {
  agentId: string
  message: string
  sessionId?: string | null
  bridgeUrls: string[]
}): Promise<ChatWithConsumerAgentResponse> {
  const bridgeToken = normalizePathInput(process.env[OPENCLAW_AGENT_BRIDGE_TOKEN_ENV])
  const attemptErrors: string[] = []

  for (const bridgeUrl of args.bridgeUrls) {
    try {
      const response = await fetch(bridgeUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(bridgeToken ? { authorization: `Bearer ${bridgeToken}` } : {}),
        },
        body: JSON.stringify({
          agentId: args.agentId,
          message: args.message,
          sessionId: args.sessionId ?? null,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(OPENCLAW_AGENT_TIMEOUT_MS),
      })

      const payload = (await response.json().catch(() => null)) as unknown

      if (!response.ok) {
        const detail = extractBridgeError(payload) ?? `HTTP ${response.status}`
        attemptErrors.push(`${bridgeUrl} -> ${detail}`)
        continue
      }

      return parseBridgePayload(payload, args.agentId)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected bridge request failure."
      attemptErrors.push(`${bridgeUrl} -> ${message}`)
    }
  }

  throw new ConsumerAgentChatError(
    `OpenClaw bridge request failed. Attempts: ${attemptErrors.join(" | ")}`,
    502,
  )
}

export async function chatWithConsumerAgent(args: {
  agentId: string
  message: string
  sessionId?: string | null
}): Promise<ChatWithConsumerAgentResponse> {
  const commandArgs = ["agent", "--agent", args.agentId, "--message", args.message, "--json"]

  const sessionId = asNonEmptyString(args.sessionId)
  if (sessionId) {
    commandArgs.push("--session-id", sessionId)
  }

  const bridgeUrls = getOpenClawBridgeUrlCandidates(args.agentId)
  let bridgeError: ConsumerAgentChatError | null = null

  if (bridgeUrls.length > 0) {
    try {
      return await chatWithBridge({
        agentId: args.agentId,
        message: args.message,
        sessionId,
        bridgeUrls,
      })
    } catch (error) {
      bridgeError =
        error instanceof ConsumerAgentChatError
          ? error
          : new ConsumerAgentChatError("OpenClaw bridge request failed.", 502)
    }
  }

  const executableCandidates = await getOpenClawExecutableCandidates()

  if (executableCandidates.length === 0) {
    if (bridgeError) {
      throw bridgeError
    }

    throw new ConsumerAgentChatError(
      `OpenClaw CLI is not available on this server. Set ${OPENCLAW_EXECUTABLE_ENV} to the absolute openclaw binary path or configure ${OPENCLAW_AGENT_BRIDGE_URL_ENV}.`,
      502,
    )
  }

  let commandResult: ExecCommandResult | null = null

  for (const executable of executableCandidates) {
    try {
      commandResult = await runOpenClawAgentCommand(executable, commandArgs)
      break
    } catch (error) {
      const execError = error as ExecCommandError
      if (execError.code === "ENOENT") {
        continue
      }

      throw new ConsumerAgentChatError(toExecErrorMessage(execError), 502)
    }
  }

  if (!commandResult) {
    if (bridgeError) {
      throw bridgeError
    }

    const checked = executableCandidates.join(", ")
    throw new ConsumerAgentChatError(
      `OpenClaw CLI executable was not found. Checked: ${checked}. Set ${OPENCLAW_EXECUTABLE_ENV} to the absolute openclaw binary path or configure ${OPENCLAW_AGENT_BRIDGE_URL_ENV}.`,
      502,
    )
  }

  return toChatFromRun(parseOpenClawResponse(commandResult.stdout), args.agentId)
}
