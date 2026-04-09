import type {
  CatalogAgent,
  CreateOpenClawAgentRequest,
  DeleteOpenClawAgentResponse,
  GetOpenClawAgentCoreFilesResponse,
  ListOpenClawAgentsResponse,
  UpdateOpenClawAgentOnboardingProfileRequest,
} from "./contracts"

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
): Promise<{ agent: CatalogAgent; metadataWarning?: string | null }> {
  const response = await fetch("/api/openclaw/agents", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  })

  return parseResponse<{ agent: CatalogAgent; metadataWarning?: string | null }>(response)
}

export async function updateOpenClawAgentOnboardingProfile(
  input: UpdateOpenClawAgentOnboardingProfileRequest,
): Promise<{ agent: CatalogAgent }> {
  const response = await fetch("/api/openclaw/agents", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  })

  return parseResponse<{ agent: CatalogAgent }>(response)
}

export async function deleteOpenClawAgent(agentId: string): Promise<DeleteOpenClawAgentResponse> {
  const query = new URLSearchParams({ id: agentId })
  const response = await fetch(`/api/openclaw/agents?${query.toString()}`, {
    method: "DELETE",
  })
  return parseResponse<DeleteOpenClawAgentResponse>(response)
}

export async function fetchOpenClawAgentCoreFiles(agentId: string): Promise<GetOpenClawAgentCoreFilesResponse> {
  const encodedAgentId = encodeURIComponent(agentId)
  const response = await fetch(`/api/openclaw/agents/${encodedAgentId}/core-files`, {
    cache: "no-store",
  })
  return parseResponse<GetOpenClawAgentCoreFilesResponse>(response)
}
