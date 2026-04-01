"use client"

import * as React from "react"
import { Button } from "@workspace/ui/components/button"
import { AppShell } from "@workspace/ui/components/app-shell"
import {
  ACTIVE_AGENTS_STORAGE_KEY,
  getConsumerSidebar,
  predefinedAgents,
} from "../data"

export default function ConsumerDiscoverAgentsPage() {
  const [activeIds, setActiveIds] = React.useState<Set<string>>(new Set(["consumer-support"]))

  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ACTIVE_AGENTS_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as string[]
      if (Array.isArray(parsed)) {
        setActiveIds(new Set(parsed))
      }
    } catch {
      // ignore malformed localStorage data and keep defaults
    }
  }, [])

  React.useEffect(() => {
    window.localStorage.setItem(
      ACTIVE_AGENTS_STORAGE_KEY,
      JSON.stringify(Array.from(activeIds)),
    )
  }, [activeIds])

  const toggleAgent = (id: string) => {
    setActiveIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <AppShell sidebar={getConsumerSidebar("discover")}>
      <main id="page-main" className="flex h-full w-full flex-1 flex-col gap-6 overflow-auto p-6 md:p-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Discover Agents</h1>
          <p className="text-sm text-muted-foreground">
            Katalog över agenter du kan aktivera. När en agent är aktiv kan du konfigurera den.
          </p>
        </header>

        <section className="border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">Available Catalog</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Capabilities</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {predefinedAgents.map((agent) => {
                  const isActive = activeIds.has(agent.id)
                  return (
                    <tr key={agent.id} className="border-b last:border-b-0">
                      <td className="px-4 py-3 font-medium">{agent.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{agent.category}</td>
                      <td className="px-4 py-3 text-muted-foreground">{agent.description}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {agent.capabilities.map((cap) => (
                            <span key={cap} className="border bg-muted/40 px-1.5 py-0.5 text-xs">
                              {cap}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex border px-2 py-0.5 text-xs ${
                            isActive
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "border-muted bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          {isActive ? "Active" : "Available"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={isActive ? "secondary" : "default"}
                            onClick={() => toggleAgent(agent.id)}
                          >
                            {isActive ? "Deactivate" : "Activate"}
                          </Button>
                          {isActive ? (
                            <Button asChild size="sm" variant="outline">
                              <a href={`/agents/${agent.id}`}>Configure</a>
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
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  )
}

