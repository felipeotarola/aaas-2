import "server-only"

import { execFile } from "node:child_process"
import { constants as fsConstants } from "node:fs"
import { access, mkdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

const OPENCLAW_CHANNEL_COMMAND_TIMEOUT_MS = 30_000
const OPENCLAW_CHANNEL_COMMAND_MAX_BUFFER_BYTES = 1 * 1024 * 1024
const OPENCLAW_EXECUTABLE_ENV = "OPENCLAW_CLI_PATH"
const OPENCLAW_CONFIG_BRIDGE_TOKEN_ENV = "OPENCLAW_CONFIG_BRIDGE_TOKEN"
const OPENCLAW_AGENT_BRIDGE_TOKEN_ENV = "OPENCLAW_AGENT_BRIDGE_TOKEN"
const DEFAULT_OPENCLAW_CONFIG_BRIDGE_URL = "http://127.0.0.1:4311/api/openclaw/config"
const DEFAULT_HOSTED_CONFIG_BRIDGE_URL = "https://agents.felipeotarola.com/api/openclaw/config"
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

type OpenClawConfig = Record<string, unknown>
type BridgeAttemptOutcome = {
  synced: boolean
  failures: string[]
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
    "/var/lib/openclaw/openclaw.json",
    "/home/node/.openclaw/openclaw.json",
    "/root/.openclaw/openclaw.json",
    "/tmp/.openclaw/openclaw.json",
  ].filter(Boolean)

  return Array.from(new Set(candidates))
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
  if (!shouldDisableBridgeFallback()) {
    candidates.push(DEFAULT_OPENCLAW_CONFIG_BRIDGE_URL)
    candidates.push(DEFAULT_HOSTED_CONFIG_BRIDGE_URL)
  }

  return Array.from(new Set(candidates))
}

function buildBridgeTelegramSyncEndpoints(bridgeUrl: string): string[] {
  try {
    const url = new URL(bridgeUrl)
    const basePath = url.pathname.replace(/\/+$/, "") || "/"
    const endpoints = ["/telegram/accounts", "/channels/telegram/accounts"]

    return endpoints.map((suffix) => {
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

async function syncTelegramChannelViaBridge(args: { accountId: string; botToken: string }): Promise<BridgeAttemptOutcome> {
  const bridgeUrls = getOpenClawConfigBridgeCandidates()
  if (bridgeUrls.length === 0) {
    return { synced: false, failures: [] }
  }

  const failures: string[] = []
  const bearerToken = getBridgeBearerToken()

  for (const bridgeUrl of bridgeUrls) {
    const endpoints = buildBridgeTelegramSyncEndpoints(bridgeUrl)
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
          body: JSON.stringify({
            accountId: args.accountId,
            botToken: args.botToken,
          }),
          signal: AbortSignal.timeout(OPENCLAW_CONFIG_BRIDGE_TIMEOUT_MS),
        })

        const payload = (await response.json().catch(() => null)) as unknown
        if (response.ok) {
          return { synced: true, failures }
        }

        if (response.status === 404) {
          continue
        }

        const detail = extractBridgeError(payload) ?? `HTTP ${response.status}`
        failures.push(`${endpoint}: ${truncateErrorDetail(detail.replaceAll(args.botToken, "<redacted-token>"))}`)
      } catch (error) {
        const detail = error instanceof Error ? error.message : "unknown bridge request failure"
        failures.push(`${endpoint}: ${truncateErrorDetail(detail.replaceAll(args.botToken, "<redacted-token>"))}`)
      }
    }
  }

  return { synced: false, failures }
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
    `Telegram token was verified, but config-file sync failed (${failures.join(" | ")}). Configure OPENCLAW_CONFIG_BRIDGE_URL to a writable OpenClaw bridge endpoint or ensure a writable config path exists (for example /var/lib/openclaw/openclaw.json).`,
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

  const bridgeSync = await syncTelegramChannelViaBridge(args)
  if (bridgeSync.synced) {
    return
  }
  if (bridgeSync.failures.length > 0) {
    failures.push(...bridgeSync.failures)
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
