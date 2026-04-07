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

export type ListOpenClawAgentsResponse = {
  agents: CatalogAgent[]
  defaultModel: string | null
  availableModels: string[]
}

export type ConsumerAgentSetting = {
  agentId: string
  isActive: boolean
  toolOverrides: Record<string, unknown>
  workspaceRef: string | null
  workspacePath: string | null
  updatedAt: string
}

export type ListConsumerAgentSettingsResponse = {
  settings: ConsumerAgentSetting[]
}

export type UpsertConsumerAgentSettingRequest = {
  agentId: string
  isActive: boolean
  toolOverrides?: Record<string, unknown>
  workspaceRef?: string | null
}

export type UpsertConsumerAgentSettingResponse = {
  setting: ConsumerAgentSetting
}
