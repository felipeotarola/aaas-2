"use client"

import * as React from "react"
import {
  Bot,
  LayoutDashboard,
} from "lucide-react"
import { Dashboard11, type Dashboard11Data } from "@workspace/ui/components/dashboard11"
import { useSidebarUser, type SidebarUser } from "@/lib/auth/use-sidebar-user"

const defaultAdminSidebarUser: SidebarUser = {
  name: "Admin User",
  email: "admin@aaas.local",
  avatar: "https://github.com/shadcn.png",
}

export default function Page() {
  const sidebarUser = useSidebarUser(defaultAdminSidebarUser)

  const adminData: Partial<Dashboard11Data> = {
    headerTitle: "Admin Dashboard",
    sidebarData: {
      logo: {
        src: "https://deifkwefumgah.cloudfront.net/shadcnblocks/block/logos/shadcnblocks-logo.svg",
        alt: "Admin Console",
        title: "Admin Console",
        description: "Operations",
      },
      navGroups: [
        {
          title: "Overview",
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
      { title: "MRR", value: 612000, change: 7.1, format: "currency" },
      { title: "Churn", value: 3.2, change: -1.1, format: "percent" },
      { title: "Open Incidents", value: 14, change: -22, format: "number" },
      { title: "Active Tenants", value: 187, change: 11, format: "number" },
      { title: "New Signups", value: 49, change: 18, format: "number" },
    ],
    salesRevenue: {
      changePercent: 10.3,
      growth: [
        { label: "4w", change: 12.2 },
        { label: "13w", change: 9.4 },
        { label: "12m", change: 21.8 },
      ],
    },
    userRetention: {
      rate: 82,
      changePercent: 3.1,
    },
    storeVisits: {
      totalVisits: 1845000,
      changePercent: 5.4,
      growth: [
        { label: "3m", change: 7.2 },
        { label: "6m", change: 12.1 },
        { label: "1y", change: 24.7 },
      ],
    },
  }

  return (
    <Dashboard11 data={adminData} />
  )
}
