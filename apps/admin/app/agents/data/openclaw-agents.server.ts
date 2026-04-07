import "server-only"

import { constants as fsConstants } from "node:fs"
import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

import type { CatalogAgent, CreateOpenClawAgentRequest, ListOpenClawAgentsResponse } from "./contracts"

type AgentConfigEntry = {
  id?: string
  model?: unknown
  workspace?: string
  agentDir?: string
  name?: string
  displayName?: string
}

type AgentsDefaults = {
  model?: unknown
  workspace?: string
  models?: Record<string, unknown>
}

type AgentsConfig = {
  defaults?: AgentsDefaults
  list?: AgentConfigEntry[]
}

type OpenClawConfig = {
  agents?: AgentsConfig
  [key: string]: unknown
}

type OpenClawConfigBridgePayload = {
  config?: unknown
  maskedConfig?: unknown
}

const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i
const DEFAULT_OPENCLAW_CONFIG_BRIDGE_URL = "http://127.0.0.1:4311/api/openclaw/config"
const OPENCLAW_CONFIG_BRIDGE_TIMEOUT_MS = 1_500

export class OpenClawAgentsError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
  }
}

type OpenClawPaths = {
  configPath: string
  agentsRoot: string
  checkedConfigPaths: string[]
  unreadableConfigPaths: string[]
}

function normalizePathInput(raw: string | undefined): string {
  if (!raw) return ""
  return raw.trim().replace(/^['"]|['"]$/g, "")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function shouldDisableBridgeFallback(): boolean {
  const raw = normalizePathInput(process.env.OPENCLAW_DISABLE_CONFIG_BRIDGE_FALLBACK).toLowerCase()
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on"
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

async function readOpenClawConfigFromBridge(): Promise<OpenClawConfig | null> {
  const bridgeCandidates = getOpenClawConfigBridgeCandidates()

  for (const bridgeUrl of bridgeCandidates) {
    try {
      const response = await fetch(bridgeUrl, {
        method: "GET",
        cache: "no-store",
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(OPENCLAW_CONFIG_BRIDGE_TIMEOUT_MS),
      })

      if (!response.ok) continue

      const payload = (await response.json()) as OpenClawConfigBridgePayload | OpenClawConfig
      if (!isRecord(payload)) continue

      const candidateConfig =
        (isRecord(payload.maskedConfig) ? payload.maskedConfig : null) ??
        (isRecord(payload.config) ? payload.config : null) ??
        payload

      if (isRecord(candidateConfig)) {
        return candidateConfig as OpenClawConfig
      }
    } catch {
      // optional fallback path; ignore and keep probing
    }
  }

  return null
}

function getOpenClawConfigBridgeAgentCandidates(): string[] {
  const bridgeCandidates = getOpenClawConfigBridgeCandidates()
  const candidates: string[] = []

  for (const bridgeUrl of bridgeCandidates) {
    try {
      const url = new URL(bridgeUrl)
      const basePath = url.pathname.replace(/\/+$/, "") || "/"
      url.pathname = `${basePath}/agents`
      url.search = ""
      url.hash = ""
      candidates.push(url.toString())
    } catch {
      // ignore invalid candidates
    }
  }

  return Array.from(new Set(candidates))
}

async function getOpenClawHomeCandidates(): Promise<string[]> {
  const candidates: string[] = []
  const explicitHome = normalizePathInput(process.env.OPENCLAW_HOME)
  const windows = process.platform === "win32"

  if (explicitHome) {
    candidates.push(explicitHome)
  }

  const homeCandidates = [homedir().trim()].filter(Boolean)
  for (const home of homeCandidates) {
    candidates.push(path.join(home, ".openclaw"))
  }

  if (windows) {
    const userProfile = normalizePathInput(process.env.USERPROFILE)
    const localAppData = normalizePathInput(process.env.LOCALAPPDATA)
    const appData = normalizePathInput(process.env.APPDATA)

    if (userProfile) candidates.push(path.join(userProfile, ".openclaw"))
    if (localAppData) candidates.push(path.join(localAppData, "openclaw"))
    if (appData) candidates.push(path.join(appData, "openclaw"))
  } else {
    candidates.push("/home/node/.openclaw")
    candidates.push("/root/.openclaw")
  }

  if (!windows) {
    try {
      const homeEntries = await readdir("/home", { withFileTypes: true })
      for (const entry of homeEntries) {
        if (!entry.isDirectory()) continue
        candidates.push(path.join("/home", entry.name, ".openclaw"))
      }
    } catch {
      // /home might not exist in all environments
    }
  }

  return Array.from(new Set(candidates))
}

async function resolveOpenClawPaths(): Promise<OpenClawPaths> {
  const homes = await getOpenClawHomeCandidates()
  const explicitConfigPath = normalizePathInput(process.env.OPENCLAW_CONFIG_PATH)
  const explicitAgentsRoot = normalizePathInput(process.env.OPENCLAW_AGENTS_ROOT)

  const checkedConfigPaths = [
    ...(explicitConfigPath ? [explicitConfigPath] : []),
    ...homes.map((home) => path.join(home, "openclaw.json")),
  ]
  const unreadableConfigPaths: string[] = []

  if (explicitConfigPath) {
    try {
      await access(explicitConfigPath, fsConstants.R_OK)
      const inferredHome = path.dirname(explicitConfigPath)
      return {
        configPath: explicitConfigPath,
        agentsRoot: explicitAgentsRoot || path.join(inferredHome, "agents"),
        checkedConfigPaths,
        unreadableConfigPaths,
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "EACCES") {
        unreadableConfigPaths.push(explicitConfigPath)
      }
    }
  }

  for (const openClawHome of homes) {
    const configPath = path.join(openClawHome, "openclaw.json")
    try {
      await access(configPath, fsConstants.R_OK)
      return {
        configPath,
        agentsRoot: explicitAgentsRoot || path.join(openClawHome, "agents"),
        checkedConfigPaths,
        unreadableConfigPaths,
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "EACCES") {
        unreadableConfigPaths.push(configPath)
      }
      // keep scanning candidates
    }
  }

  const fallbackHome = homes[0] ?? path.join(homedir(), ".openclaw")
  return {
    configPath: explicitConfigPath || path.join(fallbackHome, "openclaw.json"),
    agentsRoot: explicitAgentsRoot || path.join(fallbackHome, "agents"),
    checkedConfigPaths,
    unreadableConfigPaths,
  }
}

function normalizeAgentId(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return ""

  const slug = trimmed
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 64)

  return AGENT_ID_PATTERN.test(slug) ? slug : ""
}

function toDisplayName(rawId: string): string {
  return rawId
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function parseModel(model: unknown): string | null {
  if (typeof model === "string" && model.trim()) {
    return model.trim()
  }

  if (model && typeof model === "object") {
    const primary = (model as { primary?: unknown }).primary
    if (typeof primary === "string" && primary.trim()) {
      return primary.trim()
    }
  }

  return null
}

function createCatalogAgent(args: {
  id: string
  entry?: AgentConfigEntry
  defaults?: AgentsDefaults
  hasDirectory: boolean
}): CatalogAgent {
  const model = parseModel(args.entry?.model) ?? parseModel(args.defaults?.model) ?? "not-set"
  const workspace = args.entry?.workspace ?? args.defaults?.workspace ?? "default"

  const hasConfigEntry = Boolean(args.entry)
  const status: CatalogAgent["status"] = args.hasDirectory
    ? hasConfigEntry
      ? "published"
      : "paused"
    : "draft"

  return {
    id: args.id,
    name: args.entry?.displayName ?? args.entry?.name ?? toDisplayName(args.id),
    type: "custom",
    aiProvider: "openclaw",
    aiModel: model,
    version: "openclaw",
    status,
    activeUsers: 0,
    workspace,
  }
}

function parseBridgeCatalogAgent(value: unknown): CatalogAgent | null {
  if (!isRecord(value)) return null

  const id = normalizeAgentId(String(value.id ?? ""))
  if (!id) return null

  const name = normalizePathInput(typeof value.name === "string" ? value.name : "") || toDisplayName(id)
  const aiModel = normalizePathInput(typeof value.aiModel === "string" ? value.aiModel : "") || "not-set"
  const workspace = normalizePathInput(typeof value.workspace === "string" ? value.workspace : "") || "default"
  const rawStatus = normalizePathInput(typeof value.status === "string" ? value.status : "")

  const status: CatalogAgent["status"] =
    rawStatus === "published" || rawStatus === "draft" || rawStatus === "paused" ? rawStatus : "published"

  return {
    id,
    name,
    type: "custom",
    aiProvider: "openclaw",
    aiModel,
    version: "openclaw",
    status,
    activeUsers: typeof value.activeUsers === "number" && Number.isFinite(value.activeUsers) ? value.activeUsers : 0,
    workspace,
  }
}

function toAbsolutePath(value: unknown): string | null {
  const normalized = normalizePathInput(typeof value === "string" ? value : "")
  if (!normalized || !path.isAbsolute(normalized)) {
    return null
  }
  return path.resolve(normalized)
}

function deriveWorkspacePath(defaultWorkspace: unknown, agentId: string): string | null {
  const base = toAbsolutePath(defaultWorkspace)
  if (!base) return null
  return path.resolve(`${base}-${agentId}`)
}

function canDeleteWorkspacePath(args: {
  workspacePath: string
  defaultWorkspace: unknown
  agentId: string
}): boolean {
  const lowerAgentId = args.agentId.toLowerCase()
  const defaultPath = toAbsolutePath(args.defaultWorkspace)
  if (defaultPath && args.workspacePath === defaultPath) {
    return false
  }

  // Guard against shared roots by requiring the agent id in the directory name.
  return args.workspacePath.toLowerCase().includes(lowerAgentId)
}

function getWorkspaceDeleteTargets(args: {
  entry?: AgentConfigEntry
  defaults?: AgentsDefaults
  agentId: string
}): string[] {
  const targets = new Set<string>()
  const entryWorkspace = toAbsolutePath(args.entry?.workspace)
  const derivedWorkspace = deriveWorkspacePath(args.defaults?.workspace, args.agentId)

  if (entryWorkspace) targets.add(entryWorkspace)
  if (derivedWorkspace) targets.add(derivedWorkspace)

  return Array.from(targets).filter((workspacePath) =>
    canDeleteWorkspacePath({
      workspacePath,
      defaultWorkspace: args.defaults?.workspace,
      agentId: args.agentId,
    }),
  )
}

function getAgentDirectoryDeleteTargets(args: {
  agentsRoot: string
  entry?: AgentConfigEntry
  agentId: string
}): string[] {
  const targets = new Set<string>([path.join(args.agentsRoot, args.agentId)])
  const configuredAgentDir = toAbsolutePath(args.entry?.agentDir)
  if (configuredAgentDir && configuredAgentDir.toLowerCase().includes(args.agentId.toLowerCase())) {
    const suffix = `${path.sep}agent`
    const candidate = configuredAgentDir.endsWith(suffix) ? path.dirname(configuredAgentDir) : configuredAgentDir
    targets.add(candidate)
  }
  return Array.from(targets)
}

async function createOpenClawAgentViaBridge(args: {
  name: string
  id: string
  model?: string
}): Promise<CatalogAgent | null> {
  const bridgeCandidates = getOpenClawConfigBridgeAgentCandidates()

  for (const bridgeUrl of bridgeCandidates) {
    try {
      const response = await fetch(bridgeUrl, {
        method: "POST",
        cache: "no-store",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: args.name,
          id: args.id,
          model: args.model,
        }),
        signal: AbortSignal.timeout(OPENCLAW_CONFIG_BRIDGE_TIMEOUT_MS * 2),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string; agent?: unknown } | null

      if (!response.ok) {
        const bridgeError = normalizePathInput(payload?.error) || `OpenClaw bridge request failed (${response.status}).`

        if (response.status === 404) {
          continue
        }

        if (response.status >= 400 && response.status < 500) {
          throw new OpenClawAgentsError(bridgeError, response.status)
        }

        continue
      }

      const agent = parseBridgeCatalogAgent(payload?.agent)
      if (agent) return agent
    } catch (error) {
      if (error instanceof OpenClawAgentsError) {
        throw error
      }
      // try remaining candidates
    }
  }

  return null
}

async function deleteOpenClawAgentViaBridge(agentId: string): Promise<boolean> {
  const bridgeCandidates = getOpenClawConfigBridgeAgentCandidates()

  for (const bridgeUrl of bridgeCandidates) {
    try {
      const endpoint = new URL(bridgeUrl)
      const basePath = endpoint.pathname.replace(/\/+$/, "") || "/"
      endpoint.pathname = `${basePath}/${encodeURIComponent(agentId)}`
      endpoint.search = ""
      endpoint.hash = ""

      const response = await fetch(endpoint.toString(), {
        method: "DELETE",
        cache: "no-store",
        headers: {
          accept: "application/json",
        },
        signal: AbortSignal.timeout(OPENCLAW_CONFIG_BRIDGE_TIMEOUT_MS * 2),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        const bridgeError = normalizePathInput(payload?.error) || `OpenClaw bridge request failed (${response.status}).`

        if (response.status === 404) {
          continue
        }

        if (response.status >= 400 && response.status < 500) {
          throw new OpenClawAgentsError(bridgeError, response.status)
        }

        continue
      }

      return true
    } catch (error) {
      if (error instanceof OpenClawAgentsError) {
        throw error
      }
      // try remaining candidates
    }
  }

  return false
}

async function readOpenClawConfig(paths: OpenClawPaths): Promise<OpenClawConfig> {
  let raw = ""
  try {
    raw = await readFile(paths.configPath, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      const bridgeConfig = await readOpenClawConfigFromBridge()
      if (bridgeConfig) return bridgeConfig
      return {}
    }

    const checkedPathsText =
      paths.checkedConfigPaths.length > 1 ? ` Checked: ${paths.checkedConfigPaths.join(", ")}.` : ""
    const unreadablePathsText =
      paths.unreadableConfigPaths.length > 0
        ? ` Permission denied: ${paths.unreadableConfigPaths.join(", ")}.`
        : ""

    throw new OpenClawAgentsError(
      `Unable to read OpenClaw config at ${paths.configPath}.${checkedPathsText}${unreadablePathsText} Set OPENCLAW_HOME if needed.`,
      500,
    )
  }

  try {
    return JSON.parse(raw) as OpenClawConfig
  } catch {
    throw new OpenClawAgentsError(`OpenClaw config is invalid JSON: ${paths.configPath}`, 500)
  }
}

async function writeOpenClawConfig(configPath: string, config: OpenClawConfig) {
  await mkdir(path.dirname(configPath), { recursive: true })
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8")
}

async function readAgentDirectoryIds(agentsRoot: string): Promise<string[]> {
  try {
    const entries = await readdir(agentsRoot, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch {
    return []
  }
}

function getConfigEntryMap(entries: AgentConfigEntry[] | undefined): Map<string, AgentConfigEntry> {
  const map = new Map<string, AgentConfigEntry>()

  for (const entry of entries ?? []) {
    if (!entry?.id) continue

    const id = normalizeAgentId(entry.id)
    if (!id) continue

    map.set(id, entry)
  }

  return map
}

function getAvailableModels(defaults?: AgentsDefaults): string[] {
  const explicit = Object.keys(defaults?.models ?? {})
  const primary = parseModel(defaults?.model)

  if (primary && !explicit.includes(primary)) {
    explicit.unshift(primary)
  }

  return explicit
}

async function createAgentScaffold(args: {
  agentsRoot: string
  agentId: string
}) {
  const targetRoot = path.join(args.agentsRoot, args.agentId)
  const targetAgentDir = path.join(targetRoot, "agent")
  const targetSessionsDir = path.join(targetRoot, "sessions")

  await mkdir(targetAgentDir, { recursive: true })
  await mkdir(targetSessionsDir, { recursive: true })

  const sourceAgentDir = path.join(args.agentsRoot, "main", "agent")

  const defaultModelsJson = {
    providers: {
      "openai-codex": {
        baseUrl: "https://chatgpt.com/backend-api",
        api: "openai-codex-responses",
        models: [],
      },
    },
  }

  const sourceModels = await readFile(path.join(sourceAgentDir, "models.json"), "utf8").catch(
    () => `${JSON.stringify(defaultModelsJson, null, 2)}\n`,
  )
  const sourceAuthProfiles = await readFile(path.join(sourceAgentDir, "auth-profiles.json"), "utf8").catch(
    () => `${JSON.stringify({ version: 1, profiles: {}, lastGood: {}, usageStats: {} }, null, 2)}\n`,
  )

  await writeFile(path.join(targetAgentDir, "models.json"), sourceModels, "utf8")
  await writeFile(path.join(targetAgentDir, "auth-profiles.json"), sourceAuthProfiles, "utf8")
  await writeFile(path.join(targetSessionsDir, "sessions.json"), "{}\n", "utf8")
  await writeFile(path.join(targetSessionsDir, "sessions.json.telegram-sent-messages.json"), "{}\n", "utf8")
}

export async function listOpenClawAgents(): Promise<ListOpenClawAgentsResponse> {
  const paths = await resolveOpenClawPaths()
  const config = await readOpenClawConfig(paths)

  const defaults = config.agents?.defaults
  const directories = await readAgentDirectoryIds(paths.agentsRoot)
  const entries = getConfigEntryMap(config.agents?.list)

  const allIds = new Set<string>([...directories, ...entries.keys()])
  const agents = Array.from(allIds)
    .sort((a, b) => a.localeCompare(b))
    .map((id) =>
      createCatalogAgent({
        id,
        defaults,
        entry: entries.get(id),
        hasDirectory: directories.includes(id),
      }),
    )

  return {
    agents,
    defaultModel: parseModel(defaults?.model),
    availableModels: getAvailableModels(defaults),
  }
}

export async function deleteOpenClawAgent(rawAgentId: string): Promise<{ id: string }> {
  const agentId = normalizeAgentId(rawAgentId)
  if (!agentId) {
    throw new OpenClawAgentsError(
      "Invalid agent id. Use letters, numbers, hyphen, or underscore (max 64 chars).",
      400,
    )
  }

  if (agentId === "main") {
    throw new OpenClawAgentsError("The main agent is protected and cannot be deleted.", 400)
  }

  const bridgeDeleted = await deleteOpenClawAgentViaBridge(agentId)
  if (bridgeDeleted) {
    return { id: agentId }
  }

  const paths = await resolveOpenClawPaths()
  const config = await readOpenClawConfig(paths)
  const defaults = config.agents?.defaults
  const directories = await readAgentDirectoryIds(paths.agentsRoot)
  const entries = getConfigEntryMap(config.agents?.list)
  const entry = entries.get(agentId)
  const hasDirectory = directories.includes(agentId)

  if (!entry && !hasDirectory) {
    throw new OpenClawAgentsError(`Agent '${agentId}' was not found.`, 404)
  }

  if (!config.agents) {
    config.agents = {}
  }

  const existingList = Array.isArray(config.agents.list) ? config.agents.list : []
  config.agents.list = existingList.filter((item) => normalizeAgentId(item?.id ?? "") !== agentId)

  const deleteTargets = new Set<string>(
    getAgentDirectoryDeleteTargets({
      agentsRoot: paths.agentsRoot,
      entry,
      agentId,
    }),
  )
  for (const workspacePath of getWorkspaceDeleteTargets({ entry, defaults, agentId })) {
    deleteTargets.add(workspacePath)
  }

  try {
    for (const targetPath of deleteTargets) {
      await rm(targetPath, { recursive: true, force: true })
    }
    await writeOpenClawConfig(paths.configPath, config)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === "EACCES" || code === "EPERM" || code === "EROFS" || code === "ENOENT") {
      throw new OpenClawAgentsError(
        "Unable to delete OpenClaw agent files. Config: " +
          paths.configPath +
          ". Agents root: " +
          paths.agentsRoot +
          ". Set OPENCLAW_HOME/OPENCLAW_CONFIG_PATH to a writable location, or configure OPENCLAW_CONFIG_BRIDGE_URL to a bridge that supports DELETE /api/openclaw/config/agents/{id}.",
        500,
      )
    }

    if (error instanceof Error && error.message.trim()) {
      throw new OpenClawAgentsError("Failed to delete OpenClaw agent: " + error.message, 500)
    }

    throw new OpenClawAgentsError("Failed to delete OpenClaw agent due to an unexpected filesystem error.", 500)
  }

  return { id: agentId }
}

export async function createOpenClawAgent(input: CreateOpenClawAgentRequest): Promise<CatalogAgent> {
  const rawName = typeof (input as { name?: unknown })?.name === "string" ? (input as { name: string }).name : ""
  const name = rawName.trim()
  if (name.length < 3) {
    throw new OpenClawAgentsError("Agent name must be at least 3 characters.", 400)
  }

  const rawId = typeof (input as { id?: unknown })?.id === "string" ? (input as { id: string }).id : ""
  const requestedId = rawId.trim() || name
  const agentId = normalizeAgentId(requestedId)

  if (!agentId) {
    throw new OpenClawAgentsError(
      "Invalid agent id. Use letters, numbers, hyphen, or underscore (max 64 chars).",
      400,
    )
  }

  const rawModel = typeof (input as { model?: unknown })?.model === "string" ? (input as { model: string }).model : ""
  const requestedModel = rawModel.trim() || undefined

  const bridgeCreated = await createOpenClawAgentViaBridge({
    name,
    id: agentId,
    model: requestedModel,
  })
  if (bridgeCreated) {
    return bridgeCreated
  }

  const paths = await resolveOpenClawPaths()
  const config = await readOpenClawConfig(paths)

  const defaults = config.agents?.defaults
  const defaultModel = parseModel(defaults?.model)
  const selectedModel = requestedModel || defaultModel || undefined

  const directories = await readAgentDirectoryIds(paths.agentsRoot)
  const existingEntries = getConfigEntryMap(config.agents?.list)

  if (directories.includes(agentId) || existingEntries.has(agentId)) {
    throw new OpenClawAgentsError(`Agent '${agentId}' already exists.`, 409)
  }

  const nextEntry: AgentConfigEntry = {
    id: agentId,
    name,
  }

  if (selectedModel) {
    nextEntry.model = selectedModel
  }

  if (!config.agents) {
    config.agents = {}
  }

  if (!Array.isArray(config.agents.list)) {
    config.agents.list = []
  }

  config.agents.list.push(nextEntry)

  try {
    await writeOpenClawConfig(paths.configPath, config)
    await createAgentScaffold({
      agentsRoot: paths.agentsRoot,
      agentId,
    })
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === "EACCES" || code === "EPERM" || code === "EROFS" || code === "ENOENT") {
      throw new OpenClawAgentsError(
        "Unable to write OpenClaw agent files. Config: " +
          paths.configPath +
          ". Agents root: " +
          paths.agentsRoot +
          ". Set OPENCLAW_HOME/OPENCLAW_CONFIG_PATH to a writable location, or configure OPENCLAW_CONFIG_BRIDGE_URL to a bridge that supports POST /api/openclaw/config/agents.",
        500,
      )
    }

    if (error instanceof Error && error.message.trim()) {
      throw new OpenClawAgentsError("Failed to create OpenClaw agent: " + error.message, 500)
    }

    throw new OpenClawAgentsError("Failed to create OpenClaw agent due to an unexpected filesystem error.", 500)
  }

  return createCatalogAgent({
    id: agentId,
    defaults,
    entry: nextEntry,
    hasDirectory: true,
  })
}
