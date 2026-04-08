import "server-only"

import { execFile } from "node:child_process"
import { constants as fsConstants } from "node:fs"
import { access, mkdir, readFile, writeFile } from "node:fs/promises"
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

type OpenClawConfig = Record<string, unknown>

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

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
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

function getOpenClawConfigPathCandidates(): string[] {
  const explicitConfigPath = normalizePathInput(process.env.OPENCLAW_CONFIG_PATH)
  const explicitHome = normalizePathInput(process.env.OPENCLAW_HOME)
  const runtimeHome = normalizePathInput(homedir())
  const candidates = [
    explicitConfigPath,
    explicitHome ? path.join(explicitHome, "openclaw.json") : "",
    runtimeHome ? path.join(runtimeHome, ".openclaw", "openclaw.json") : "",
    "/home/node/.openclaw/openclaw.json",
    "/root/.openclaw/openclaw.json",
  ].filter(Boolean)

  return Array.from(new Set(candidates))
}

async function readOpenClawConfig(configPath: string): Promise<OpenClawConfig> {
  try {
    const raw = await readFile(configPath, "utf8")
    const parsed = JSON.parse(raw) as unknown
    return asRecord(parsed)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === "ENOENT") return {}
    throw error
  }
}

function patchTelegramAccountConfig(config: OpenClawConfig, args: { accountId: string; botToken: string }): OpenClawConfig {
  const channels = asRecord(config.channels)
  const telegram = asRecord(channels.telegram)
  const accounts = asRecord(telegram.accounts)
  const scopedAccount = asRecord(accounts[args.accountId])

  return {
    ...config,
    channels: {
      ...channels,
      telegram: {
        ...telegram,
        enabled: true,
        defaultAccount: normalizeText(telegram.defaultAccount as string) || args.accountId,
        accounts: {
          ...accounts,
          [args.accountId]: {
            ...scopedAccount,
            enabled: true,
            botToken: args.botToken,
          },
        },
      },
    },
  }
}

async function writeOpenClawConfig(configPath: string, config: OpenClawConfig): Promise<void> {
  await mkdir(path.dirname(configPath), { recursive: true })
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")
}

async function syncTelegramChannelViaConfigFile(args: { accountId: string; botToken: string }): Promise<void> {
  const configPaths = getOpenClawConfigPathCandidates()
  if (configPaths.length === 0) {
    throw new OpenClawChannelSyncError(
      "Telegram token was verified, but no OpenClaw config path candidates were available.",
      500,
    )
  }

  const failures: string[] = []

  for (const configPath of configPaths) {
    try {
      const current = await readOpenClawConfig(configPath)
      const next = patchTelegramAccountConfig(current, args)
      await writeOpenClawConfig(configPath, next)
      return
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown config write error"
      failures.push(`${configPath}: ${truncateErrorDetail(detail)}`)
    }
  }

  throw new OpenClawChannelSyncError(
    `Telegram token was verified, but config-file sync failed (${failures.join(" | ")}).`,
    502,
  )
}

export async function syncTelegramChannelAccount(args: { accountId: string; botToken: string }): Promise<void> {
  const executableCandidates = await getOpenClawExecutableCandidates()
  const failures: string[] = []
  const codes = new Set<string>()

  if (executableCandidates.length > 0) {
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

    for (const executable of executableCandidates) {
      try {
        await runOpenClawCommand(executable, commandArgs)
        return
      } catch (error) {
        const code = normalizeText(String((error as ExecCommandError)?.code ?? ""))
        if (code) {
          codes.add(code)
        }
        failures.push(`${executable}: ${truncateErrorDetail(toExecErrorMessage(error, args.botToken))}`)
      }
    }
  }

  if (executableCandidates.length === 0 || (codes.size > 0 && Array.from(codes).every((code) => code === "ENOENT"))) {
    await syncTelegramChannelViaConfigFile(args)
    return
  }

  throw new OpenClawChannelSyncError(
    `Telegram token was verified, but runtime channel sync failed (${failures.join(" | ") || "no CLI candidates"}).`,
    502,
  )
}
