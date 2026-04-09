import "server-only"

import { constants as fsConstants } from "node:fs"
import { access, copyFile, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js"

import { listOpenClawAgents } from "./openclaw-agents.server"

type KnowledgeSource =
  | { type: "url"; value: string }
  | { type: "file"; name: string; size: number }

export type CompleteOnboardingInput = {
  userName: string | null
  agentName: string | null
  agentDescription: string | null
  knowledgeSources: KnowledgeSource[]
  channels: Array<"whatsapp" | "telegram">
}

const BASE_WORKSPACE_MARKDOWN_FILES = [
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "BOOTSTRAP.md",
  "USER.md",
  "IDENTITY.md",
  "HEARTBEAT.md",
  "MEMORY.md",
] as const

const USER_ONBOARDING_START = "<!-- ONBOARDING_PROFILE:START -->"
const USER_ONBOARDING_END = "<!-- ONBOARDING_PROFILE:END -->"
const IDENTITY_ONBOARDING_START = "<!-- ONBOARDING_IDENTITY:START -->"
const IDENTITY_ONBOARDING_END = "<!-- ONBOARDING_IDENTITY:END -->"

export class OnboardingProvisioningError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message)
  }
}

function normalizeText(input: string | null): string | null {
  if (!input) return null
  const value = input.trim()
  return value.length > 0 ? value : null
}

function sanitizeKnowledgeSources(input: KnowledgeSource[]): KnowledgeSource[] {
  const next: KnowledgeSource[] = []

  for (const source of input) {
    if (source.type === "url") {
      const value = source.value.trim()
      if (!value) continue
      next.push({ type: "url", value })
      continue
    }

    const name = source.name.trim()
    if (!name) continue
    const safeSize = Number.isFinite(source.size) ? Math.max(0, source.size) : 0
    next.push({ type: "file", name, size: safeSize })
  }

  return next
}

function sanitizeChannels(input: Array<"whatsapp" | "telegram">): Array<"whatsapp" | "telegram"> {
  return Array.from(new Set(input.filter((channel) => channel === "whatsapp" || channel === "telegram")))
}

function toOnboardingDataErrorMessage(error: PostgrestError): string {
  if (error.code === "42P01") {
    return "Missing consumer_agent_onboarding_profiles table. Run latest Supabase migrations."
  }

  if (error.code === "PGRST204") {
    return "Missing consumer_agent_onboarding_profiles columns in schema cache. Run latest Supabase migrations."
  }

  return error.message
}

export async function persistConsumerAgentOnboardingProfile(args: {
  supabase: SupabaseClient
  userId: string
  agentId: string
  input: CompleteOnboardingInput
}): Promise<void> {
  const payload = {
    user_name: normalizeText(args.input.userName),
    agent_name: normalizeText(args.input.agentName),
    agent_description: normalizeText(args.input.agentDescription),
    knowledge_sources: sanitizeKnowledgeSources(args.input.knowledgeSources),
    channels: sanitizeChannels(args.input.channels),
    onboarding_payload: {
      userName: normalizeText(args.input.userName),
      agentName: normalizeText(args.input.agentName),
      agentDescription: normalizeText(args.input.agentDescription),
      knowledgeSources: sanitizeKnowledgeSources(args.input.knowledgeSources),
      channels: sanitizeChannels(args.input.channels),
      capturedAt: new Date().toISOString(),
    },
  }

  const { error } = await args.supabase
    .from("consumer_agent_onboarding_profiles")
    .upsert(
      {
        user_id: args.userId,
        agent_id: args.agentId,
        ...payload,
      },
      {
        onConflict: "user_id,agent_id",
      },
    )

  if (error) {
    throw new OnboardingProvisioningError(toOnboardingDataErrorMessage(error), 500)
  }
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function mergeSection(args: {
  baseContent: string
  start: string
  end: string
  sectionBody: string
}): string {
  const section = `${args.start}\n${args.sectionBody.trimEnd()}\n${args.end}`
  const pattern = new RegExp(`${escapeForRegExp(args.start)}[\\s\\S]*?${escapeForRegExp(args.end)}`, "m")

  if (pattern.test(args.baseContent)) {
    return args.baseContent.replace(pattern, section)
  }

  const trimmed = args.baseContent.trimEnd()
  if (!trimmed) {
    return `${section}\n`
  }

  return `${trimmed}\n\n${section}\n`
}

function formatKnowledgeSourcesMarkdown(sources: KnowledgeSource[]): string {
  if (sources.length === 0) return "- none"

  return sources
    .map((source) => {
      if (source.type === "url") {
        return `- url: ${source.value}`
      }

      return `- file: ${source.name} (${source.size} bytes)`
    })
    .join("\n")
}

function formatChannelsMarkdown(channels: Array<"whatsapp" | "telegram">): string {
  if (channels.length === 0) return "- none"
  return channels.map((channel) => `- ${channel}`).join("\n")
}

function buildOnboardingProfileMarkdown(args: {
  agentId: string
  runtimeAgentName: string
  input: CompleteOnboardingInput
}): string {
  const userName = normalizeText(args.input.userName) ?? "not provided"
  const agentName = normalizeText(args.input.agentName) ?? "not provided"
  const agentDescription = normalizeText(args.input.agentDescription) ?? "not provided"
  const sources = sanitizeKnowledgeSources(args.input.knowledgeSources)
  const channels = sanitizeChannels(args.input.channels)

  return `# Onboarding Profile

Generated from onboarding completion. Update as needed.

## Agent Binding
- Runtime agent id: ${args.agentId}
- Runtime agent name: ${args.runtimeAgentName}
- Preferred agent name: ${agentName}

## User Context
- User name: ${userName}
- Requested mission: ${agentDescription}

## Knowledge Sources
${formatKnowledgeSourcesMarkdown(sources)}

## Preferred Channels
${formatChannelsMarkdown(channels)}
`
}

function buildUserSectionMarkdown(args: {
  agentId: string
  runtimeAgentName: string
  input: CompleteOnboardingInput
}): string {
  const userName = normalizeText(args.input.userName) ?? "not provided"
  const agentName = normalizeText(args.input.agentName) ?? "not provided"
  const agentDescription = normalizeText(args.input.agentDescription) ?? "not provided"
  const channels = sanitizeChannels(args.input.channels)

  return `## Onboarding Profile
- runtime agent id: ${args.agentId}
- runtime agent name: ${args.runtimeAgentName}
- preferred agent name: ${agentName}
- user name: ${userName}
- mission: ${agentDescription}
- preferred channels: ${channels.length > 0 ? channels.join(", ") : "none"}
- full details: ONBOARDING_PROFILE.md`
}

function buildIdentitySectionMarkdown(args: {
  runtimeAgentName: string
  input: CompleteOnboardingInput
}): string {
  const preferredName = normalizeText(args.input.agentName) ?? args.runtimeAgentName
  const mission = normalizeText(args.input.agentDescription) ?? "not provided"

  return `## Onboarding Identity
- Preferred name: ${preferredName}
- Mission focus: ${mission}`
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

async function ensureReadableDirectory(dirPath: string): Promise<boolean> {
  try {
    await access(dirPath, fsConstants.R_OK | fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

async function hasAnyTemplateMarkdownFile(dirPath: string): Promise<boolean> {
  for (const fileName of BASE_WORKSPACE_MARKDOWN_FILES) {
    if (await fileExists(path.join(dirPath, fileName))) {
      return true
    }
  }

  return false
}

async function resolveTemplateWorkspacePath(args: {
  agentId: string
  runtimeWorkspacePath?: string | null
}): Promise<string | null> {
  const candidates: string[] = []

  const addWorkspaceCandidates = (workspacePath: string | null | undefined) => {
    const candidate = workspacePath?.trim() ?? ""
    if (!candidate || !path.isAbsolute(candidate)) return

    candidates.push(path.join(candidate, args.agentId))
    candidates.push(candidate)
  }

  addWorkspaceCandidates(args.runtimeWorkspacePath)

  if (candidates.length === 0) {
    try {
      const payload = await listOpenClawAgents()
      const runtimeAgent = payload.agents.find((agent) => agent.id === args.agentId)
      addWorkspaceCandidates(runtimeAgent?.workspace)
    } catch {
      return null
    }
  }

  let firstReadable: string | null = null

  for (const candidate of Array.from(new Set(candidates.map((entry) => path.resolve(entry))))) {
    if (!await ensureReadableDirectory(candidate)) continue
    if (!firstReadable) firstReadable = candidate

    if (await hasAnyTemplateMarkdownFile(candidate)) {
      return candidate
    }
  }

  return firstReadable
}

async function copyTemplateMarkdownFiles(args: {
  agentId: string
  targetWorkspacePath: string
  runtimeWorkspacePath?: string | null
}): Promise<string | null> {
  const templateWorkspacePath = await resolveTemplateWorkspacePath({
    agentId: args.agentId,
    runtimeWorkspacePath: args.runtimeWorkspacePath,
  })

  if (!templateWorkspacePath || path.resolve(templateWorkspacePath) === path.resolve(args.targetWorkspacePath)) {
    return templateWorkspacePath
  }

  for (const fileName of BASE_WORKSPACE_MARKDOWN_FILES) {
    const sourcePath = path.join(templateWorkspacePath, fileName)
    const targetPath = path.join(args.targetWorkspacePath, fileName)

    if (!await fileExists(sourcePath)) continue
    if (await fileExists(targetPath)) continue

    await copyFile(sourcePath, targetPath)
  }

  return templateWorkspacePath
}

async function upsertMarkdownFileSection(args: {
  filePath: string
  headerWhenMissing: string
  start: string
  end: string
  sectionBody: string
}): Promise<void> {
  let baseContent = ""

  if (await fileExists(args.filePath)) {
    baseContent = await readFile(args.filePath, "utf8")
  } else {
    baseContent = `${args.headerWhenMissing}\n`
  }

  const nextContent = mergeSection({
    baseContent,
    start: args.start,
    end: args.end,
    sectionBody: args.sectionBody,
  })

  await writeFile(args.filePath, nextContent, "utf8")
}

export async function applyOnboardingWorkspaceFlavor(args: {
  agentId: string
  runtimeAgentName: string
  runtimeWorkspacePath?: string | null
  workspacePath: string
  input: CompleteOnboardingInput
}): Promise<void> {
  try {
    await copyTemplateMarkdownFiles({
      agentId: args.agentId,
      targetWorkspacePath: args.workspacePath,
      runtimeWorkspacePath: args.runtimeWorkspacePath,
    })

    const onboardingProfilePath = path.join(args.workspacePath, "ONBOARDING_PROFILE.md")
    await writeFile(
      onboardingProfilePath,
      buildOnboardingProfileMarkdown({
        agentId: args.agentId,
        runtimeAgentName: args.runtimeAgentName,
        input: args.input,
      }),
      "utf8",
    )

    const userMdPath = path.join(args.workspacePath, "USER.md")
    await upsertMarkdownFileSection({
      filePath: userMdPath,
      headerWhenMissing: "# USER.md",
      start: USER_ONBOARDING_START,
      end: USER_ONBOARDING_END,
      sectionBody: buildUserSectionMarkdown({
        agentId: args.agentId,
        runtimeAgentName: args.runtimeAgentName,
        input: args.input,
      }),
    })

    const identityMdPath = path.join(args.workspacePath, "IDENTITY.md")
    await upsertMarkdownFileSection({
      filePath: identityMdPath,
      headerWhenMissing: "# IDENTITY.md",
      start: IDENTITY_ONBOARDING_START,
      end: IDENTITY_ONBOARDING_END,
      sectionBody: buildIdentitySectionMarkdown({
        runtimeAgentName: args.runtimeAgentName,
        input: args.input,
      }),
    })
  } catch (error) {
    const reason = error instanceof Error && error.message ? ` ${error.message}` : ""
    throw new OnboardingProvisioningError(`Failed to apply onboarding workspace flavor.${reason}`, 500)
  }
}
