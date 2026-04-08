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

export type TelegramDmPolicy = "pairing" | "allowlist" | "open" | "disabled"

export type ConsumerTelegramConnection = {
  connected: boolean
  accountId: string
  botId: number | null
  botUsername: string | null
  botDisplayName: string | null
  tokenHint: string | null
  webhookUrl: string | null
  webhookConfigured: boolean
  dmPolicy: TelegramDmPolicy
  allowFrom: string[]
  requireMention: boolean
  connectedAt: string | null
  disconnectedAt: string | null
  lastVerifiedAt: string | null
}

export type ConsumerWhatsAppConnection = {
  connected: boolean
  accountId: string
  linkedIdentity: string | null
  lastLoginMessage: string | null
  connectedAt: string | null
  disconnectedAt: string | null
  lastVerifiedAt: string | null
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

export type ChatWithConsumerAgentRequest = {
  agentId: string
  message: string
  sessionId?: string | null
}

export type ChatWithConsumerAgentResponse = {
  chat: {
    agentId: string
    reply: string
    sessionId: string | null
    runId: string | null
    model: string | null
    provider: string | null
  }
}

export type ConnectConsumerAgentTelegramRequest = {
  agentId: string
  botToken: string
  accountId?: string
  webhookUrl?: string | null
  dmPolicy?: TelegramDmPolicy
  allowFrom?: string[]
  requireMention?: boolean
}

export type ConnectConsumerAgentTelegramResponse = {
  telegram: ConsumerTelegramConnection
}

export type DisconnectConsumerAgentTelegramRequest = {
  agentId: string
}

export type DisconnectConsumerAgentTelegramResponse = {
  telegram: ConsumerTelegramConnection
}

export type StartConsumerAgentWhatsAppLoginRequest = {
  agentId: string
  accountId?: string
  timeoutMs?: number
  force?: boolean
}

export type WaitConsumerAgentWhatsAppLoginRequest = {
  agentId: string
  accountId?: string
  timeoutMs?: number
}

export type DisconnectConsumerAgentWhatsAppRequest = {
  agentId: string
  accountId?: string
}

export type ConsumerAgentWhatsAppLoginPayload = {
  connected: boolean
  message: string
  qrDataUrl: string | null
}

export type StartConsumerAgentWhatsAppLoginResponse = {
  whatsapp: ConsumerWhatsAppConnection
  login: ConsumerAgentWhatsAppLoginPayload
}

export type WaitConsumerAgentWhatsAppLoginResponse = {
  whatsapp: ConsumerWhatsAppConnection
  login: ConsumerAgentWhatsAppLoginPayload
}

export type DisconnectConsumerAgentWhatsAppResponse = {
  whatsapp: ConsumerWhatsAppConnection
}
