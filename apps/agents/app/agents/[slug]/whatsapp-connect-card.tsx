"use client"

import * as React from "react"
import { CheckCircle2, Loader2, MessageCircle, RefreshCcw } from "lucide-react"
import Image from "next/image"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import type { ConsumerWhatsAppConnection } from "@/app/agents/data/contracts"

type WhatsAppConnectCardProps = {
  connection: ConsumerWhatsAppConnection | null
  accountId: string
  qrDataUrl: string | null
  loginMessage: string | null
  isSaving: boolean
  error: string | null
  onAccountIdChange: (value: string) => void
  onGenerateQr: () => void
  onCheckStatus: () => void
  onDisconnect: () => void
}

export function WhatsAppConnectCard(props: WhatsAppConnectCardProps) {
  const connected = Boolean(props.connection?.connected)
  const hasQr = Boolean(props.qrDataUrl)

  const statusLabel = connected ? "Connected" : hasQr ? "Waiting for scan" : "Not connected"

  const statusClassName = connected
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : hasQr
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-muted bg-muted/40 text-muted-foreground"

  return (
    <article className="flex flex-col gap-4 border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-primary" />
          <h3 className="font-semibold">WhatsApp</h3>
        </div>
        <span className={`inline-flex border px-2 py-0.5 text-xs ${statusClassName}`}>{statusLabel}</span>
      </div>

      <p className="text-sm text-muted-foreground">
        Generate a WhatsApp QR code, scan it from Linked Devices, then confirm connection.
      </p>

      <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
        <li>Set account id (default is usually fine).</li>
        <li>Click Generate QR and scan with WhatsApp → Linked Devices.</li>
        <li>Click Check status until the channel shows connected.</li>
      </ol>

      {props.connection ? (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="size-3.5" />
            {connected ? "Connected and verified" : "Saved as disconnected"}
          </div>
          <p className="mt-1">Account: {props.connection.accountId}</p>
          {props.connection.linkedIdentity ? <p>Linked identity: {props.connection.linkedIdentity}</p> : null}
          {props.connection.lastVerifiedAt ? <p>Last verified: {props.connection.lastVerifiedAt}</p> : null}
        </div>
      ) : null}

      {props.loginMessage ? (
        <p className="rounded-md border border-muted bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{props.loginMessage}</p>
      ) : null}

      {props.error ? <p className="text-sm text-red-600 dark:text-red-400">{props.error}</p> : null}

      <div className="grid gap-1.5">
        <label className="text-xs text-muted-foreground">Account id</label>
        <Input
          value={props.accountId}
          onChange={(event) => props.onAccountIdChange(event.target.value)}
          placeholder="default"
        />
      </div>

      {props.qrDataUrl ? (
        <div className="flex justify-center rounded-md border bg-background p-3">
          <Image src={props.qrDataUrl} alt="WhatsApp login QR" width={224} height={224} unoptimized />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={props.onGenerateQr} disabled={props.isSaving}>
          {props.isSaving ? <Loader2 className="mr-1 size-4 animate-spin" /> : <MessageCircle className="mr-1 size-4" />}
          {props.isSaving ? "Working..." : hasQr ? "Regenerate QR" : "Generate QR"}
        </Button>
        <Button type="button" variant="secondary" onClick={props.onCheckStatus} disabled={props.isSaving}>
          <RefreshCcw className="mr-1 size-4" />
          Check status
        </Button>
        <Button type="button" variant="outline" onClick={props.onDisconnect} disabled={props.isSaving || !props.connection}>
          Disconnect
        </Button>
      </div>
    </article>
  )
}
