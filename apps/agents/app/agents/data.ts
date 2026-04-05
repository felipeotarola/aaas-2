import { Bot, Compass, LayoutDashboard, User } from "lucide-react"
import type { AppShellData } from "@workspace/ui/components/app-shell"

export type PredefinedAgent = {
  id: string
  name: string
  category: string
  description: string
  capabilities: string[]
}

export const predefinedAgents: PredefinedAgent[] = [
  {
    id: "consumer-support",
    name: "Support Agent",
    category: "Customer Care",
    description: "Svarar på vanliga frågor, eskalerar ärenden och följer upp öppna case.",
    capabilities: ["FAQ", "Escalation", "Case Follow-up"],
  },
  {
    id: "consumer-onboarding",
    name: "Onboarding Agent",
    category: "Lifecycle",
    description: "Guidar nya användare genom setup, aktivering och första värdeflödet.",
    capabilities: ["Welcome Flow", "Activation Nudges", "Usage Tips"],
  },
  {
    id: "consumer-retention",
    name: "Retention Agent",
    category: "Growth",
    description: "Identifierar churn-risk och triggar relevanta retention-flöden.",
    capabilities: ["Risk Scoring", "Re-engagement", "Smart Timing"],
  },
]

export const ACTIVE_AGENTS_STORAGE_KEY = "consumer_active_agents"

export const defaultAgentsSidebarUser: NonNullable<AppShellData["user"]> = {
  name: "Jane Customer",
  email: "jane@aaas.local",
  avatar: "https://github.com/shadcn.png",
}

export function getConsumerSidebar(
  active: "dashboard" | "agents" | "discover" | "account",
  user: AppShellData["user"] = defaultAgentsSidebarUser,
): AppShellData {
  return {
    logo: {
      src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblocks-logo.svg",
      alt: "Agents App",
      title: "Agents App",
      description: "Agents View",
    },
    navGroups: [
      {
        title: "Home",
        items: [
          { label: "Dashboard", href: "/", icon: LayoutDashboard, isActive: active === "dashboard" },
          { label: "Agents", href: "/agents", icon: Bot, isActive: active === "agents" },
          { label: "Discover", href: "/agents/discover", icon: Compass, isActive: active === "discover" },
          { label: "Account", href: "/account", icon: User, isActive: active === "account" },
        ],
      },
    ],
    user,
  }
}
