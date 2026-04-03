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

type CatalogAgent = {
  id: string
  name: string
  type: "predefined" | "custom"
  aiProvider: "openai"
  aiModel: OpenAIChatModel
  version: string
  status: "published" | "draft" | "paused"
  activeUsers: number
}

type OpenAIChatModel = "gpt-4o" | "gpt-4o-mini" | "gpt-4.1" | "gpt-4.1-mini"

const OPENAI_CHAT_MODELS: OpenAIChatModel[] = ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"]

type Assignment = {
  agent: string
  userName: string
  userEmail: string
  plan: string
  state: "active" | "pending" | "revoked"
}

const catalog: CatalogAgent[] = [
  {
    id: "agt-support",
    name: "Support Agent",
    type: "predefined",
    aiProvider: "openai",
    aiModel: "gpt-4o",
    version: "v2.3.1",
    status: "published",
    activeUsers: 1482,
  },
  {
    id: "agt-onboarding",
    name: "Onboarding Agent",
    type: "predefined",
    aiProvider: "openai",
    aiModel: "gpt-4o-mini",
    version: "v1.9.0",
    status: "published",
    activeUsers: 1034,
  },
  {
    id: "agt-retention",
    name: "Retention Agent",
    type: "predefined",
    aiProvider: "openai",
    aiModel: "gpt-4.1",
    version: "v1.5.4",
    status: "paused",
    activeUsers: 392,
  },
  {
    id: "agt-prospecting-custom",
    name: "Prospecting Assistant",
    type: "custom",
    aiProvider: "openai",
    aiModel: "gpt-4.1-mini",
    version: "v0.7.2",
    status: "draft",
    activeUsers: 0,
  },
]

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

export default function AdminAgentsPage() {
  const [catalogItems, setCatalogItems] = React.useState<CatalogAgent[]>(catalog)
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [newAgentName, setNewAgentName] = React.useState("")
  const [newAgentType, setNewAgentType] = React.useState<CatalogAgent["type"]>("custom")
  const [newAgentProvider, setNewAgentProvider] = React.useState<CatalogAgent["aiProvider"]>("openai")
  const [newAgentModel, setNewAgentModel] = React.useState<OpenAIChatModel>("gpt-4o")
  const [newAgentVersion, setNewAgentVersion] = React.useState("v0.1.0")

  const publishedCount = catalogItems.filter((item) => item.status === "published").length
  const totalAssignments = assignments.filter((item) => item.state === "active").length

  const canCreate = newAgentName.trim().length > 2

  const handleCreateAgent = () => {
    if (!canCreate) return

    const slug = newAgentName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

    const newItem: CatalogAgent = {
      id: `agt-${slug || "new"}-${Date.now().toString().slice(-4)}`,
      name: newAgentName.trim(),
      type: newAgentType,
      aiProvider: newAgentProvider,
      aiModel: newAgentModel,
      version: newAgentVersion.trim() || "v0.1.0",
      status: "draft",
      activeUsers: 0,
    }

    setCatalogItems((prev) => [newItem, ...prev])
    setNewAgentName("")
    setNewAgentType("custom")
    setNewAgentProvider("openai")
    setNewAgentModel("gpt-4o")
    setNewAgentVersion("v0.1.0")
    setIsCreateOpen(false)
  }

  return (
    <AppShell sidebar={adminSidebar}>
      <main id="page-main" className="flex h-full w-full flex-1 flex-col gap-6 overflow-auto p-6 md:p-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Agent Management</h1>
            <p className="text-sm text-muted-foreground">
              Hantera agent-katalogen och användarkopplingar för hela systemet.
            </p>
          </div>
          <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
            <Plus className="size-4" />
            New Agent
          </Button>
        </header>

        <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <SheetContent side="right" className="w-full border-l sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>Create New Agent</SheetTitle>
              <SheetDescription>
                Configure a new catalog agent. This is a simulated flow for UX validation.
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
                <label className="text-xs text-muted-foreground">Type</label>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={newAgentType}
                  onChange={(e) => setNewAgentType(e.target.value as CatalogAgent["type"])}
                >
                  <option value="custom">Custom</option>
                  <option value="predefined">Predefined</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">AI provider</label>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={newAgentProvider}
                  onChange={(e) => setNewAgentProvider(e.target.value as CatalogAgent["aiProvider"])}
                >
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">AI model</label>
                <select
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  value={newAgentModel}
                  onChange={(e) => setNewAgentModel(e.target.value as OpenAIChatModel)}
                >
                  {OPENAI_CHAT_MODELS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Initial version</label>
                <Input
                  value={newAgentVersion}
                  onChange={(e) => setNewAgentVersion(e.target.value)}
                  placeholder="v0.1.0"
                />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button onClick={handleCreateAgent} disabled={!canCreate}>
                  Save Agent
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
            <h2 className="text-base font-semibold">Agent Catalog</h2>
            <Button variant="outline" size="sm" className="gap-1">
              <Settings2 className="size-3.5" />
              Configure
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">AI Model</th>
                  <th className="px-4 py-3 font-medium">Version</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Active Users</th>
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
                    <td className="px-4 py-3 capitalize">{agent.type}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span>{agent.aiModel}</span>
                        <span className="text-xs uppercase text-muted-foreground">{agent.aiProvider}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{agent.version}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex border px-2 py-0.5 text-xs capitalize ${badgeClass(agent.status)}`}>
                        {agent.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{agent.activeUsers.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          Edit
                        </Button>
                        <Button size="sm" variant="secondary">
                          Manage
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
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
