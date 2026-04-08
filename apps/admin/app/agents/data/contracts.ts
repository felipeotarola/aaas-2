export type CatalogAgent = {
  id: string
  name: string
  type: "custom"
  aiProvider: "openclaw"
  aiModel: string
  version: "openclaw"
  status: "published" | "draft" | "paused"
  activeUsers: number
  workspace: string
}

export type ActiveConsumerAgentSubscription = {
  userId: string
  userEmail: string
  userName: string
  agentId: string
  agentName: string
  workspaceRef: string | null
  updatedAt: string
}

export type ListOpenClawAgentsResponse = {
  agents: CatalogAgent[]
  defaultModel: string | null
  availableModels: string[]
  activeSubscriptions?: ActiveConsumerAgentSubscription[]
  subscriptionsError?: string | null
}

export type CreateOpenClawAgentRequest = {
  name: string
  id?: string
  model?: string
}

export type DeleteOpenClawAgentResponse = {
  deleted: {
    id: string
  }
}

export type AgentCoreFileKind =
  | "AGENTS"
  | "SOUL"
  | "TOOLS"
  | "IDENTITY"
  | "USER"
  | "HEARTBEAT"
  | "BOOTSTRAP"
  | "MEMORY"

export type AgentCoreFile = {
  kind: AgentCoreFileKind
  fileName: string
  resolvedPath: string | null
  exists: boolean
  content: string
  truncated: boolean
  error: string | null
}

export type GetOpenClawAgentCoreFilesResponse = {
  agent: CatalogAgent
  workspacePath: string | null
  coreFiles: AgentCoreFile[]
}
