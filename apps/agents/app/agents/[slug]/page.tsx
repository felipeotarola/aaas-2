"use client"

import * as React from "react"
import Link from "next/link"
import { Bot, CheckCircle2, MessageCircle, Play, Send, Smartphone } from "lucide-react"
import { useParams } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { AppShell } from "@workspace/ui/components/app-shell"
import { fetchConsumerAgentSettings, launchConsumerAgent } from "@/app/agents/data/consumer-agent-settings-client"
import type { ConsumerAgentSetting } from "@/app/agents/data/contracts"
import { useSidebarUser } from "@/lib/auth/use-sidebar-user"
import { defaultAgentsSidebarUser, getConsumerSidebar } from "../data"

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
  const sidebarUser = useSidebarUser(defaultAgentsSidebarUser)
  const params = useParams<{ slug: string }>()
  const slug = params?.slug ?? "unknown-agent"
  const [isAllowed, setIsAllowed] = React.useState<boolean | null>(null)
  const [activeSetting, setActiveSetting] = React.useState<ConsumerAgentSetting | null>(null)
  const [accessError, setAccessError] = React.useState<string | null>(null)
  const [connected, setConnected] = React.useState<Record<string, boolean>>({
    telegram: false,
    whatsapp: false,
    email: true,
    webchat: true,
  })
  const [launchState, setLaunchState] = React.useState<{ workspacePath: string; status: string } | null>(null)
  const [launchError, setLaunchError] = React.useState<string | null>(null)
  const [isLaunching, setIsLaunching] = React.useState(false)
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
