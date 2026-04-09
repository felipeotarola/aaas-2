"use client"

import { CheckCircle2, Loader2, MessageCircle, Send } from "lucide-react"
import Image from "next/image"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import type {
  OnboardingTelegramConnection,
  OnboardingWhatsAppConnection,
} from "../data/onboarding-channel-connections"
import type { ChannelChoice } from "../domain/types"

type ChannelConnectStepProps = {
  selectedChannels: ChannelChoice[]
  isPreparing: boolean
  prepareError: string | null
  onRetryPrepare: () => void
  isCompleting: boolean
  onContinue: () => void
  telegram: {
    connection: OnboardingTelegramConnection | null
    botToken: string
    accountId: string
    error: string | null
    isSaving: boolean
    setBotToken: (value: string) => void
    setAccountId: (value: string) => void
    connect: () => void
  }
  whatsApp: {
    connection: OnboardingWhatsAppConnection | null
    accountId: string
    qrDataUrl: string | null
    loginMessage: string | null
    error: string | null
    isSaving: boolean
    isPollingStatus: boolean
    setAccountId: (value: string) => void
    startLogin: () => void
    checkStatus: () => void
  }
}

export function ChannelConnectStep(props: ChannelConnectStepProps) {
  const showTelegram = props.selectedChannels.includes("telegram")
  const showWhatsApp = props.selectedChannels.includes("whatsapp")

  const isBusy = props.isPreparing || props.telegram.isSaving || props.whatsApp.isSaving
  const connectedCount = Number(Boolean(props.telegram.connection?.connected)) + Number(Boolean(props.whatsApp.connection?.connected))
  const selectedCount = props.selectedChannels.length

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <p className="rounded-md border border-muted bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Final step: connect your selected channel clients now. You can still finish onboarding and connect the rest later.
      </p>

      {props.isPreparing ? (
        <p className="flex items-center gap-2 rounded-md border border-muted px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Preparing your agent workspace and channel settings...
        </p>
      ) : null}

      {props.prepareError ? (
        <div className="space-y-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          <p>{props.prepareError}</p>
          <Button size="sm" variant="outline" onClick={props.onRetryPrepare}>
            Retry setup
          </Button>
        </div>
      ) : null}

      {showTelegram ? <TelegramSetupCard {...props.telegram} /> : null}
      {showWhatsApp ? <WhatsAppSetupCard {...props.whatsApp} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p className="text-xs text-muted-foreground">
          Connected {Math.min(connectedCount, selectedCount)} of {selectedCount} selected channel{selectedCount === 1 ? "" : "s"}.
        </p>
        <Button type="button" size="sm" onClick={props.onContinue} disabled={props.isCompleting || isBusy}>
          Continue to summary
        </Button>
      </div>
    </div>
  )
}

type TelegramSetupCardProps = ChannelConnectStepProps["telegram"]

function TelegramSetupCard(props: TelegramSetupCardProps) {
  const connected = Boolean(props.connection?.connected)

  return (
    <article className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Send className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Telegram</h3>
        </div>
        <span className={`inline-flex border px-2 py-0.5 text-xs ${connected ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-muted bg-muted/40 text-muted-foreground"}`}>
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>

      <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
        <li>Open Telegram and start a chat with @BotFather.</li>
        <li>Create a bot with /newbot and copy the token.</li>
        <li>Paste it below and click Connect Telegram.</li>
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
        </div>
      ) : null}

      {props.error ? <p className="text-xs text-red-600 dark:text-red-400">{props.error}</p> : null}

      <div className="grid gap-2 md:grid-cols-2">
        <Input
          type="password"
          value={props.botToken}
          onChange={(event) => props.setBotToken(event.target.value)}
          placeholder="Telegram bot token"
          autoComplete="off"
        />
        <Input
          value={props.accountId}
          onChange={(event) => props.setAccountId(event.target.value)}
          placeholder="Account id (default)"
        />
      </div>

      <Button
        type="button"
        size="sm"
        onClick={props.connect}
        disabled={props.isSaving || props.botToken.trim().length === 0}
      >
        {props.isSaving ? "Connecting..." : "Connect Telegram"}
      </Button>
    </article>
  )
}

type WhatsAppSetupCardProps = ChannelConnectStepProps["whatsApp"]

function WhatsAppSetupCard(props: WhatsAppSetupCardProps) {
  const connected = Boolean(props.connection?.connected)
  const hasQr = Boolean(props.qrDataUrl)

  return (
    <article className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">WhatsApp</h3>
        </div>
        <span className={`inline-flex border px-2 py-0.5 text-xs ${connected ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : hasQr ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-muted bg-muted/40 text-muted-foreground"}`}>
          {connected ? "Connected" : hasQr ? "Waiting for scan" : "Not connected"}
        </span>
      </div>

      <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
        <li>Click Generate QR to create a WhatsApp link code.</li>
        <li>On your phone: WhatsApp → Linked Devices → Link a Device.</li>
        <li>Scan the QR code and wait for verification.</li>
      </ol>

      {props.connection ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="size-3.5" />
            {connected ? "Connected and verified" : "Saved as disconnected"}
          </div>
          <p className="mt-1">Account: {props.connection.accountId}</p>
          {props.connection.linkedIdentity ? <p>Linked identity: {props.connection.linkedIdentity}</p> : null}
        </div>
      ) : null}

      {props.loginMessage ? (
        <p className="rounded-md border border-muted bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {props.loginMessage}
        </p>
      ) : null}

      {props.error ? <p className="text-xs text-red-600 dark:text-red-400">{props.error}</p> : null}

      <Input
        value={props.accountId}
        onChange={(event) => props.setAccountId(event.target.value)}
        placeholder="Account id (default)"
      />

      {props.qrDataUrl ? (
        <div className="flex justify-center rounded-md border bg-background p-3">
          <Image src={props.qrDataUrl} alt="WhatsApp login QR" width={224} height={224} unoptimized />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={props.startLogin} disabled={props.isSaving}>
          {props.isSaving ? <Loader2 className="mr-1 size-4 animate-spin" /> : <MessageCircle className="mr-1 size-4" />}
          {props.isSaving ? "Working..." : hasQr ? "Regenerate QR" : "Generate QR"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={props.checkStatus} disabled={props.isSaving || props.isPollingStatus}>
          {props.isPollingStatus ? "Checking..." : "Check status"}
        </Button>
      </div>
    </article>
  )
}
