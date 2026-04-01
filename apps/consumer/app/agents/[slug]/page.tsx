"use client"

import * as React from "react"
import { Bot, CheckCircle2, MessageCircle, Send, Smartphone } from "lucide-react"
import { useParams } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { AppShell } from "@workspace/ui/components/app-shell"
import { ACTIVE_AGENTS_STORAGE_KEY, getConsumerSidebar } from "../data"

type Channel = {
  key: "telegram" | "whatsapp" | "email" | "webchat"
  label: string
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

const channels: Channel[] = [
  {
    key: "telegram",
    label: "Telegram",
    description: "Connect bot token + webhook to deliver agent replies in Telegram.",
    icon: Send,
  },
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

export default function ConsumerAgentDetailPage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug ?? "unknown-agent"
  const [isAllowed, setIsAllowed] = React.useState<boolean | null>(null)
  const [connected, setConnected] = React.useState<Record<string, boolean>>({
    telegram: false,
    whatsapp: false,
    email: true,
    webchat: true,
  })
  const [displayName, setDisplayName] = React.useState(
    slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
  )

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ACTIVE_AGENTS_STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as string[]) : []
      setIsAllowed(Array.isArray(parsed) && parsed.includes(slug))
    } catch {
      setIsAllowed(false)
    }
  }, [slug])

  return (
    <AppShell sidebar={getConsumerSidebar("agents")}>
      <main id="page-main" className="flex h-full w-full flex-1 flex-col gap-6 overflow-auto p-6 md:p-8">
        {isAllowed === false ? (
          <section className="border bg-card p-6">
            <h1 className="text-xl font-semibold">Agent not activated</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This agent is not activated for your account yet. Activate it first from the Agents page
              before opening channel configuration.
            </p>
            <div className="mt-4">
              <Button asChild>
                <a href="/agents">Go to Agents</a>
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
            <a href="/agents" className="text-xs text-muted-foreground underline underline-offset-4">
              Back to agents
            </a>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{displayName}</h1>
            <p className="text-sm text-muted-foreground">
              Configure channels and client integrations for this agent.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3.5" />
            Active
          </span>
        </header>

        <section className="border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold">Agent Basics</h2>
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
          </>
        ) : null}
      </main>
    </AppShell>
  )
}
