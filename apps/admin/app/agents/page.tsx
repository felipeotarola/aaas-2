"use client"

import * as React from "react"
import { Bot, LayoutDashboard, Plus, Settings2, Trash2, Users } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import { AppShell, type AppShellData } from "@workspace/ui/components/app-shell"
import { useSidebarUser, type SidebarUser } from "@/lib/auth/use-sidebar-user"

import type { ActiveConsumerAgentSubscription, CatalogAgent } from "@/app/agents/data/contracts"
import {
  createOpenClawAgent,
  deleteOpenClawAgent,
  fetchOpenClawAgents,
} from "@/app/agents/data/openclaw-agents-client"

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

function badgeClass(value: string) {
  if (value === "published" || value === "active") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  }
  if (value === "paused" || value === "pending") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  }
  if (value === "draft") {
    return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300"
  }
  return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"

  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

const PRIMARY_FALLBACK_MODEL = "openai-codex/gpt-5.4"
const FALLBACK_MODELS = [PRIMARY_FALLBACK_MODEL]

export default function AdminAgentsPage() {
  const sidebarUser = useSidebarUser(defaultAdminSidebarUser)
  const [catalogItems, setCatalogItems] = React.useState<CatalogAgent[]>([])
  const [activeSubscriptions, setActiveSubscriptions] = React.useState<ActiveConsumerAgentSubscription[]>([])
  const [subscriptionsError, setSubscriptionsError] = React.useState<string | null>(null)
  const [availableModels, setAvailableModels] = React.useState<string[]>(FALLBACK_MODELS)
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [deleteError, setDeleteError] = React.useState<string | null>(null)
  const [deletingAgentId, setDeletingAgentId] = React.useState<string | null>(null)
  const [newAgentName, setNewAgentName] = React.useState("")
  const [newAgentId, setNewAgentId] = React.useState("")
  const [newAgentModel, setNewAgentModel] = React.useState(PRIMARY_FALLBACK_MODEL)

  const loadAgents = React.useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const payload = await fetchOpenClawAgents()
      setCatalogItems(payload.agents)
      setActiveSubscriptions(payload.activeSubscriptions ?? [])
      setSubscriptionsError(payload.subscriptionsError ?? null)

      const models = payload.availableModels.length > 0 ? payload.availableModels : FALLBACK_MODELS
      setAvailableModels(models)

      const preferredModel = payload.defaultModel || models[0] || PRIMARY_FALLBACK_MODEL
      setNewAgentModel(preferredModel)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load OpenClaw agents")
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadAgents()
  }, [loadAgents])

  const publishedCount = catalogItems.filter((item) => item.status === "published").length
  const subscribedUserCount = React.useMemo(
    () => new Set(activeSubscriptions.map((subscription) => subscription.userId)).size,
    [activeSubscriptions],
  )
  const canCreate = newAgentName.trim().length > 2 && !isSaving
  const adminSidebar = React.useMemo<AppShellData>(
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

  const handleCreateAgent = async () => {
    if (!canCreate) return

    setCreateError(null)
    setIsSaving(true)

    try {
      const response = await createOpenClawAgent({
        name: newAgentName.trim(),
        id: newAgentId.trim() || undefined,
        model: newAgentModel.trim() || undefined,
      })

      setCatalogItems((prev) => [response.agent, ...prev])
      setNewAgentName("")
      setNewAgentId("")
      setIsCreateOpen(false)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create agent")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteAgent = async (agent: CatalogAgent) => {
    if (agent.id === "main") return
    if (deletingAgentId) return

    const confirmed = window.confirm(
      `Delete '${agent.name}' (${agent.id})? This will remove the agent config, files, and workspace.`,
    )
    if (!confirmed) return

    setDeleteError(null)
    setDeletingAgentId(agent.id)

    try {
      await deleteOpenClawAgent(agent.id)
      setCatalogItems((prev) => prev.filter((item) => item.id !== agent.id))
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete agent")
    } finally {
      setDeletingAgentId(null)
    }
  }

  return (
    <AppShell sidebar={adminSidebar}>
      <main id="page-main" className="flex h-full w-full flex-1 flex-col gap-6 overflow-auto p-6 md:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Agent Management</h1>
            <p className="text-sm text-muted-foreground">
              Skapa OpenClaw-agenter direkt från admin och skriv dem till din OpenClaw root.
            </p>
          </div>
          <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
            <Plus className="size-4" />
            New Agent
          </Button>
        </header>

        {loadError ? (
          <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {loadError}
            <Button size="sm" variant="outline" className="ml-3" onClick={loadAgents}>
              Retry
            </Button>
          </div>
        ) : null}

        <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <SheetContent side="right" className="w-full border-l sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Create OpenClaw Agent</SheetTitle>
              <SheetDescription>
                This writes agent config + scaffold files under your OpenClaw home folder.
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 px-4 pb-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Agent name</label>
                <Input
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="e.g. Invoice Assistant"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Agent ID (optional)</label>
                <Input
                  value={newAgentId}
                  onChange={(e) => setNewAgentId(e.target.value)}
                  placeholder="e.g. invoice-assistant"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Primary model</label>
                <Input
                  list="openclaw-models"
                  value={newAgentModel}
                  onChange={(e) => setNewAgentModel(e.target.value)}
                  placeholder="openai-codex/gpt-5.4"
                />
                <datalist id="openclaw-models">
                  {availableModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </datalist>
              </div>

              {createError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
              ) : null}

              <div className="mt-2 flex items-center gap-2">
                <Button onClick={() => void handleCreateAgent()} disabled={!canCreate}>
                  {isSaving ? "Creating..." : "Create Agent"}
                </Button>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <section className="grid gap-3 md:grid-cols-3">
          <article className="border bg-card p-4">
            <p className="text-xs text-muted-foreground">Catalog Size</p>
            <p className="mt-1 text-2xl font-semibold">{catalogItems.length}</p>
          </article>
          <article className="border bg-card p-4">
            <p className="text-xs text-muted-foreground">Published Agents</p>
            <p className="mt-1 text-2xl font-semibold">{publishedCount}</p>
          </article>
          <article className="border bg-card p-4">
            <p className="text-xs text-muted-foreground">Users With Active Subscriptions</p>
            <p className="mt-1 text-2xl font-semibold">{subscribedUserCount}</p>
          </article>
        </section>

        <section className="border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-base font-semibold">OpenClaw Agent Catalog</h2>
            <Button variant="outline" size="sm" className="gap-1" onClick={loadAgents} disabled={isLoading}>
              <Settings2 className="size-3.5" />
              {isLoading ? "Loading..." : "Refresh"}
            </Button>
          </div>
          {deleteError ? (
            <p className="border-b px-4 py-2 text-sm text-red-600 dark:text-red-400">{deleteError}</p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">AI Model</th>
                  <th className="px-4 py-3 font-medium">Workspace</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {catalogItems.map((agent) => (
                  <tr key={agent.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{agent.name}</span>
                        <span className="text-xs text-muted-foreground">{agent.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span>{agent.aiModel}</span>
                        <span className="text-xs uppercase text-muted-foreground">{agent.aiProvider}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{agent.workspace}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex border px-2 py-0.5 text-xs capitalize ${badgeClass(agent.status)}`}>
                        {agent.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {agent.id === "main" ? (
                        <Button size="sm" variant="secondary" disabled>
                          Protected
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          onClick={() => void handleDeleteAgent(agent)}
                          disabled={Boolean(deletingAgentId)}
                        >
                          <Trash2 className="size-3.5" />
                          {deletingAgentId === agent.id ? "Deleting..." : "Delete"}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {catalogItems.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No OpenClaw agents found yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-base font-semibold">Active User → Agent Subscriptions</h2>
            <p className="text-xs text-muted-foreground">{activeSubscriptions.length} active subscriptions</p>
          </div>
          {subscriptionsError ? (
            <p className="border-b px-4 py-2 text-sm text-red-600 dark:text-red-400">{subscriptionsError}</p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Workspace Ref</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {activeSubscriptions.map((subscription) => (
                  <tr key={`${subscription.userId}:${subscription.agentId}`} className="border-b last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{subscription.userName}</span>
                        <span className="text-xs text-muted-foreground">{subscription.userEmail}</span>
                        <span className="font-mono text-xs text-muted-foreground">{subscription.userId}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{subscription.agentName}</span>
                        <span className="text-xs text-muted-foreground">{subscription.agentId}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {subscription.workspaceRef || "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatTimestamp(subscription.updatedAt)}</td>
                  </tr>
                ))}
                {!isLoading && activeSubscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No active user subscriptions found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </AppShell>
  )
}
