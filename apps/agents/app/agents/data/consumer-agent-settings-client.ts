import type {
  ListConsumerAgentSettingsResponse,
  UpsertConsumerAgentSettingRequest,
  UpsertConsumerAgentSettingResponse,
} from "./contracts"

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
