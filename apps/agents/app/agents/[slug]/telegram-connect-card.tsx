"use client"

import * as React from "react"
import { CheckCircle2, Send } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import type { ConsumerTelegramConnection, TelegramDmPolicy } from "@/app/agents/data/contracts"

type TelegramConnectCardProps = {
  connection: ConsumerTelegramConnection | null
  botToken: string
  accountId: string
  webhookUrl: string
  allowFrom: string
  dmPolicy: TelegramDmPolicy
  requireMention: boolean
  isSaving: boolean
  error: string | null
  onBotTokenChange: (value: string) => void
  onAccountIdChange: (value: string) => void
  onWebhookUrlChange: (value: string) => void
  onAllowFromChange: (value: string) => void
  onDmPolicyChange: (value: TelegramDmPolicy) => void
  onRequireMentionChange: (value: boolean) => void
  onConnect: () => void
  onDisconnect: () => void
}

const dmPolicyDescriptions: Record<TelegramDmPolicy, string> = {
  pairing: "Recommended for DMs. New users must be approved via pairing code.",
  allowlist: "Only Telegram user IDs in allowFrom can DM this bot.",
  open: "Any Telegram user can DM the bot. Use carefully.",
  disabled: "DMs are blocked.",
}

export function TelegramConnectCard(props: TelegramConnectCardProps) {
  const connected = Boolean(props.connection?.connected)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    props.onConnect()
  }

  return (
    <article className="flex flex-col gap-4 border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Send className="size-4 text-primary" />
          <h3 className="font-semibold">Telegram</h3>
        </div>
        <span
          className={`inline-flex border px-2 py-0.5 text-xs ${
            connected
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-muted bg-muted/40 text-muted-foreground"
          }`}
        >
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        Connect your Telegram bot with a guided setup aligned with OpenClaw defaults.
      </p>

      <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
        <li>Create a bot in @BotFather and copy the token.</li>
        <li>Paste token below and choose DM policy.</li>
        <li>Optionally provide webhook URL, then click Connect + Verify.</li>
      </ol>

      {props.connection ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="size-3.5" />
            {connected ? "Connected and verified" : "Saved as disconnected"}
          </div>
          <p className="mt-1">
            Bot: {props.connection.botUsername ? `@${props.connection.botUsername}` : "unknown"}
            {props.connection.botId ? ` (id: ${props.connection.botId})` : ""}
          </p>
          <p>
            Account: {props.connection.accountId} · Token: {props.connection.tokenHint ?? "not stored"}
          </p>
          {props.connection.lastVerifiedAt ? <p>Last verified: {props.connection.lastVerifiedAt}</p> : null}
        </div>
      ) : null}

      {props.error ? <p className="text-sm text-red-600 dark:text-red-400">{props.error}</p> : null}

      <form onSubmit={handleSubmit} className="grid gap-3">
        <div className="grid gap-1.5">
          <label className="text-xs text-muted-foreground">Bot token</label>
          <Input
            type="password"
            value={props.botToken}
            onChange={(event) => props.onBotTokenChange(event.target.value)}
            placeholder="123456789:AA..."
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            Token is verified with Telegram and sent to OpenClaw runtime; this page only keeps a masked hint.
          </p>
        </div>

        <div className="grid gap-1.5 md:grid-cols-2 md:gap-3">
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Account id</label>
            <Input
              value={props.accountId}
              onChange={(event) => props.onAccountIdChange(event.target.value)}
              placeholder="default"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Webhook URL (optional)</label>
            <Input
              value={props.webhookUrl}
              onChange={(event) => props.onWebhookUrlChange(event.target.value)}
              placeholder="https://example.com/hooks/telegram"
            />
          </div>
        </div>

        <div className="grid gap-1.5 md:grid-cols-2 md:gap-3">
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">DM policy</label>
            <select
              className="h-9 border bg-background px-2 text-sm"
              value={props.dmPolicy}
              onChange={(event) => props.onDmPolicyChange(event.target.value as TelegramDmPolicy)}
            >
              <option value="pairing">pairing</option>
              <option value="allowlist">allowlist</option>
              <option value="open">open</option>
              <option value="disabled">disabled</option>
            </select>
            <p className="text-xs text-muted-foreground">{dmPolicyDescriptions[props.dmPolicy]}</p>
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Allow-from user IDs (comma separated)</label>
            <Input
              value={props.allowFrom}
              onChange={(event) => props.onAllowFromChange(event.target.value)}
              placeholder="8734062810, 745123456"
            />
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={props.requireMention}
            onChange={(event) => props.onRequireMentionChange(event.target.checked)}
          />
          Require mentions in group chats
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={props.isSaving || props.botToken.trim().length === 0}>
            {props.isSaving ? "Connecting..." : "Connect + Verify"}
          </Button>
          <Button type="button" variant="secondary" onClick={props.onDisconnect} disabled={props.isSaving || !connected}>
            {props.isSaving ? "Saving..." : "Disconnect"}
          </Button>
        </div>
      </form>
    </article>
  )
}
