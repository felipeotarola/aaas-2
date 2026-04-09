"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Bot, Check, Globe, Paperclip, User, X } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { ChannelChoice, KnowledgeSource, OnboardingAgent } from "../domain/types"

// ─── Message type ───────────────────────────────────

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  type?: "choice" | "confirmation"
  options?: { label: string; value: string }[]
}

export function makeMsg(
  role: ChatMessage["role"],
  content: string,
  extra?: Pick<ChatMessage, "type" | "options">,
): ChatMessage {
  return { id: `${role}-${Date.now()}-${Math.random()}`, role, content, ...extra }
}

// ─── Animated message bubble ────────────────────────

export function MessageBubble({
  message,
  agent,
  onChoiceSelect,
  onConfirm,
  onRestart,
}: {
  message: ChatMessage
  agent?: OnboardingAgent
  onChoiceSelect?: (value: string) => void
  onConfirm?: () => void
  onRestart?: () => void
}) {
  const isUser = message.role === "user"

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : agent?.color
              ? `bg-gradient-to-br ${agent.color}`
              : "bg-muted text-muted-foreground",
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4 text-white" />}
      </div>

      <div className="max-w-[80%] space-y-3">
        <div
          className={cn(
            "whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          )}
        >
          {message.content}
        </div>

        {message.type === "choice" && message.options ? (
          <div className="flex flex-wrap gap-2">
            {message.options.map((opt) => (
              <Button
                key={opt.value}
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => onChoiceSelect?.(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        ) : null}

        {message.type === "confirmation" ? (
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={onConfirm} className="gap-1.5">
              <Check className="size-3.5" />
              Confirm &amp; Start
            </Button>
            <Button size="sm" variant="outline" onClick={onRestart}>
              Start Over
            </Button>
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}

// ─── Typing indicator ───────────────────────────────

export function TypingIndicator({ agent }: { agent?: OnboardingAgent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex gap-3"
    >
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          agent?.color ? `bg-gradient-to-br ${agent.color}` : "bg-muted",
        )}
      >
        <Bot className="size-4 text-white" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-2.5">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:150ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:300ms]" />
      </div>
    </motion.div>
  )
}

// ─── Knowledge source pill ──────────────────────────

export function SourcePill({
  source,
  onRemove,
}: {
  source: KnowledgeSource
  onRemove: () => void
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-xs">
      {source.type === "url" ? (
        <Globe className="size-3 text-muted-foreground" />
      ) : (
        <Paperclip className="size-3 text-muted-foreground" />
      )}
      <span className="max-w-[200px] truncate">
        {source.type === "url" ? source.value : source.name}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}

// ─── Channel card ───────────────────────────────────

const CHANNEL_META: Record<ChannelChoice, { label: string; color: string }> = {
  whatsapp: { label: "WhatsApp", color: "#25D366" },
  telegram: { label: "Telegram", color: "#0088cc" },
}

export function ChannelCard({
  channel,
  selected,
  onToggle,
}: {
  channel: ChannelChoice
  selected: boolean
  onToggle: () => void
}) {
  const meta = CHANNEL_META[channel]

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative flex items-center gap-3 rounded-xl border-2 p-4 transition-all",
        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
      )}
    >
      <div
        className="flex size-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${meta.color}20` }}
      >
        {channel === "whatsapp" ? (
          <WhatsAppIcon color={meta.color} />
        ) : (
          <TelegramIcon color={meta.color} />
        )}
      </div>
      <span className="font-medium">{meta.label}</span>
      {selected ? (
        <div className="absolute right-3 top-3">
          <Check className="size-4 text-primary" />
        </div>
      ) : null}
    </button>
  )
}

function WhatsAppIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.025.506 3.932 1.395 5.608L0 24l6.615-1.332A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.875 0-3.614-.525-5.1-1.432l-.366-.216-3.792.994 1.012-3.697-.238-.378A9.69 9.69 0 012.25 12 9.75 9.75 0 1112 21.75z" />
    </svg>
  )
}

function TelegramIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill={color}>
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}
