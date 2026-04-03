"use client"

import * as React from "react"
import { Bot, LayoutDashboard, Plus, Settings2, Users } from "lucide-react"
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

import type { CatalogAgent } from "@/app/agents/data/contracts"
import { createOpenClawAgent, fetchOpenClawAgents } from "@/app/agents/data/openclaw-agents-client"

type Assignment = {
  agent: string
  userName: string
  userEmail: string
  plan: string
  state: "active" | "pending" | "revoked"
}

const assignments: Assignment[] = [
  {
    agent: "Support Agent",
    userName: "Jane Customer",
    userEmail: "jane@aaas.local",
    plan: "Pro",
    state: "active",
  },
  {
    agent: "Onboarding Agent",
    userName: "Erik Nilsson",
    userEmail: "erik@customer-space.app",
    plan: "Starter",
    state: "active",
  },
  {
    agent: "Retention Agent",
    userName: "Lina Perez",
    userEmail: "lina@retention-user.org",
    plan: "Pro",
    state: "pending",
  },
  {
    agent: "Support Agent",
    userName: "Mikael Andersson",
    userEmail: "mikael@consumer-alpha.app",
    plan: "Business",
    state: "revoked",
  },
]

const adminSidebar: AppShellData = {
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
      ],
    },
  ],
  user: {
    name: "Admin User",
    email: "admin@aaas.local",
    avatar: "https://github.com/shadcn.png",
  },
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

const PRIMARY_FALLBACK_MODEL = "openai-codex/gpt-5.4"
const FALLBACK_MODELS = [PRIMARY_FALLBACK_MODEL]

export default function AdminAgentsPage() {
  const [catalogItems, setCatalogItems] = React.useState<CatalogAgent[]>([])
  const [availableModels, setAvailableModels] = React.useState<string[]>(FALLBACK_MODELS)
  const [isLoading, setIsLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)
  const [newAgentName, setNewAgentName] = React.useState("")
  const [newAgentId, setNewAgentId] = React.useState("")
  const [newAgentModel, setNewAgentModel] = React.useState(PRIMARY_FALLBACK_MODEL)

  const loadAgents = React.useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const payload = await fetchOpenClawAgents()
      setCatalogItems(payload.agents)

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
  const totalAssignments = assignments.filter((item) => item.state === "active").length

  const canCreate = newAgentName.trim().length > 2 && !isSaving

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
            <p className="text-xs text-muted-foreground">Active User Assignments</p>
            <p className="mt-1 text-2xl font-semibold">{totalAssignments}</p>
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
                      <Button size="sm" variant="secondary" disabled>
                        Managed by OpenClaw
                      </Button>
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
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Users className="size-4" />
            <h2 className="text-base font-semibold">User Assignments</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment, index) => (
                  <tr key={`${assignment.userEmail}-${index}`} className="border-b last:border-b-0">
                    <td className="px-4 py-3 font-medium">{assignment.agent}</td>
                    <td className="px-4 py-3">{assignment.userName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{assignment.userEmail}</td>
                    <td className="px-4 py-3">{assignment.plan}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex border px-2 py-0.5 text-xs capitalize ${badgeClass(assignment.state)}`}>
                        {assignment.state}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  )
}
