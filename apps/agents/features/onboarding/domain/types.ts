export type OnboardingStep = "choose-agent" | "chat"

export type OnboardingState = {
  step: OnboardingStep
  selectedAgentId: string | null
}

export type OnboardingAgent = {
  id: string
  name: string
  description: string
  icon: "bot" | "code" | "pencil" | "briefcase" | "heart" | "megaphone" | "graduation" | "shield"
  color: string
  category: string
  capabilities: string[]
  /** Quick-pick suggestions shown during the "describe your agent" step */
  suggestions: string[]
  aiModel: string
  status: "published" | "draft" | "paused"
  workspace: string
  primaryChannel?: string | null
}

/** Data collected during the onboarding chat */
export type OnboardingCollectedData = {
  userName: string | null
  agentName: string | null
  agentDescription: string | null
  knowledgeSources: KnowledgeSource[]
  channels: ChannelChoice[]
}

export type ChannelChoice = "whatsapp" | "telegram"

export type KnowledgeSource =
  | { type: "url"; value: string }
  | { type: "file"; name: string; size: number }

/** The conversation-step ids the chat engine walks through */
export type ChatStepId =
  | "greet"
  | "ask-user-name"
  | "ask-agent-name"
  | "ask-agent-description"
  | "ask-files"
  | "ask-urls"
  | "ask-channels"
  | "connect-channels"
  | "confirm"
  | "done"
