import { Bot, LayoutDashboard } from "lucide-react"
import {
  AgentsList,
  type AgentRecord,
  type AgentsSidebarData,
} from "@workspace/ui/components/agents-list"

const consumerAgents: AgentRecord[] = [
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
    userName: "Jane Customer",
    userEmail: "jane@aaas.local",
  },
  {
    id: "agt-consumer-onboarding",
    name: "Onboarding Agent",
    owner: "Lifecycle Team",
    scope: "consumer",
    status: "healthy",
    region: "eu-north-1",
    requestsPerDay: 22190,
    successRate: 97.8,
    lastActive: "4 min ago",
    userName: "Erik Nilsson",
    userEmail: "erik@customer-space.app",
  },
  {
    id: "agt-consumer-retention",
    name: "Retention Agent",
    owner: "Lifecycle Team",
    scope: "consumer",
    status: "degraded",
    region: "us-east-1",
    requestsPerDay: 9640,
    successRate: 93.4,
    lastActive: "6 min ago",
    userName: "Lina Perez",
    userEmail: "lina@retention-user.org",
  },
]

const consumerSidebar: AgentsSidebarData = {
  logo: {
    src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblocks-logo.svg",
    alt: "Consumer App",
    title: "Consumer App",
    description: "Customer View",
  },
  navGroups: [
    {
      title: "Home",
      items: [
        { label: "Dashboard", href: "/", icon: LayoutDashboard },
        { label: "Agents", href: "/agents", icon: Bot, isActive: true },
      ],
    },
  ],
  user: {
    name: "Jane Customer",
    email: "jane@aaas.local",
    avatar: "https://github.com/shadcn.png",
  },
}

export default function ConsumerAgentsPage() {
  return (
    <AgentsList
      title="Agents - Consumer"
      description="Consumer scope only. This view excludes platform/system agents."
      agents={consumerAgents}
      sidebar={consumerSidebar}
    />
  )
}
