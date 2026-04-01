import { Bot, LayoutDashboard } from "lucide-react"
import {
  AgentsList,
  type AgentRecord,
  type AgentsSidebarData,
} from "@workspace/ui/components/agents-list"

const adminAgents: AgentRecord[] = [
  {
    id: "agt-core-routing",
    name: "Core Routing Agent",
    owner: "Platform Team",
    scope: "system",
    status: "healthy",
    region: "eu-north-1",
    requestsPerDay: 182340,
    successRate: 99.7,
    lastActive: "2 min ago",
    userName: "Alice Johansson",
    userEmail: "alice@enterprise-one.io",
  },
  {
    id: "agt-billing-sync",
    name: "Billing Sync Agent",
    owner: "Finance Ops",
    scope: "system",
    status: "healthy",
    region: "us-east-1",
    requestsPerDay: 74320,
    successRate: 99.3,
    lastActive: "5 min ago",
    userName: "Brian Lee",
    userEmail: "brian@payments.global",
  },
  {
    id: "agt-risk-review",
    name: "Risk Review Agent",
    owner: "Trust & Safety",
    scope: "system",
    status: "degraded",
    region: "eu-west-1",
    requestsPerDay: 13810,
    successRate: 94.6,
    lastActive: "1 min ago",
    userName: "Sara Bennett",
    userEmail: "sara@riskops.net",
  },
  {
    id: "agt-consumer-helpdesk",
    name: "Consumer Helpdesk Agent",
    owner: "Customer Success",
    scope: "consumer",
    status: "healthy",
    region: "eu-central-1",
    requestsPerDay: 56340,
    successRate: 98.9,
    lastActive: "just now",
    userName: "Mikael Andersson",
    userEmail: "mikael@consumer-alpha.app",
  },
  {
    id: "agt-growth-reco",
    name: "Growth Recommendation Agent",
    owner: "Growth Team",
    scope: "consumer",
    status: "paused",
    region: "us-west-2",
    requestsPerDay: 0,
    successRate: 0,
    lastActive: "3h ago",
    userName: "Nadia Khan",
    userEmail: "nadia@growth-labs.co",
  },
]

const adminSidebar: AgentsSidebarData = {
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

export default function AdminAgentsPage() {
  return (
    <AgentsList
      title="Agents - Admin"
      description="Full system view. Includes every agent across platform and consumer workloads."
      agents={adminAgents}
      sidebar={adminSidebar}
    />
  )
}
