import "server-only"

import { execFile } from "node:child_process"
import { constants as fsConstants } from "node:fs"
import { access } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

const OPENCLAW_CHANNEL_COMMAND_TIMEOUT_MS = 30_000
const OPENCLAW_CHANNEL_COMMAND_MAX_BUFFER_BYTES = 1 * 1024 * 1024
const OPENCLAW_EXECUTABLE_ENV = "OPENCLAW_CLI_PATH"

type ExecCommandResult = {
  stdout: string
  stderr: string
}

type ExecCommandError = Error & {
  code?: string | number
  stdout?: string
  stderr?: string
}

export class OpenClawChannelSyncError extends Error {
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

function runOpenClawCommand(command: string, args: string[]): Promise<ExecCommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        timeout: OPENCLAW_CHANNEL_COMMAND_TIMEOUT_MS,
        maxBuffer: OPENCLAW_CHANNEL_COMMAND_MAX_BUFFER_BYTES,
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

function toExecErrorMessage(error: unknown, secretToRedact?: string): string {
  const execError = error as ExecCommandError

  const rawDetails =
    normalizeText(execError?.stderr) || normalizeText(execError?.stdout) || normalizeText(execError?.message)
  const normalized = rawDetails.replace(/\s+/g, " ").trim() || "unknown execution error"

  if (!secretToRedact) {
    return normalized
  }

  return normalized.replaceAll(secretToRedact, "<redacted-token>")
}

export async function syncTelegramChannelAccount(args: { accountId: string; botToken: string }): Promise<void> {
  const executableCandidates = await getOpenClawExecutableCandidates()

  if (executableCandidates.length === 0) {
    throw new OpenClawChannelSyncError(
      "Telegram token was verified, but OpenClaw CLI is unavailable. Set OPENCLAW_CLI_PATH and retry.",
      500,
    )
  }

  const commandArgs = [
    "channels",
    "add",
    "--channel",
    "telegram",
    "--account",
    args.accountId,
    "--token",
    args.botToken,
  ]

  const failures: string[] = []

  for (const executable of executableCandidates) {
    try {
      await runOpenClawCommand(executable, commandArgs)
      return
    } catch (error) {
      failures.push(`${executable}: ${truncateErrorDetail(toExecErrorMessage(error, args.botToken))}`)
    }
  }

  throw new OpenClawChannelSyncError(
    `Telegram token was verified, but runtime channel sync failed (${failures.join(" | ")}).`,
    502,
  )
}
