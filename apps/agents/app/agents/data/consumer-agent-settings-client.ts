import type {
  ChatWithConsumerAgentRequest,
  ChatWithConsumerAgentResponse,
  ConnectConsumerAgentTelegramRequest,
  ConnectConsumerAgentTelegramResponse,
  DisconnectConsumerAgentTelegramRequest,
  DisconnectConsumerAgentTelegramResponse,
  ListConsumerAgentSettingsResponse,
  UpsertConsumerAgentSettingRequest,
  UpsertConsumerAgentSettingResponse,
} from "./contracts"

export type LaunchConsumerAgentResponse = {
  launch: {
    agentId: string
    workspaceRef: string
    workspacePath: string
    status: "ready"
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { error?: string } & T

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status})`)
  }

  return payload
}

export async function fetchConsumerAgentSettings(): Promise<ListConsumerAgentSettingsResponse> {
  const response = await fetch("/api/consumer/agents/settings", { cache: "no-store" })
  return parseResponse<ListConsumerAgentSettingsResponse>(response)
}

export async function upsertConsumerAgentSetting(
  input: UpsertConsumerAgentSettingRequest,
): Promise<UpsertConsumerAgentSettingResponse> {
  const response = await fetch("/api/consumer/agents/settings", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  })

  return parseResponse<UpsertConsumerAgentSettingResponse>(response)
}

export async function launchConsumerAgent(agentId: string): Promise<LaunchConsumerAgentResponse> {
  const response = await fetch("/api/consumer/agents/launch", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ agentId }),
  })

  return parseResponse<LaunchConsumerAgentResponse>(response)
}

export async function sendConsumerAgentChatMessage(
  input: ChatWithConsumerAgentRequest,
): Promise<ChatWithConsumerAgentResponse> {
  const response = await fetch("/api/consumer/agents/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  })

  return parseResponse<ChatWithConsumerAgentResponse>(response)
}

export async function connectConsumerAgentTelegram(
  input: ConnectConsumerAgentTelegramRequest,
): Promise<ConnectConsumerAgentTelegramResponse> {
  const response = await fetch("/api/consumer/agents/telegram", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  })

  return parseResponse<ConnectConsumerAgentTelegramResponse>(response)
}

export async function disconnectConsumerAgentTelegram(
  input: DisconnectConsumerAgentTelegramRequest,
): Promise<DisconnectConsumerAgentTelegramResponse> {
  const response = await fetch("/api/consumer/agents/telegram", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  })

  return parseResponse<DisconnectConsumerAgentTelegramResponse>(response)
}
