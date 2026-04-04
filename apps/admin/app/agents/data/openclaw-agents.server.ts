import "server-only"

import { constants as fsConstants } from "node:fs"
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"

import type { CatalogAgent, CreateOpenClawAgentRequest, ListOpenClawAgentsResponse } from "./contracts"

type AgentConfigEntry = {
  id?: string
  model?: unknown
  workspace?: string
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

const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i

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

async function readOpenClawConfig(paths: OpenClawPaths): Promise<OpenClawConfig> {
  let raw = ""
  try {
    raw = await readFile(paths.configPath, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
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

export async function createOpenClawAgent(input: CreateOpenClawAgentRequest): Promise<CatalogAgent> {
  const name = input.name.trim()
  if (name.length < 3) {
    throw new OpenClawAgentsError("Agent name must be at least 3 characters.", 400)
  }

  const requestedId = input.id?.trim() || name
  const agentId = normalizeAgentId(requestedId)

  if (!agentId) {
    throw new OpenClawAgentsError(
      "Invalid agent id. Use letters, numbers, hyphen, or underscore (max 64 chars).",
      400,
    )
  }

  const paths = await resolveOpenClawPaths()
  const config = await readOpenClawConfig(paths)

  const defaults = config.agents?.defaults
  const defaultModel = parseModel(defaults?.model)
  const selectedModel = input.model?.trim() || defaultModel || undefined

  const directories = await readAgentDirectoryIds(paths.agentsRoot)
  const existingEntries = getConfigEntryMap(config.agents?.list)

  if (directories.includes(agentId) || existingEntries.has(agentId)) {
    throw new OpenClawAgentsError(`Agent '${agentId}' already exists.`, 409)
  }

  const nextEntry: AgentConfigEntry = {
    id: agentId,
    displayName: name,
  }

  if (selectedModel) {
    nextEntry.model = { primary: selectedModel }
  }

  if (!config.agents) {
    config.agents = {}
  }

  if (!Array.isArray(config.agents.list)) {
    config.agents.list = []
  }

  config.agents.list.push(nextEntry)

  await writeOpenClawConfig(paths.configPath, config)
  await createAgentScaffold({
    agentsRoot: paths.agentsRoot,
    agentId,
  })

  return createCatalogAgent({
    id: agentId,
    defaults,
    entry: nextEntry,
    hasDirectory: true,
  })
}
