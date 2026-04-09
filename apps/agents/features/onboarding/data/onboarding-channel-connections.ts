export type OnboardingTelegramConnection = {
  connected: boolean
  accountId: string
  botId: number | null
  botUsername: string | null
  botDisplayName: string | null
  tokenHint: string | null
  webhookUrl: string | null
  webhookConfigured: boolean
  dmPolicy: "pairing" | "allowlist" | "open" | "disabled"
  allowFrom: string[]
  requireMention: boolean
  connectedAt: string | null
  disconnectedAt: string | null
  lastVerifiedAt: string | null
}

export type OnboardingWhatsAppConnection = {
  connected: boolean
  accountId: string
  linkedIdentity: string | null
  lastLoginMessage: string | null
  connectedAt: string | null
  disconnectedAt: string | null
  lastVerifiedAt: string | null
}

export type OnboardingWhatsAppLoginPayload = {
  connected: boolean
  message: string
  qrDataUrl: string | null
}

type EnsureAgentActiveResponse = {
  setting: {
    agentId: string
    isActive: boolean
  }
}

type ConnectTelegramResponse = {
  telegram: OnboardingTelegramConnection
}

type WhatsAppLoginResponse = {
  whatsapp: OnboardingWhatsAppConnection
  login: OnboardingWhatsAppLoginPayload
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { error?: string } & T

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status})`)
  }

  return payload
}

export async function ensureOnboardingAgentActive(agentId: string): Promise<EnsureAgentActiveResponse> {
  const response = await fetch("/api/consumer/agents/settings", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      agentId,
      isActive: true,
    }),
  })

  return parseResponse<EnsureAgentActiveResponse>(response)
}

export async function connectOnboardingTelegram(input: {
  agentId: string
  botToken: string
  accountId?: string
}): Promise<ConnectTelegramResponse> {
  const response = await fetch("/api/consumer/agents/telegram", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      agentId: input.agentId,
      botToken: input.botToken,
      accountId: input.accountId,
      dmPolicy: "pairing",
      requireMention: true,
    }),
  })

  return parseResponse<ConnectTelegramResponse>(response)
}

export async function startOnboardingWhatsAppLogin(input: {
  agentId: string
  accountId?: string
}): Promise<WhatsAppLoginResponse> {
  const response = await fetch("/api/consumer/agents/whatsapp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      agentId: input.agentId,
      accountId: input.accountId,
    }),
  })

  return parseResponse<WhatsAppLoginResponse>(response)
}

export async function waitOnboardingWhatsAppLogin(input: {
  agentId: string
  accountId?: string
}): Promise<WhatsAppLoginResponse> {
  const response = await fetch("/api/consumer/agents/whatsapp", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      agentId: input.agentId,
      accountId: input.accountId,
    }),
  })

  return parseResponse<WhatsAppLoginResponse>(response)
}
