"use client"

import * as React from "react"
import { Bot, LayoutDashboard, User, Users } from "lucide-react"
import { AppShell, type AppShellData } from "@workspace/ui/components/app-shell"
import { useSidebarUser, type SidebarUser } from "@/lib/auth/use-sidebar-user"

type ListedUser = {
  id: string
  email: string
  name: string
  createdAt: string | null
  lastSignInAt: string | null
  isAdmin: boolean
}

const defaultAdminSidebarUser: SidebarUser = {
  name: "Admin User",
  email: "admin@aaas.local",
  avatar: "https://github.com/shadcn.png",
}

const adminSidebarBase: Omit<AppShellData, "user"> = {
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
        { label: "Agents", href: "/agents", icon: Bot },
        { label: "Users", href: "/users", icon: Users, isActive: true },
        { label: "Account", href: "/account", icon: User },
      ],
    },
  ],
}

function formatTimestamp(value: string | null): string {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export default function AdminUsersPage() {
  const sidebarUser = useSidebarUser(defaultAdminSidebarUser)
  const [users, setUsers] = React.useState<ListedUser[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const sidebarData = React.useMemo<AppShellData>(
    () => ({
      ...adminSidebarBase,
      user: {
        name: sidebarUser.name,
        email: sidebarUser.email,
        avatar: sidebarUser.avatar,
      },
    }),
    [sidebarUser],
  )

  React.useEffect(() => {
    let mounted = true

    const loadUsers = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch("/api/users", { cache: "no-store" })
        const payload = (await response.json()) as { users?: ListedUser[]; error?: string }

        if (!response.ok) {
          throw new Error(payload.error || "Failed to load users.")
        }

        if (mounted) {
          setUsers(payload.users ?? [])
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load users.")
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void loadUsers()

    return () => {
      mounted = false
    }
  }, [])

  const adminCount = users.filter((user) => user.isAdmin).length

  return (
    <AppShell sidebar={sidebarData}>
      <main id="page-main" className="flex h-full w-full flex-1 flex-col gap-6 overflow-auto p-6 md:p-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Registered Users</h1>
          <p className="text-sm text-muted-foreground">
            Alla registrerade användare från Supabase Auth.
          </p>
        </header>

        {error ? (
          <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-2">
          <article className="border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total Users</p>
            <p className="mt-1 text-2xl font-semibold">{isLoading ? "-" : users.length}</p>
          </article>
          <article className="border bg-card p-4">
            <p className="text-xs text-muted-foreground">Admins</p>
            <p className="mt-1 text-2xl font-semibold">{isLoading ? "-" : adminCount}</p>
          </article>
        </section>

        <section className="border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">User List</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">User ID</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Last Sign In</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 font-medium">{user.name}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{user.id}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatTimestamp(user.createdAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatTimestamp(user.lastSignInAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex border px-2 py-0.5 text-xs ${
                          user.isAdmin
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {user.isAdmin ? "admin" : "user"}
                      </span>
                    </td>
                  </tr>
                ))}
                {!isLoading && users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                ) : null}
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Loading users...
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </AppShell>
  )
}
