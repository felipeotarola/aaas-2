"use client"

import * as React from "react"
import { Sparkles } from "lucide-react"
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
import {
  ACTIVE_AGENTS_STORAGE_KEY,
  getConsumerSidebar,
  predefinedAgents,
} from "./data"

export default function ConsumerAgentsPage() {
  const [activeIds, setActiveIds] = React.useState<Set<string>>(new Set(["consumer-support"]))
  const [pendingDeactivateId, setPendingDeactivateId] = React.useState<string | null>(null)

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

  const activeAgents = predefinedAgents.filter((agent) => activeIds.has(agent.id))

  const deactivateAgent = (id: string) => {
    setActiveIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setPendingDeactivateId(null)
  }

  return (
    <AppShell sidebar={getConsumerSidebar("agents")}>
      <main id="page-main" className="flex h-full w-full flex-1 flex-col gap-6 overflow-auto p-6 md:p-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Your Agents</h1>
          <p className="text-sm text-muted-foreground">
            Här ser du agenter som är aktiverade för ditt konto. Lägg till fler via Discover.
          </p>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <article className="border bg-card p-4">
            <p className="text-xs text-muted-foreground">Active Agents</p>
            <p className="mt-1 text-2xl font-semibold">{activeAgents.length}</p>
          </article>
          <article className="border bg-card p-4">
            <p className="text-xs text-muted-foreground">Available in Catalog</p>
            <p className="mt-1 text-2xl font-semibold">{predefinedAgents.length}</p>
          </article>
          <article className="border bg-card p-4">
            <p className="text-xs text-muted-foreground">Next Step</p>
            <div className="mt-2">
              <Button asChild size="sm" variant="outline">
                <a href="/agents/discover">Browse catalog</a>
              </Button>
            </div>
          </article>
        </section>

        <section className="border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-base font-semibold">Active Agents</h2>
          </div>
          {activeAgents.length === 0 ? (
            <div className="flex flex-col gap-3 border p-4">
              <p className="text-sm text-muted-foreground">No active agents yet.</p>
              <div>
                <Button asChild>
                  <a href="/agents/discover">Activate your first agent</a>
                </Button>
              </div>
            </div>
          ) : (
            <ul className="grid gap-2">
              {activeAgents.map((agent) => (
                <li key={agent.id} className="flex items-center justify-between border px-3 py-2">
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <a href={`/agents/${agent.id}`}>Configure</a>
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPendingDeactivateId(agent.id)}
                    >
                      Deactivate
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
