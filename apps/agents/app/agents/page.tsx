"use client"

import * as React from "react"
import Link from "next/link"
import { Settings2, Sparkles } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { AppShell } from "@workspace/ui/components/app-shell"
import type { CatalogAgent } from "@/app/agents/data/contracts"
import { fetchOpenClawAgents } from "@/app/agents/data/openclaw-agents-client"
import { useSidebarUser } from "@/lib/auth/use-sidebar-user"
import { ACTIVE_AGENTS_STORAGE_KEY, defaultAgentsSidebarUser, getConsumerSidebar } from "./data"

function getStatusBadgeClass(status: CatalogAgent["status"]) {
  if (status === "published") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  }

  if (status === "paused") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  }

  return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300"
}

export default function ConsumerAgentsPage() {
  const sidebarUser = useSidebarUser(defaultAgentsSidebarUser)
  const [activeIds, setActiveIds] = React.useState<Set<string>>(new Set())
  const [catalogItems, setCatalogItems] = React.useState<CatalogAgent[]>([])
  const [isCatalogLoading, setIsCatalogLoading] = React.useState(true)
  const [catalogError, setCatalogError] = React.useState<string | null>(null)
  const [hasLoadedActiveIds, setHasLoadedActiveIds] = React.useState(false)
  const [pendingDeactivateId, setPendingDeactivateId] = React.useState<string | null>(null)

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ACTIVE_AGENTS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as string[]
        if (Array.isArray(parsed)) {
          setActiveIds(new Set(parsed))
        }
      }
    } catch {
      // ignore malformed localStorage data and keep defaults
    } finally {
      setHasLoadedActiveIds(true)
    }
  }, [])

  React.useEffect(() => {
    if (!hasLoadedActiveIds) return

    window.localStorage.setItem(ACTIVE_AGENTS_STORAGE_KEY, JSON.stringify(Array.from(activeIds)))
  }, [activeIds, hasLoadedActiveIds])

  const loadCatalog = React.useCallback(async () => {
    setIsCatalogLoading(true)
    setCatalogError(null)

    try {
      const payload = await fetchOpenClawAgents()
      setCatalogItems(payload.agents)
    } catch (error) {
      setCatalogItems([])
      setCatalogError(error instanceof Error ? error.message : "Failed to load OpenClaw agents")
    } finally {
      setIsCatalogLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  React.useEffect(() => {
    if (!hasLoadedActiveIds) return

    const validIds = new Set(catalogItems.map((agent) => agent.id))

    setActiveIds((prev) => {
      const filtered = Array.from(prev).filter((id) => validIds.has(id))
      return filtered.length === prev.size ? prev : new Set(filtered)
    })
  }, [catalogItems, hasLoadedActiveIds])

  const activeAgents = catalogItems.filter((agent) => activeIds.has(agent.id))

  const deactivateAgent = (id: string) => {
    setActiveIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setPendingDeactivateId(null)
  }

  return (
    <AppShell sidebar={getConsumerSidebar("agents", sidebarUser)}>
      <main id="page-main" className="flex h-full w-full flex-1 flex-col gap-6 overflow-auto p-6 md:p-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Your Agents</h1>
          <p className="text-sm text-muted-foreground">
            Här ser du agenter som är aktiverade för ditt konto. Lägg till fler via Discover.
          </p>
        </header>

        {catalogError ? (
          <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {catalogError}
            <Button size="sm" variant="outline" className="ml-3" onClick={loadCatalog}>
              Retry
            </Button>
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-3">
          <article className="border bg-card p-4">
            <p className="text-xs text-muted-foreground">Active Agents</p>
            <p className="mt-1 text-2xl font-semibold">{activeAgents.length}</p>
          </article>
          <article className="border bg-card p-4">
            <p className="text-xs text-muted-foreground">Available in Catalog</p>
            <p className="mt-1 text-2xl font-semibold">{catalogItems.length}</p>
          </article>
          <article className="border bg-card p-4">
            <p className="text-xs text-muted-foreground">Catalog Sync</p>
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={loadCatalog} disabled={isCatalogLoading}>
                <Settings2 className="mr-1 size-3.5" />
                {isCatalogLoading ? "Loading..." : "Refresh"}
              </Button>
            </div>
          </article>
        </section>

        <section className="border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-base font-semibold">Active Agents</h2>
          </div>

          {isCatalogLoading ? (
            <div className="border p-4 text-sm text-muted-foreground">Loading agent catalog...</div>
          ) : null}

          {!isCatalogLoading && activeAgents.length === 0 ? (
            <div className="flex flex-col gap-3 border p-4">
              <p className="text-sm text-muted-foreground">
                {catalogItems.length === 0
                  ? "No agents are available in your OpenClaw catalog yet."
                  : "No active agents yet."}
              </p>
              {catalogItems.length > 0 ? (
                <div>
                  <Button asChild>
                    <Link href="/agents/discover">Activate your first agent</Link>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {!isCatalogLoading && activeAgents.length > 0 ? (
            <ul className="grid gap-2">
              {activeAgents.map((agent) => (
                <li key={agent.id} className="flex items-center justify-between border px-3 py-2">
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {agent.workspace} · {agent.aiModel}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex border px-2 py-0.5 text-xs capitalize ${getStatusBadgeClass(agent.status)}`}>
                      {agent.status}
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/agents/${agent.id}`}>Configure</Link>
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setPendingDeactivateId(agent.id)}>
                      Deactivate
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>

      <AlertDialog
        open={pendingDeactivateId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeactivateId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the agent for your account. You can activate it again from Discover.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeactivateId) deactivateAgent(pendingDeactivateId)
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  )
}
