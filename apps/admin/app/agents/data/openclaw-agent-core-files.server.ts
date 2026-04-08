import "server-only"

import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

import type { AgentCoreFile, AgentCoreFileKind, GetOpenClawAgentCoreFilesResponse } from "./contracts"
import { OpenClawAgentsError, listOpenClawAgents } from "./openclaw-agents.server"

const MAX_FILE_BYTES = 24_000
const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/i

type CoreFileDescriptor = {
  kind: Exclude<AgentCoreFileKind, "MEMORY">
  fileName: string
}

const CORE_FILE_DESCRIPTORS: CoreFileDescriptor[] = [
  { kind: "AGENTS", fileName: "AGENTS.md" },
  { kind: "SOUL", fileName: "SOUL.md" },
  { kind: "TOOLS", fileName: "TOOLS.md" },
  { kind: "IDENTITY", fileName: "IDENTITY.md" },
  { kind: "USER", fileName: "USER.md" },
  { kind: "HEARTBEAT", fileName: "HEARTBEAT.md" },
  { kind: "BOOTSTRAP", fileName: "BOOTSTRAP.md" },
]

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

function toWorkspacePath(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed || !path.isAbsolute(trimmed)) return null
  return path.resolve(trimmed)
}

function buildWorkspaceCandidates(agentId: string, configuredWorkspacePath: string | null): string[] {
  const candidates: string[] = []

  if (configuredWorkspacePath) {
    candidates.push(configuredWorkspacePath)
  }

  const roots = ["/home/node/.openclaw", "/root/.openclaw"]
  for (const root of roots) {
    candidates.push(path.join(root, `workspace-${agentId}`))
    candidates.push(path.join(root, "agents", agentId, "workspace"))
  }

  return Array.from(new Set(candidates.map((value) => path.resolve(value))))
}

async function pickWorkspacePath(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    for (const descriptor of CORE_FILE_DESCRIPTORS) {
      const resolvedPath = path.join(candidate, descriptor.fileName)
      const read = await readCoreFile(resolvedPath)
      if (read.exists) {
        return candidate
      }
    }
  }

  return candidates[0] ?? null
}

async function readCoreFile(filePath: string): Promise<Omit<AgentCoreFile, "kind" | "fileName">> {
  try {
    const value = await readFile(filePath, "utf8")
    const bytes = Buffer.byteLength(value, "utf8")

    if (bytes <= MAX_FILE_BYTES) {
      return {
        resolvedPath: filePath,
        exists: true,
        content: value,
        truncated: false,
        error: null,
      }
    }

    const content = `${value.slice(0, MAX_FILE_BYTES)}\n\n... [truncated at ${MAX_FILE_BYTES} bytes]`
    return {
      resolvedPath: filePath,
      exists: true,
      content,
      truncated: true,
      error: null,
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === "ENOENT") {
      return {
        resolvedPath: filePath,
        exists: false,
        content: "",
        truncated: false,
        error: null,
      }
    }

    return {
      resolvedPath: filePath,
      exists: false,
      content: "",
      truncated: false,
      error: error instanceof Error ? error.message : "Failed to read file.",
    }
  }
}

async function resolveMemoryCoreFile(workspacePath: string): Promise<AgentCoreFile> {
  const directCandidates = ["MEMORY.md", path.join("memory", "MEMORY.md")]

  for (const candidate of directCandidates) {
    const resolvedPath = path.join(workspacePath, candidate)
    const read = await readCoreFile(resolvedPath)
    if (read.exists || read.error) {
      return {
        kind: "MEMORY",
        fileName: candidate,
        ...read,
      }
    }
  }

  const memoryDirPath = path.join(workspacePath, "memory")

  try {
    const directoryEntries = await readdir(memoryDirPath, { withFileTypes: true })
    const files = directoryEntries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a))

    if (files.length === 0) {
      return {
        kind: "MEMORY",
        fileName: "memory/",
        resolvedPath: memoryDirPath,
        exists: false,
        content: "",
        truncated: false,
        error: null,
      }
    }

    const newestFileName = files[0]
    if (!newestFileName) {
      return {
        kind: "MEMORY",
        fileName: "memory/",
        resolvedPath: memoryDirPath,
        exists: false,
        content: "",
        truncated: false,
        error: null,
      }
    }
    const newestFilePath = path.join(memoryDirPath, newestFileName)
    const read = await readCoreFile(newestFilePath)

    const previewHeader = `Memory directory (${files.length} files)\nLatest: ${newestFileName}\n\nRecent files:\n${files
      .slice(0, 15)
      .map((value) => `- ${value}`)
      .join("\n")}\n\n--- Latest file content ---\n`

    return {
      kind: "MEMORY",
      fileName: "memory/",
      resolvedPath: newestFilePath,
      exists: read.exists,
      content: read.exists ? `${previewHeader}${read.content}` : previewHeader,
      truncated: read.truncated,
      error: read.error,
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code === "ENOENT") {
      return {
        kind: "MEMORY",
        fileName: "memory/",
        resolvedPath: memoryDirPath,
        exists: false,
        content: "",
        truncated: false,
        error: null,
      }
    }

    return {
      kind: "MEMORY",
      fileName: "memory/",
      resolvedPath: memoryDirPath,
      exists: false,
      content: "",
      truncated: false,
      error: error instanceof Error ? error.message : "Failed to read memory directory.",
    }
  }
}

export async function getOpenClawAgentCoreFiles(rawAgentId: string): Promise<GetOpenClawAgentCoreFilesResponse> {
  const agentId = normalizeAgentId(rawAgentId)
  if (!agentId) {
    throw new OpenClawAgentsError(
      "Invalid agent id. Use letters, numbers, hyphen, or underscore (max 64 chars).",
      400,
    )
  }

  const payload = await listOpenClawAgents()
  const agent = payload.agents.find((value) => value.id === agentId)
  if (!agent) {
    throw new OpenClawAgentsError(`Agent '${agentId}' was not found.`, 404)
  }

  const configuredWorkspacePath = toWorkspacePath(agent.workspace)
  const workspacePath = await pickWorkspacePath(buildWorkspaceCandidates(agentId, configuredWorkspacePath))
  if (!workspacePath) {
    return {
      agent,
      workspacePath: null,
      coreFiles: [
        ...CORE_FILE_DESCRIPTORS.map<AgentCoreFile>((descriptor) => ({
          kind: descriptor.kind,
          fileName: descriptor.fileName,
          resolvedPath: null,
          exists: false,
          content: "",
          truncated: false,
          error: "Workspace path is not available for this agent.",
        })),
        {
          kind: "MEMORY",
          fileName: "memory/",
          resolvedPath: null,
          exists: false,
          content: "",
          truncated: false,
          error: "Workspace path is not available for this agent.",
        },
      ],
    }
  }

  const coreFiles = await Promise.all(
    CORE_FILE_DESCRIPTORS.map(async (descriptor) => {
      const resolvedPath = path.join(workspacePath, descriptor.fileName)
      const read = await readCoreFile(resolvedPath)
      return {
        kind: descriptor.kind,
        fileName: descriptor.fileName,
        ...read,
      } satisfies AgentCoreFile
    }),
  )

  const memoryCoreFile = await resolveMemoryCoreFile(workspacePath)

  return {
    agent,
    workspacePath,
    coreFiles: [...coreFiles, memoryCoreFile],
  }
}
