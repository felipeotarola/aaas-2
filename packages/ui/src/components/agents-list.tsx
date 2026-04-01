import * as React from "react"
import { ChevronsUpDown, LayoutDashboard, LogOut, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar"
import { cn } from "@workspace/ui/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>

export type AgentRecord = {
  id: string
  name: string
  owner: string
  scope: "system" | "consumer"
  status: "healthy" | "degraded" | "paused"
  region: string
  requestsPerDay: number
  successRate: number
  lastActive: string
  userName?: string
  userEmail?: string
}

export type AgentsSidebarData = {
  logo: {
    src: string
    alt: string
    title: string
    description: string
  }
  navGroups: Array<{
    title: string
    items: Array<{
      label: string
      href: string
      icon: IconComponent
      isActive?: boolean
    }>
  }>
  user?: {
    name: string
    email: string
    avatar: string
  }
}

function statusClass(status: AgentRecord["status"]) {
  if (status === "healthy") return "bg-emerald-500"
  if (status === "degraded") return "bg-amber-500"
  return "bg-slate-400"
}

function scopeClass(scope: AgentRecord["scope"]) {
  return scope === "system"
    ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
    : "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
}

function SidebarLogo({ logo }: { logo: AgentsSidebarData["logo"] }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" tooltip={logo.title}>
          <div className="flex aspect-square size-8 items-center justify-center bg-primary">
            <img
              src={logo.src}
              alt={logo.alt}
              width={24}
              height={24}
              className="size-6 invert dark:invert-0"
            />
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-medium">{logo.title}</span>
            <span className="text-xs text-muted-foreground">{logo.description}</span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function SidebarUser({ user }: { user: NonNullable<AgentsSidebarData["user"]> }) {
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-none">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-none">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-none"
            side="bottom"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                <Avatar className="size-8 rounded-none">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-none">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 size-4" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem>
              <LogOut className="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function AgentsSidebar({ data }: { data: AgentsSidebarData }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
          <SidebarLogo logo={data.logo} />
          <SidebarTrigger className="ml-auto group-data-[collapsible=icon]:ml-0" />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {data.navGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.label}>
                      <SidebarMenuButton asChild isActive={item.isActive} tooltip={item.label}>
                        <a href={item.href}>
                          <Icon className="size-4" />
                          <span>{item.label}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>{data.user ? <SidebarUser user={data.user} /> : null}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

type AgentsTableProps = {
  title: string
  description: string
  agents: AgentRecord[]
}

function AgentsTable({ title, description, agents }: AgentsTableProps) {
  const healthyCount = agents.filter((a) => a.status === "healthy").length
  const avgSuccessRate =
    agents.length === 0
      ? 0
      : agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length
  const totalRequests = agents.reduce((sum, a) => sum + a.requestsPerDay, 0)

  return (
    <main id="agents-main" className="flex h-full w-full flex-1 flex-col gap-6 overflow-auto p-6 md:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Agents</p>
          <p className="mt-1 text-2xl font-semibold">{agents.length}</p>
        </article>
        <article className="border bg-card p-4">
          <p className="text-xs text-muted-foreground">Healthy</p>
          <p className="mt-1 text-2xl font-semibold">{healthyCount}</p>
        </article>
        <article className="border bg-card p-4">
          <p className="text-xs text-muted-foreground">Avg Success Rate</p>
          <p className="mt-1 text-2xl font-semibold">{avgSuccessRate.toFixed(1)}%</p>
        </article>
      </section>

      <section className="border bg-card">
        <div className="border-b px-4 py-3 text-sm text-muted-foreground">
          Daily traffic: {totalRequests.toLocaleString()} requests/day
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Owner</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Scope</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Region</th>
                <th className="px-4 py-3 font-medium">Req/Day</th>
                <th className="px-4 py-3 font-medium">Success</th>
                <th className="px-4 py-3 font-medium">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium">{agent.name}</span>
                      <span className="text-xs text-muted-foreground">{agent.id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{agent.owner}</td>
                  <td className="px-4 py-3">{agent.userName ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{agent.userEmail ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex border px-2 py-0.5 text-xs capitalize",
                        scopeClass(agent.scope),
                      )}
                    >
                      {agent.scope}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-xs capitalize">
                      <span className={cn("inline-block size-2 rounded-full", statusClass(agent.status))} />
                      {agent.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{agent.region}</td>
                  <td className="px-4 py-3">{agent.requestsPerDay.toLocaleString()}</td>
                  <td className="px-4 py-3">{agent.successRate.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-muted-foreground">{agent.lastActive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

const defaultSidebar: AgentsSidebarData = {
  logo: {
    src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblocks-logo.svg",
    alt: "Dashboard",
    title: "Dashboard",
    description: "Navigation",
  },
  navGroups: [
    {
      title: "Main",
      items: [
        { label: "Dashboard", href: "/", icon: LayoutDashboard },
        { label: "Agents", href: "/agents", icon: User, isActive: true },
      ],
    },
  ],
}

export function AgentsList({
  title,
  description,
  agents,
  sidebar = defaultSidebar,
}: {
  title: string
  description: string
  agents: AgentRecord[]
  sidebar?: AgentsSidebarData
}) {
  return (
    <TooltipProvider>
      <SidebarProvider className="bg-sidebar">
        <a
          href="#agents-main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:text-foreground focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>
        <AgentsSidebar data={sidebar} />
        <div className="h-svh w-full overflow-hidden">
          <div className="flex h-full w-full flex-col overflow-hidden border bg-background">
            <AgentsTable title={title} description={description} agents={agents} />
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  )
}
