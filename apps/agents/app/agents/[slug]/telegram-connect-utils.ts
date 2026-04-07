import type { ConsumerAgentSetting, ConsumerTelegramConnection, TelegramDmPolicy } from "@/app/agents/data/contracts"

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function asNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null
  }

  return value
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value
  return fallback
}

function normalizeDmPolicy(raw: unknown): TelegramDmPolicy {
  const value = asString(raw)?.toLowerCase()
  if (value === "allowlist" || value === "open" || value === "disabled") {
    return value
  }

  return "pairing"
}

export function parseAllowFromInput(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.slice(0, 64)),
    ),
  )
}

export function parseTelegramConnection(setting: ConsumerAgentSetting | null): ConsumerTelegramConnection | null {
  if (!setting) return null

  const channels = asRecord(setting.toolOverrides.channels)
  const telegram = asRecord(channels.telegram)
  if (Object.keys(telegram).length === 0) {
    return null
  }

  return {
    connected: asBoolean(telegram.connected, false),
    accountId: asString(telegram.accountId) ?? "default",
    botId: asNumber(telegram.botId),
    botUsername: asString(telegram.botUsername),
    botDisplayName: asString(telegram.botDisplayName),
    tokenHint: asString(telegram.tokenHint),
    webhookUrl: asString(telegram.webhookUrl),
    webhookConfigured: asBoolean(telegram.webhookConfigured, false),
    dmPolicy: normalizeDmPolicy(telegram.dmPolicy),
    allowFrom: Array.isArray(telegram.allowFrom)
      ? telegram.allowFrom
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter(Boolean)
      : [],
    requireMention: asBoolean(telegram.requireMention, true),
    connectedAt: asString(telegram.connectedAt),
    disconnectedAt: asString(telegram.disconnectedAt),
    lastVerifiedAt: asString(telegram.lastVerifiedAt),
  }
}
