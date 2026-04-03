import type { CatalogAgent, CreateOpenClawAgentRequest, ListOpenClawAgentsResponse } from "./contracts"

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { error?: string } & T

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status})`)
  }

  return payload
}

export async function fetchOpenClawAgents(): Promise<ListOpenClawAgentsResponse> {
  const response = await fetch("/api/openclaw/agents", { cache: "no-store" })
  return parseResponse<ListOpenClawAgentsResponse>(response)
}

export async function createOpenClawAgent(
  input: CreateOpenClawAgentRequest,
): Promise<{ agent: CatalogAgent }> {
  const response = await fetch("/api/openclaw/agents", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  })

  return parseResponse<{ agent: CatalogAgent }>(response)
}
