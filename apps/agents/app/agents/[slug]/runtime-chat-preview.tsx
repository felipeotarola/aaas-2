"use client"

import * as React from "react"
import { MessageCircle, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

export type RuntimeChatMessage = {
  id: string
  role: "user" | "assistant" | "system"
  text: string
}

type RuntimeChatPreviewProps = {
  isOpen: boolean
  sessionId: string | null
  chatError: string | null
  messages: RuntimeChatMessage[]
  chatInput: string
  isSending: boolean
  onToggle: () => void
  onClose: () => void
  onClear: () => void
  onChatInputChange: (value: string) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

export function RuntimeChatPreview(props: RuntimeChatPreviewProps) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 sm:left-auto sm:right-6">
      {props.isOpen ? (
        <section className="mb-3 max-h-[70vh] overflow-hidden border bg-card shadow-lg sm:w-[380px]">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div>
              <p className="text-sm font-semibold">Runtime Chat Preview</p>
              {props.sessionId ? (
                <p className="max-w-[300px] truncate text-[11px] text-muted-foreground">Session: {props.sessionId}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={props.onClear} disabled={props.isSending}>
                Clear
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={props.onClose}>
                <X className="size-4" />
              </Button>
            </div>
          </div>
          {props.chatError ? <p className="px-3 pt-2 text-sm text-red-600 dark:text-red-400">{props.chatError}</p> : null}
          <div className="max-h-[45vh] space-y-2 overflow-y-auto px-3 py-3">
            {props.messages.map((message) => (
              <article
                key={message.id}
                className={`rounded-md border px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "border-primary/30 bg-primary/5"
                    : message.role === "assistant"
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-muted bg-background text-muted-foreground"
                }`}
              >
                <p className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {message.role === "user" ? "You" : message.role === "assistant" ? "Agent" : "System"}
                </p>
                <p className="whitespace-pre-wrap">{message.text}</p>
              </article>
            ))}
          </div>
          <form onSubmit={props.onSubmit} className="border-t p-3">
            <div className="flex gap-2">
              <Input
                value={props.chatInput}
                onChange={(event) => props.onChatInputChange(event.target.value)}
                placeholder="Type a message to this agent..."
                disabled={props.isSending}
              />
              <Button type="submit" disabled={props.isSending || props.chatInput.trim().length === 0}>
                {props.isSending ? "Sending..." : "Send"}
              </Button>
            </div>
          </form>
        </section>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" onClick={props.onToggle} className="h-12 rounded-full px-4 shadow-lg">
          <MessageCircle className="mr-2 size-4" />
          {props.isOpen ? "Hide Chat" : "Open Chat"}
        </Button>
      </div>
    </div>
  )
}
