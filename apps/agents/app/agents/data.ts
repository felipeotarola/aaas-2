import { Bot, Compass, LayoutDashboard } from "lucide-react"
import type { AppShellData } from "@workspace/ui/components/app-shell"

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
        ],
      },
    ],
    user,
  }
}
