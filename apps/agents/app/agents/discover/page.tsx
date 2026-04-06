"use client"

import * as React from "react"
import Link from "next/link"
import { Settings2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { AppShell } from "@workspace/ui/components/app-shell"
import type { CatalogAgent } from "@/app/agents/data/contracts"
import { fetchOpenClawAgents } from "@/app/agents/data/openclaw-agents-client"
import { useSidebarUser } from "@/lib/auth/use-sidebar-user"
import { ACTIVE_AGENTS_STORAGE_KEY, defaultAgentsSidebarUser, getConsumerSidebar } from "../data"

function badgeClass(value: CatalogAgent["status"]) {
  if (value === "published") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  }

  if (value === "paused") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  }

  return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300"
}

export default function ConsumerDiscoverAgentsPage() {
  const sidebarUser = useSidebarUser(defaultAgentsSidebarUser)
  const [catalogItems, setCatalogItems] = React.useState<CatalogAgent[]>([])
  const [activeIds, setActiveIds] = React.useState<Set<string>>(new Set())
  const [isCatalogLoading, setIsCatalogLoading] = React.useState(true)
  const [catalogError, setCatalogError] = React.useState<string | null>(null)
  const [hasLoadedActiveIds, setHasLoadedActiveIds] = React.useState(false)

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

  const toggleAgent = (id: string) => {
    setActiveIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <AppShell sidebar={getConsumerSidebar("discover", sidebarUser)}>
      <main id="page-main" className="flex h-full w-full flex-1 flex-col gap-6 overflow-auto p-6 md:p-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Discover Agents</h1>
          <p className="text-sm text-muted-foreground">
            Katalog över agenter du kan aktivera. När en agent är aktiv kan du konfigurera den.
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

        <section className="border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-base font-semibold">OpenClaw Catalog</h2>
            <Button size="sm" variant="outline" className="gap-1" onClick={loadCatalog} disabled={isCatalogLoading}>
              <Settings2 className="size-3.5" />
              {isCatalogLoading ? "Loading..." : "Refresh"}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">AI Model</th>
                  <th className="px-4 py-3 font-medium">Workspace</th>
                  <th className="px-4 py-3 font-medium">Catalog Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {catalogItems.map((agent) => {
                  const isActive = activeIds.has(agent.id)

                  return (
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
                        <div className="flex gap-2">
                          <Button size="sm" variant={isActive ? "secondary" : "default"} onClick={() => toggleAgent(agent.id)}>
                            {isActive ? "Deactivate" : "Activate"}
                          </Button>
                          {isActive ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/agents/${agent.id}`}>Configure</Link>
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled>
                              Configure
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {catalogItems.length === 0 && !isCatalogLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No OpenClaw agents found yet.
                    </td>
                  </tr>
                ) : null}

                {isCatalogLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Loading OpenClaw catalog...
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
