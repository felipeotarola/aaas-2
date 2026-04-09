import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import type { OnboardingAgent } from "../domain/types"

type RuntimeAgent = {
  id: string
  name: string
  aiModel: string
  status: "published" | "draft" | "paused"
  workspace: string
}

type RuntimeAgentsResponse = {
  agents: RuntimeAgent[]
}

type ConsumerAgentSettingsRow = {
  agentId: string
  isActive: boolean
}

type ConsumerAgentSettingsResponse = {
  settings: ConsumerAgentSettingsRow[]
}

type AssistantMetadataRow = {
  id: string
  runtime_agent_id: string | null
  role_label: string | null
  primary_channel: string | null
}

type AssistantMetadata = {
  roleLabel: string | null
  primaryChannel: string | null
}

type AgentCatalogMetadataRow = {
  agent_id: string
  description: string | null
  capabilities: string[] | null
}

type AgentCatalogMetadata = {
  description: string | null
  capabilities: string[]
}

const ICON_PALETTE: OnboardingAgent["icon"][] = [
  "bot",
  "code",
  "briefcase",
  "megaphone",
  "graduation",
  "shield",
  "heart",
  "pencil",
]

const COLOR_PALETTE = [
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-violet-500 to-purple-500",
  "from-rose-500 to-pink-500",
  "from-cyan-500 to-blue-500",
  "from-slate-500 to-zinc-500",
  "from-lime-500 to-emerald-500",
]

function normalizeRuntimeAgent(input: unknown): RuntimeAgent | null {
  if (!input || typeof input !== "object") return null

  const row = input as Record<string, unknown>
  const id = typeof row.id === "string" ? row.id.trim() : ""
  const name = typeof row.name === "string" ? row.name.trim() : ""
  const aiModel = typeof row.aiModel === "string" ? row.aiModel.trim() : ""
  const workspace = typeof row.workspace === "string" ? row.workspace.trim() : ""
  const statusRaw = typeof row.status === "string" ? row.status.trim() : "draft"

  if (!id || !name) return null

  const status: RuntimeAgent["status"] =
    statusRaw === "published" || statusRaw === "paused" || statusRaw === "draft"
      ? statusRaw
      : "draft"

  return {
    id,
    name,
    aiModel: aiModel || "openclaw",
    status,
    workspace: workspace || "default",
  }
}

function isSelectableOnboardingRuntimeAgent(agent: RuntimeAgent): boolean {
  const normalizedId = agent.id.trim().toLowerCase()
  const normalizedName = agent.name.trim().toLowerCase()

  // "main" is the orchestrator/system agent and should not be user-selectable.
  return normalizedId !== "main" && normalizedName !== "main"
}

async function fetchRuntimeAgents(): Promise<RuntimeAgent[]> {
  const response = await fetch("/api/openclaw/agents", { cache: "no-store" })
  const payload = (await response.json().catch(() => null)) as RuntimeAgentsResponse & { error?: string } | null

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load runtime agents")
  }

  const rows = Array.isArray(payload?.agents) ? payload.agents : []
  return rows.map((row) => normalizeRuntimeAgent(row)).filter((row): row is RuntimeAgent => row !== null)
}

async function fetchActiveAgentIds(): Promise<Set<string>> {
  try {
    const response = await fetch("/api/consumer/agents/settings", { cache: "no-store" })
    const payload = (await response.json().catch(() => null)) as
      | (ConsumerAgentSettingsResponse & { error?: string })
      | null

    if (!response.ok) {
      return new Set()
    }

    const rows = Array.isArray(payload?.settings) ? payload.settings : []
    const activeAgentIds = rows
      .filter((row) => row?.isActive === true)
      .map((row) => (typeof row.agentId === "string" ? row.agentId.trim() : ""))
      .filter(Boolean)

    return new Set(activeAgentIds)
  } catch {
    return new Set()
  }
}

async function fetchAssistantsMetadata(): Promise<Map<string, AssistantMetadata>> {
  try {
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("assistants")
      .select("id, runtime_agent_id, role_label, primary_channel")
      .limit(250)
      .returns<AssistantMetadataRow[]>()

    if (error || !data) {
      return new Map()
    }

    const map = new Map<string, AssistantMetadata>()

    for (const row of data) {
      const metadata: AssistantMetadata = {
        roleLabel: row.role_label,
        primaryChannel: row.primary_channel,
      }

      if (row.runtime_agent_id) {
        map.set(row.runtime_agent_id, metadata)
      }

      // Fallback for rows where runtime id is not set yet.
      map.set(row.id, metadata)
    }

    return map
  } catch {
    return new Map()
  }
}

function normalizeCapabilityList(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return []

  const items = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0)
    .slice(0, 8)

  return Array.from(new Set(items))
}

async function fetchAgentCatalogMetadata(): Promise<Map<string, AgentCatalogMetadata>> {
  try {
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase
      .from("agent_catalog_metadata")
      .select("agent_id, description, capabilities")
      .limit(300)
      .returns<AgentCatalogMetadataRow[]>()

    if (error || !data) {
      return new Map()
    }

    const map = new Map<string, AgentCatalogMetadata>()

    for (const row of data) {
      const agentId = typeof row.agent_id === "string" ? row.agent_id.trim() : ""
      if (!agentId) continue

      map.set(agentId, {
        description: typeof row.description === "string" ? row.description.trim() : null,
        capabilities: normalizeCapabilityList(row.capabilities),
      })
    }

    return map
  } catch {
    return new Map()
  }
}

function stableIndex(key: string, total: number): number {
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash << 5) - hash + key.charCodeAt(i)
    hash |= 0
  }

  return Math.abs(hash) % total
}

function inferCategory(id: string, name: string, roleLabel: string | null): string {
  const haystack = `${id} ${name} ${roleLabel ?? ""}`.toLowerCase()

  if (haystack.includes("security")) return "Security"
  if (haystack.includes("research") || haystack.includes("analyst")) return "Research"
  if (haystack.includes("sales")) return "Sales"
  if (haystack.includes("support")) return "Support"
  if (haystack.includes("market")) return "Marketing"
  if (haystack.includes("code") || haystack.includes("dev")) return "Engineering"

  return "Assistant"
}

function buildDefaultDescription(args: {
  agent: RuntimeAgent
  category: string
  catalogDescription: string | null
  roleLabel: string | null
}): string {
  const catalogDescription = args.catalogDescription?.trim() ?? ""
  if (catalogDescription) {
    return catalogDescription
  }

  if (args.roleLabel?.trim()) {
    return args.roleLabel.trim()
  }

  return `${args.category} agent running on ${args.agent.aiModel}.`
}

function buildCapabilities(args: {
  category: string
  primaryChannel: string | null
  catalogCapabilities: string[]
}): string[] {
  if (args.catalogCapabilities.length > 0) {
    const explicit = [...args.catalogCapabilities]
    if (args.primaryChannel) {
      explicit.push(`${args.primaryChannel} integration`)
    }
    return Array.from(new Set(explicit)).slice(0, 4)
  }

  const defaultCapabilities = ["Task assistance", "Workflow automation", "General Q&A"]
  const baseByCategory: Record<string, string[]> = {
    Security: ["Vulnerability scanning", "Config auditing", "Compliance checks"],
    Research: ["Web research", "Insight synthesis", "Brief generation"],
    Sales: ["Lead qualification", "Outreach support", "Follow-up automation"],
    Support: ["Customer triage", "FAQ handling", "Issue routing"],
    Marketing: ["Campaign support", "Content planning", "Audience insights"],
    Engineering: ["Code assistance", "Technical troubleshooting", "Documentation"],
    Assistant: defaultCapabilities,
  }

  const capabilities = [...(baseByCategory[args.category] ?? defaultCapabilities)]

  if (args.primaryChannel) {
    capabilities.push(`${args.primaryChannel} integration`)
  }

  return Array.from(new Set(capabilities)).slice(0, 4)
}

function buildSuggestions(category: string): string[] {
  const defaultSuggestions = [
    "Help me plan today's priorities",
    "Summarize this thread into action items",
    "Draft a professional response",
  ]
  const byCategory: Record<string, string[]> = {
    Security: [
      "Audit this setup for security gaps",
      "List the top vulnerabilities we should fix first",
      "Build a hardening checklist for this environment",
    ],
    Research: [
      "Research competitors and summarize key differences",
      "Create a short brief from these sources",
      "Find credible references for this topic",
    ],
    Sales: [
      "Qualify this lead based on our criteria",
      "Draft a follow-up message for this prospect",
      "Prioritize high-intent opportunities",
    ],
    Support: [
      "Draft a helpful customer reply",
      "Classify this issue and suggest next steps",
      "Summarize open support pain points",
    ],
    Marketing: [
      "Draft campaign copy for this launch",
      "Suggest message variations for this audience",
      "Build a weekly content outline",
    ],
    Engineering: [
      "Review this code for issues",
      "Help debug this runtime error",
      "Generate docs for this module",
    ],
    Assistant: defaultSuggestions,
  }

  return byCategory[category] ?? defaultSuggestions
}

export async function fetchOnboardingAgents(): Promise<OnboardingAgent[]> {
  const [runtimeAgents, metadata, catalogMetadata, activeAgentIds] = await Promise.all([
    fetchRuntimeAgents(),
    fetchAssistantsMetadata(),
    fetchAgentCatalogMetadata(),
    fetchActiveAgentIds(),
  ])

  return runtimeAgents.filter(isSelectableOnboardingRuntimeAgent).map((agent) => {
    const meta = metadata.get(agent.id)
    const catalogMeta = catalogMetadata.get(agent.id)
    const category = inferCategory(agent.id, agent.name, meta?.roleLabel ?? null)
    const icon = ICON_PALETTE[stableIndex(agent.id, ICON_PALETTE.length)] ?? "bot"
    const color = COLOR_PALETTE[stableIndex(`${agent.id}-color`, COLOR_PALETTE.length)] ?? "from-sky-500 to-indigo-500"

    return {
      id: agent.id,
      name: agent.name,
      description: buildDefaultDescription({
        agent,
        category,
        catalogDescription: catalogMeta?.description ?? null,
        roleLabel: meta?.roleLabel ?? null,
      }),
      icon,
      color,
      category,
      capabilities: buildCapabilities({
        category,
        primaryChannel: meta?.primaryChannel ?? null,
        catalogCapabilities: catalogMeta?.capabilities ?? [],
      }),
      suggestions: buildSuggestions(category),
      aiModel: agent.aiModel,
      status: agent.status,
      workspace: agent.workspace,
      primaryChannel: meta?.primaryChannel ?? null,
      isAlreadySelected: activeAgentIds.has(agent.id),
    }
  })
}
