"use client"

import * as React from "react"
import {
  Bot,
  LayoutDashboard,
} from "lucide-react"
import { Dashboard11, type Dashboard11Data } from "@workspace/ui/components/dashboard11"
import { useSidebarUser, type SidebarUser } from "@/lib/auth/use-sidebar-user"

const defaultAgentsSidebarUser: SidebarUser = {
  name: "Jane Customer",
  email: "jane@aaas.local",
  avatar: "https://github.com/shadcn.png",
}

export default function Page() {
  const sidebarUser = useSidebarUser(defaultAgentsSidebarUser)

  const agentsData: Partial<Dashboard11Data> = {
    headerTitle: "Agents Dashboard",
    sidebarData: {
      logo: {
        src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblocks-logo.svg",
        alt: "Agents App",
        title: "Agents App",
        description: "Agents View",
      },
      navGroups: [
        {
          title: "Home",
          defaultOpen: true,
          items: [
            { label: "Dashboard", icon: LayoutDashboard, href: "/", isActive: true },
            { label: "Agents", icon: Bot, href: "/agents" },
          ],
        },
      ],
      user: {
        name: sidebarUser.name,
        email: sidebarUser.email,
        avatar: sidebarUser.avatar,
      },
    },
    kpiStats: [
      { title: "Spend", value: 12400, change: 6.5, format: "currency" },
      { title: "Conversion", value: 24.1, change: 2.8, format: "percent" },
      { title: "Orders", value: 38, change: 15, format: "number" },
      { title: "Wishlist", value: 67, change: 9, format: "number" },
      { title: "Returns", value: 2, change: -33, format: "number" },
    ],
    salesRevenue: {
      changePercent: 4.8,
      growth: [
        { label: "4w", change: 5.7 },
        { label: "13w", change: 3.9 },
        { label: "12m", change: 8.6 },
      ],
    },
    userRetention: {
      rate: 61,
      changePercent: 1.4,
    },
    storeVisits: {
      totalVisits: 328900,
      changePercent: 2.3,
      growth: [
        { label: "3m", change: 3.1 },
        { label: "6m", change: 4.2 },
        { label: "1y", change: 9.4 },
      ],
    },
  }

  return (
    <Dashboard11 data={agentsData} />
  )
}
