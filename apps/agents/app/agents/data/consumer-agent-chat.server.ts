import "server-only"

import { execFile } from "node:child_process"
import { constants as fsConstants } from "node:fs"
import { access } from "node:fs/promises"
import path from "node:path"

import type { ChatWithConsumerAgentResponse } from "./contracts"

const OPENCLAW_AGENT_TIMEOUT_MS = 90_000
const OPENCLAW_AGENT_MAX_BUFFER_BYTES = 2 * 1024 * 1024

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

const OPENCLAW_EXECUTABLE_ENV = "OPENCLAW_CLI_PATH"

function normalizePathInput(raw: string | undefined): string {
  if (!raw) return ""
  return raw.trim().replace(/^['"]|['"]$/g, "")
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
  const candidates = [
    explicit,
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

export class ConsumerAgentChatError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
  }
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
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

  const executableCandidates = await getOpenClawExecutableCandidates()

  if (executableCandidates.length === 0) {
    throw new ConsumerAgentChatError(
      `OpenClaw CLI is not available on this server. Set ${OPENCLAW_EXECUTABLE_ENV} to the absolute openclaw binary path.`,
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
    throw new ConsumerAgentChatError(
      `OpenClaw CLI executable was not found. Set ${OPENCLAW_EXECUTABLE_ENV} to the absolute openclaw binary path.`,
      502,
    )
  }

  const run = parseOpenClawResponse(commandResult.stdout)
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
      agentId: args.agentId,
      reply,
      sessionId: asNonEmptyString(run.result?.meta?.agentMeta?.sessionId),
      runId: asNonEmptyString(run.runId),
      model: asNonEmptyString(run.result?.meta?.agentMeta?.model),
      provider: asNonEmptyString(run.result?.meta?.agentMeta?.provider),
    },
  }
}
