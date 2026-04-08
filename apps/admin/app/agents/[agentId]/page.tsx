"use client"

import * as React from "react"
import Link from "next/link"
import { Bot, LayoutDashboard, RefreshCcw, Users } from "lucide-react"
import { useParams } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { AppShell, type AppShellData } from "@workspace/ui/components/app-shell"
import { useSidebarUser, type SidebarUser } from "@/lib/auth/use-sidebar-user"

import type { AgentCoreFile, AgentCoreFileKind, GetOpenClawAgentCoreFilesResponse } from "@/app/agents/data/contracts"
import { fetchOpenClawAgentCoreFiles } from "@/app/agents/data/openclaw-agents-client"

const defaultAdminSidebarUser: SidebarUser = {
  name: "Admin User",
  email: "admin@aaas.local",
  avatar: "https://github.com/shadcn.png",
}

const adminSidebarBase: Omit<AppShellData, "user"> = {
  logo: {
    src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblocks-logo.svg",
    alt: "Admin Console",
    title: "Admin Console",
    description: "Operations",
  },
  navGroups: [
    {
      title: "Overview",
      items: [
        { label: "Dashboard", href: "/", icon: LayoutDashboard },
        { label: "Agents", href: "/agents", icon: Bot, isActive: true },
        { label: "Users", href: "/users", icon: Users },
      ],
    },
  ],
}

const CORE_FILE_ORDER: AgentCoreFileKind[] = [
  "AGENTS",
  "SOUL",
  "TOOLS",
  "IDENTITY",
  "USER",
  "HEARTBEAT",
  "BOOTSTRAP",
  "MEMORY",
]

function toDisplayName(agentId: string): string {
  return agentId
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function getStatusBadge(file: AgentCoreFile): { text: string; className: string } {
  if (file.error) {
    return {
      text: "Error",
      className: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
    }
  }

  if (file.exists) {
    return {
      text: file.truncated ? "Loaded (truncated)" : "Loaded",
      className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    }
  }

  return {
    text: "Missing",
    className: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  }
}

export default function AdminAgentCoreFilesPage() {
  const sidebarUser = useSidebarUser(defaultAdminSidebarUser)
  const params = useParams<{ agentId: string }>()
  const rawAgentId = typeof params?.agentId === "string" ? params.agentId : ""
  const agentId = decodeURIComponent(rawAgentId)

  const [payload, setPayload] = React.useState<GetOpenClawAgentCoreFilesResponse | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const sidebarData = React.useMemo<AppShellData>(
    () => ({
      ...adminSidebarBase,
      user: {
        name: sidebarUser.name,
        email: sidebarUser.email,
        avatar: sidebarUser.avatar,
      },
    }),
    [sidebarUser],
  )

  const loadCoreFiles = React.useCallback(async () => {
    if (!agentId) {
      setLoadError("Missing agent id in route.")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setLoadError(null)

    try {
      const nextPayload = await fetchOpenClawAgentCoreFiles(agentId)
      setPayload(nextPayload)
    } catch (error) {
      setPayload(null)
      setLoadError(error instanceof Error ? error.message : "Failed to load agent core files")
    } finally {
      setIsLoading(false)
    }
  }, [agentId])

  React.useEffect(() => {
    void loadCoreFiles()
  }, [loadCoreFiles])

  const orderedFiles = React.useMemo(() => {
    if (!payload) return []

    const byKind = new Map(payload.coreFiles.map((value) => [value.kind, value]))
    return CORE_FILE_ORDER.map((kind) => byKind.get(kind)).filter((value): value is AgentCoreFile => Boolean(value))
  }, [payload])

  const pageTitle = payload?.agent.name || toDisplayName(agentId) || "Agent"

  return (
    <AppShell sidebar={sidebarData}>
      <main id="page-main" className="flex h-full w-full flex-1 flex-col gap-6 overflow-auto p-6 md:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/agents" className="text-xs text-muted-foreground underline underline-offset-4">
              Back to agent catalog
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{pageTitle} · Core Files</h1>
            <p className="text-sm text-muted-foreground">
              Inspect AGENTS, SOUL, TOOLS, IDENTITY, USER, HEARTBEAT, BOOTSTRAP, and MEMORY from this agent workspace.
            </p>
            {payload?.workspacePath ? (
              <p className="mt-2 text-xs text-muted-foreground">Workspace: {payload.workspacePath}</p>
            ) : null}
          </div>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => void loadCoreFiles()} disabled={isLoading}>
            <RefreshCcw className="size-3.5" />
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        </header>

        {loadError ? (
          <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {loadError}
          </div>
        ) : null}

        {isLoading && !payload ? (
          <section className="border bg-card px-4 py-6 text-sm text-muted-foreground">Loading core files...</section>
        ) : null}

        {payload ? (
          <section className="grid gap-4">
            {orderedFiles.map((file) => {
              const status = getStatusBadge(file)

              return (
                <article key={file.kind} className="border bg-card">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                    <div>
                      <h2 className="text-sm font-semibold tracking-wide">{file.kind}</h2>
                      <p className="text-xs text-muted-foreground">{file.fileName}</p>
                    </div>
                    <span className={`inline-flex border px-2 py-0.5 text-xs ${status.className}`}>{status.text}</span>
                  </div>

                  <div className="space-y-3 px-4 py-3">
                    <p className="break-all text-xs text-muted-foreground">Path: {file.resolvedPath ?? "-"}</p>

                    {file.error ? <p className="text-sm text-red-600 dark:text-red-400">{file.error}</p> : null}

                    {file.exists ? (
                      <pre className="max-h-[28rem] overflow-auto border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                        {file.content}
                      </pre>
                    ) : !file.error ? (
                      <p className="text-sm text-muted-foreground">No content found for this artifact.</p>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </section>
        ) : null}

        {!isLoading && !payload && !loadError ? (
          <section className="border bg-card px-4 py-6 text-sm text-muted-foreground">
            No data available for this agent.
          </section>
        ) : null}
      </main>
    </AppShell>
  )
}
