"use client"

import * as React from "react"
import Link from "next/link"
import { Settings2 } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { AppShell } from "@workspace/ui/components/app-shell"
import { fetchConsumerAgentSettings, upsertConsumerAgentSetting } from "@/app/agents/data/consumer-agent-settings-client"
import type { CatalogAgent, ConsumerAgentSetting } from "@/app/agents/data/contracts"
import { fetchOpenClawAgents } from "@/app/agents/data/openclaw-agents-client"
import { useSidebarUser } from "@/lib/auth/use-sidebar-user"
import { defaultAgentsSidebarUser, getConsumerSidebar } from "../data"

function badgeClass(value: CatalogAgent["status"]) {
  if (value === "published") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  }

  if (value === "paused") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  }

  return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300"
}

function mergeSetting(items: ConsumerAgentSetting[], setting: ConsumerAgentSetting): ConsumerAgentSetting[] {
  const index = items.findIndex((item) => item.agentId === setting.agentId)

  if (index === -1) {
    return [setting, ...items]
  }

  const next = [...items]
  next[index] = setting
  return next
}

export default function ConsumerDiscoverAgentsPage() {
  const sidebarUser = useSidebarUser(defaultAgentsSidebarUser)
  const [catalogItems, setCatalogItems] = React.useState<CatalogAgent[]>([])
  const [settingsItems, setSettingsItems] = React.useState<ConsumerAgentSetting[]>([])
  const [isCatalogLoading, setIsCatalogLoading] = React.useState(true)
  const [isSettingsLoading, setIsSettingsLoading] = React.useState(true)
  const [catalogError, setCatalogError] = React.useState<string | null>(null)
  const [settingsError, setSettingsError] = React.useState<string | null>(null)
  const [updatingAgentId, setUpdatingAgentId] = React.useState<string | null>(null)

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

  const loadSettings = React.useCallback(async () => {
    setIsSettingsLoading(true)
    setSettingsError(null)

    try {
      const payload = await fetchConsumerAgentSettings()
      setSettingsItems(payload.settings)
    } catch (error) {
      setSettingsItems([])
      setSettingsError(error instanceof Error ? error.message : "Failed to load consumer agent settings")
    } finally {
      setIsSettingsLoading(false)
    }
  }, [])

  const loadPageData = React.useCallback(async () => {
    await Promise.all([loadCatalog(), loadSettings()])
  }, [loadCatalog, loadSettings])

  React.useEffect(() => {
    void loadPageData()
  }, [loadPageData])

  const activeIds = React.useMemo(
    () => new Set(settingsItems.filter((item) => item.isActive).map((item) => item.agentId)),
    [settingsItems],
  )

  const isLoading = isCatalogLoading || isSettingsLoading
  const visibleCatalogItems = React.useMemo(
    () => catalogItems.filter((agent) => !activeIds.has(agent.id)),
    [activeIds, catalogItems],
  )

  const toggleAgent = async (id: string) => {
    const nextActive = !activeIds.has(id)

    setUpdatingAgentId(id)
    setSettingsError(null)

    try {
      const payload = await upsertConsumerAgentSetting({
        agentId: id,
        isActive: nextActive,
      })

      setSettingsItems((prev) => mergeSetting(prev, payload.setting))
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Failed to update consumer agent settings")
    } finally {
      setUpdatingAgentId(null)
    }
  }

  return (
    <AppShell sidebar={getConsumerSidebar("discover", sidebarUser)}>
      <main id="page-main" className="flex h-full w-full flex-1 flex-col gap-6 overflow-auto p-6 md:p-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Discover Agents</h1>
          <p className="text-sm text-muted-foreground">
            Browse agents you can activate. When activated, the agent moves to Active Agents and gets a workspace unique to your account.
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

        {settingsError ? (
          <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {settingsError}
            <Button size="sm" variant="outline" className="ml-3" onClick={loadSettings}>
              Retry
            </Button>
          </div>
        ) : null}

        <section className="border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-base font-semibold">Discover Agents</h2>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => void loadPageData()} disabled={isLoading}>
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
                  <th className="px-4 py-3 font-medium">Catalog Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCatalogItems.map((agent) => {
                  const isActive = activeIds.has(agent.id)
                  const isUpdating = updatingAgentId === agent.id

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
                          <Button
                            size="sm"
                            variant={isActive ? "secondary" : "default"}
                            disabled={isUpdating}
                            onClick={() => void toggleAgent(agent.id)}
                          >
                            {isUpdating ? "Updating..." : isActive ? "Deactivate" : "Activate"}
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

                {visibleCatalogItems.length === 0 && !isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      {catalogItems.length === 0
                        ? "No OpenClaw agents found yet."
                        : "All available agents are already active for your account."}
                    </td>
                  </tr>
                ) : null}

                {isLoading ? (
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
