"use client"

import * as React from "react"
import Link from "next/link"
import { Bot, CheckCircle2, MessageCircle, Play, Smartphone, X } from "lucide-react"
import { useParams } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { AppShell } from "@workspace/ui/components/app-shell"
import {
  connectConsumerAgentTelegram,
  disconnectConsumerAgentTelegram,
  fetchConsumerAgentSettings,
  launchConsumerAgent,
  sendConsumerAgentChatMessage,
} from "@/app/agents/data/consumer-agent-settings-client"
import type { ConsumerAgentSetting, ConsumerTelegramConnection, TelegramDmPolicy } from "@/app/agents/data/contracts"
import { useSidebarUser } from "@/lib/auth/use-sidebar-user"
import { defaultAgentsSidebarUser, getConsumerSidebar } from "../data"
import { TelegramConnectCard } from "./telegram-connect-card"
import { parseAllowFromInput, parseTelegramConnection } from "./telegram-connect-utils"

type Channel = {
  key: "whatsapp" | "email" | "webchat"
  label: string
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

type ChatMessage = {
  id: string
  role: "user" | "assistant" | "system"
  text: string
}

const channels: Channel[] = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    description: "Connect business sender and route conversations to this agent.",
    icon: MessageCircle,
  },
  {
    key: "email",
    label: "Email",
    description: "Enable inbound support email handling and auto-responses.",
    icon: Smartphone,
  },
  {
    key: "webchat",
    label: "Web Chat",
    description: "Embed agent widget in your app for live chat experiences.",
    icon: Bot,
  },
]

function buildChatMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export default function ConsumerAgentDetailPage() {
  const sidebarUser = useSidebarUser(defaultAgentsSidebarUser)
  const params = useParams<{ slug: string }>()
  const slug = params?.slug ?? "unknown-agent"
  const [isAllowed, setIsAllowed] = React.useState<boolean | null>(null)
  const [activeSetting, setActiveSetting] = React.useState<ConsumerAgentSetting | null>(null)
  const [accessError, setAccessError] = React.useState<string | null>(null)
  const [telegramConnection, setTelegramConnection] = React.useState<ConsumerTelegramConnection | null>(null)
  const [telegramBotToken, setTelegramBotToken] = React.useState("")
  const [telegramAccountId, setTelegramAccountId] = React.useState("default")
  const [telegramWebhookUrl, setTelegramWebhookUrl] = React.useState("")
  const [telegramAllowFrom, setTelegramAllowFrom] = React.useState("")
  const [telegramDmPolicy, setTelegramDmPolicy] = React.useState<TelegramDmPolicy>("pairing")
  const [telegramRequireMention, setTelegramRequireMention] = React.useState(true)
  const [telegramError, setTelegramError] = React.useState<string | null>(null)
  const [isUpdatingTelegram, setIsUpdatingTelegram] = React.useState(false)
  const [connected, setConnected] = React.useState<Record<string, boolean>>({
    whatsapp: false,
    email: true,
    webchat: true,
  })
  const [launchState, setLaunchState] = React.useState<{ workspacePath: string; status: string } | null>(null)
  const [launchError, setLaunchError] = React.useState<string | null>(null)
  const [isLaunching, setIsLaunching] = React.useState(false)
  const [chatInput, setChatInput] = React.useState("")
  const [chatSessionId, setChatSessionId] = React.useState<string | null>(null)
  const [chatError, setChatError] = React.useState<string | null>(null)
  const [isSendingChat, setIsSendingChat] = React.useState(false)
  const [isChatOpen, setIsChatOpen] = React.useState(false)
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([
    {
      id: buildChatMessageId(),
      role: "system",
      text: "Preview chat is ready. Send a message to test this agent before connecting client channels.",
    },
  ])
  const [displayName, setDisplayName] = React.useState(
    slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  )

  const handleLaunch = async () => {
    setIsLaunching(true)
    setLaunchError(null)

    try {
      const payload = await launchConsumerAgent(slug)
      setLaunchState({
        workspacePath: payload.launch.workspacePath,
        status: payload.launch.status,
      })
    } catch (error) {
      setLaunchState(null)
      setLaunchError(error instanceof Error ? error.message : "Failed to launch agent runtime")
    } finally {
      setIsLaunching(false)
    }
  }

  const handleConnectTelegram = async () => {
    if (isUpdatingTelegram) return

    setIsUpdatingTelegram(true)
    setTelegramError(null)

    try {
      const payload = await connectConsumerAgentTelegram({
        agentId: slug,
        botToken: telegramBotToken,
        accountId: telegramAccountId,
        webhookUrl: telegramWebhookUrl || null,
        dmPolicy: telegramDmPolicy,
        allowFrom: parseAllowFromInput(telegramAllowFrom),
        requireMention: telegramRequireMention,
      })

      setTelegramConnection(payload.telegram)
      setTelegramBotToken("")
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : "Failed to connect Telegram.")
    } finally {
      setIsUpdatingTelegram(false)
    }
  }

  const handleDisconnectTelegram = async () => {
    if (isUpdatingTelegram) return

    setIsUpdatingTelegram(true)
    setTelegramError(null)

    try {
      const payload = await disconnectConsumerAgentTelegram({ agentId: slug })
      setTelegramConnection(payload.telegram)
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : "Failed to disconnect Telegram.")
    } finally {
      setIsUpdatingTelegram(false)
    }
  }

  const handleSendChat = async () => {
    const message = chatInput.trim()
    if (!message || isSendingChat) return

    const userMessage: ChatMessage = {
      id: buildChatMessageId(),
      role: "user",
      text: message,
    }

    setChatError(null)
    setChatInput("")
    setChatMessages((prev) => [...prev, userMessage])
    setIsSendingChat(true)

    try {
      const payload = await sendConsumerAgentChatMessage({
        agentId: slug,
        message,
        sessionId: chatSessionId,
      })

      setChatSessionId(payload.chat.sessionId)
      setChatMessages((prev) => [
        ...prev,
        {
          id: buildChatMessageId(),
          role: "assistant",
          text: payload.chat.reply,
        },
      ])
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Failed to send preview chat message."
      setChatError(messageText)
      setChatMessages((prev) => [
        ...prev,
        {
          id: buildChatMessageId(),
          role: "system",
          text: `Preview error: ${messageText}`,
        },
      ])
    } finally {
      setIsSendingChat(false)
    }
  }

  const handleSubmitChat = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void handleSendChat()
  }

  React.useEffect(() => {
    let mounted = true

    const loadAccess = async () => {
      setIsAllowed(null)
      setAccessError(null)

      try {
        const payload = await fetchConsumerAgentSettings()
        const setting = payload.settings.find((item) => item.agentId === slug && item.isActive) ?? null

        if (mounted) {
          setActiveSetting(setting)
          setIsAllowed(Boolean(setting))
          const connection = parseTelegramConnection(setting)
          setTelegramConnection(connection)
          setTelegramAccountId(connection?.accountId ?? "default")
          setTelegramWebhookUrl(connection?.webhookUrl ?? "")
          setTelegramAllowFrom(connection?.allowFrom.join(", ") ?? "")
          setTelegramDmPolicy(connection?.dmPolicy ?? "pairing")
          setTelegramRequireMention(connection?.requireMention ?? true)
          setTelegramError(null)
        }
      } catch (error) {
        if (mounted) {
          setIsAllowed(false)
          setAccessError(error instanceof Error ? error.message : "Failed to verify agent access")
        }
      }
    }

    void loadAccess()

    return () => {
      mounted = false
    }
  }, [slug])

  React.useEffect(() => {
    setChatMessages([
      {
        id: buildChatMessageId(),
        role: "system",
        text: "Preview chat is ready. Send a message to test this agent before connecting client channels.",
      },
    ])
    setChatSessionId(null)
    setChatError(null)
    setChatInput("")
    setIsChatOpen(false)
    setTelegramBotToken("")
    setTelegramError(null)
    setIsUpdatingTelegram(false)
  }, [slug])

  return (
    <AppShell sidebar={getConsumerSidebar("agents", sidebarUser)}>
      <main id="page-main" className="flex h-full w-full flex-1 flex-col gap-6 overflow-auto p-6 md:p-8">
        {isAllowed === false ? (
          <section className="border bg-card p-6">
            <h1 className="text-xl font-semibold">Agent not activated</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This agent is not activated for your account yet. Activate it first from the Agents page
              before opening channel configuration.
            </p>
            {accessError ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{accessError}</p> : null}
            <div className="mt-4">
              <Button asChild>
                <Link href="/agents">Go to Agents</Link>
              </Button>
            </div>
          </section>
        ) : null}

        {isAllowed === null ? (
          <section className="border bg-card p-6">
            <p className="text-sm text-muted-foreground">Checking agent access...</p>
          </section>
        ) : null}

        {isAllowed ? (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href="/agents" className="text-xs text-muted-foreground underline underline-offset-4">
                  Back to agents
                </Link>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight">{displayName}</h1>
                <p className="text-sm text-muted-foreground">
                  Configure channels and client integrations for this agent.
                </p>
                {activeSetting?.workspaceRef ? (
                  <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                    <p>Workspace ref: {activeSetting.workspaceRef}</p>
                    {activeSetting.workspacePath ? <p>Workspace path: {activeSetting.workspacePath}</p> : null}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-3.5" />
                  Active
                </span>
                <Button size="sm" onClick={() => void handleLaunch()} disabled={isLaunching}>
                  <Play className="mr-1 size-3.5" />
                  {isLaunching ? "Launching..." : "Launch runtime"}
                </Button>
              </div>
            </header>

            <section className="border bg-card p-4">
              <h2 className="mb-3 text-base font-semibold">Agent Basics</h2>
              {launchError ? <p className="mb-3 text-sm text-red-600 dark:text-red-400">{launchError}</p> : null}
              {launchState ? (
                <div className="mb-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                  Runtime {launchState.status}. Workspace: {launchState.workspacePath}
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">Agent display name</label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-muted-foreground">Agent slug</label>
                  <Input value={slug} readOnly />
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <TelegramConnectCard
                connection={telegramConnection}
                botToken={telegramBotToken}
                accountId={telegramAccountId}
                webhookUrl={telegramWebhookUrl}
                allowFrom={telegramAllowFrom}
                dmPolicy={telegramDmPolicy}
                requireMention={telegramRequireMention}
                isSaving={isUpdatingTelegram}
                error={telegramError}
                onBotTokenChange={setTelegramBotToken}
                onAccountIdChange={setTelegramAccountId}
                onWebhookUrlChange={setTelegramWebhookUrl}
                onAllowFromChange={setTelegramAllowFrom}
                onDmPolicyChange={setTelegramDmPolicy}
                onRequireMentionChange={setTelegramRequireMention}
                onConnect={() => void handleConnectTelegram()}
                onDisconnect={() => void handleDisconnectTelegram()}
              />

              {channels.map((channel) => {
                const Icon = channel.icon
                const isConnected = connected[channel.key]

                return (
                  <article key={channel.key} className="flex flex-col gap-3 border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-primary" />
                        <h3 className="font-semibold">{channel.label}</h3>
                      </div>
                      <span
                        className={`inline-flex border px-2 py-0.5 text-xs ${
                          isConnected
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-muted bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        {isConnected ? "Connected" : "Not connected"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{channel.description}</p>
                    <div className="mt-auto flex items-center gap-2">
                      <Button
                        variant={isConnected ? "secondary" : "default"}
                        onClick={() =>
                          setConnected((prev) => ({ ...prev, [channel.key]: !prev[channel.key] }))
                        }
                      >
                        {isConnected ? "Disconnect" : "Connect"}
                      </Button>
                      <Button variant="outline">Open settings</Button>
                    </div>
                  </article>
                )
              })}
            </section>

            <div className="fixed bottom-4 left-4 right-4 z-40 sm:left-auto sm:right-6">
              {isChatOpen ? (
                <section className="mb-3 max-h-[70vh] overflow-hidden border bg-card shadow-lg sm:w-[380px]">
                  <div className="flex items-center justify-between border-b px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold">Runtime Chat Preview</p>
                      {chatSessionId ? (
                        <p className="max-w-[300px] truncate text-[11px] text-muted-foreground">
                          Session: {chatSessionId}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setChatMessages([
                            {
                              id: buildChatMessageId(),
                              role: "system",
                              text: "Preview chat reset. Send a new message to start a fresh session.",
                            },
                          ])
                          setChatSessionId(null)
                          setChatError(null)
                        }}
                        disabled={isSendingChat}
                      >
                        Clear
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => setIsChatOpen(false)}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                  {chatError ? <p className="px-3 pt-2 text-sm text-red-600 dark:text-red-400">{chatError}</p> : null}
                  <div className="max-h-[45vh] space-y-2 overflow-y-auto px-3 py-3">
                    {chatMessages.map((message) => (
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
                  <form onSubmit={handleSubmitChat} className="border-t p-3">
                    <div className="flex gap-2">
                      <Input
                        value={chatInput}
                        onChange={(event) => setChatInput(event.target.value)}
                        placeholder="Type a message to this agent..."
                        disabled={isSendingChat}
                      />
                      <Button type="submit" disabled={isSendingChat || chatInput.trim().length === 0}>
                        {isSendingChat ? "Sending..." : "Send"}
                      </Button>
                    </div>
                  </form>
                </section>
              ) : null}

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => setIsChatOpen((prev) => !prev)}
                  className="h-12 rounded-full px-4 shadow-lg"
                >
                  <MessageCircle className="mr-2 size-4" />
                  {isChatOpen ? "Hide Chat" : "Open Chat"}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </main>
    </AppShell>
  )
}
