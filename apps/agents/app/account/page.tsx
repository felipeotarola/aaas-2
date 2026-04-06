"use client"

import * as React from "react"
import { KeyRound, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { AppShell } from "@workspace/ui/components/app-shell"
import { useSidebarUser } from "@/lib/auth/use-sidebar-user"
import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import { defaultAgentsSidebarUser, getConsumerSidebar } from "@/app/agents/data"

type ProfileRow = {
  [key: string]: unknown
}

function asNullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getMissingProfilesColumn(error: {
  code?: string | null
  message?: string | null
  details?: string | null
  hint?: string | null
}): string | null {
  const text = [error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" | ")

  if (!text) return null

  const patterns = [
    /column\s+profiles\.([a-z_][a-z0-9_]*)\s+does not exist/i,
    /could not find the ['"]([a-z_][a-z0-9_]*)['"] column of ['"]profiles['"] in the schema cache/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1]
  }

  return null
}

async function upsertProfileWithColumnFallback(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  args: {
    id: string
    email: string | null
    fullName: string
    displayName: string
    firstName: string
    lastName: string
  },
) {
  const optionalFields = ["full_name", "name", "first_name", "last_name"] as const
  let activeFields = [...optionalFields]

  while (true) {
    const payload: Record<string, string | null> = {
      id: args.id,
      email: args.email,
    }

    if (activeFields.includes("full_name")) payload.full_name = asNullable(args.fullName)
    if (activeFields.includes("name")) payload.name = asNullable(args.displayName)
    if (activeFields.includes("first_name")) payload.first_name = asNullable(args.firstName)
    if (activeFields.includes("last_name")) payload.last_name = asNullable(args.lastName)

    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" })
    if (!error) return payload

    const missingColumn = getMissingProfilesColumn(error)
    if (missingColumn && activeFields.includes(missingColumn as (typeof optionalFields)[number])) {
      activeFields = activeFields.filter((field) => field !== missingColumn)
      continue
    }

    throw new Error(error.message)
  }
}

export default function AgentsAccountPage() {
  const router = useRouter()
  const sidebarUser = useSidebarUser(defaultAgentsSidebarUser)
  const [userId, setUserId] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [fullName, setFullName] = React.useState("")
  const [displayName, setDisplayName] = React.useState("")
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSavingProfile, setIsSavingProfile] = React.useState(false)
  const [isSavingPassword, setIsSavingPassword] = React.useState(false)
  const [profileMessage, setProfileMessage] = React.useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = React.useState<string | null>(null)
  const [profileError, setProfileError] = React.useState<string | null>(null)
  const [passwordError, setPasswordError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let mounted = true

    const loadAccount = async () => {
      setIsLoading(true)
      setProfileError(null)

      const supabase = createSupabaseBrowserClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        if (mounted) {
          router.replace("/login")
        }
        return
      }

      const { data: profile, error: profileLoadError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>()

      if (mounted) {
        setUserId(user.id)
        setEmail(asNonEmptyString(profile?.email) ?? user.email ?? "")
        setFullName(asNonEmptyString(profile?.full_name) ?? "")
        setDisplayName(asNonEmptyString(profile?.name) ?? "")
        setFirstName(asNonEmptyString(profile?.first_name) ?? "")
        setLastName(asNonEmptyString(profile?.last_name) ?? "")

        if (profileLoadError) {
          setProfileError(profileLoadError.message)
        }

        setIsLoading(false)
      }
    }

    void loadAccount()

    return () => {
      mounted = false
    }
  }, [router])

  const handleSaveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSavingProfile(true)
    setProfileError(null)
    setProfileMessage(null)

    try {
      const supabase = createSupabaseBrowserClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        throw new Error("You need to sign in again.")
      }

      const profilePayload = await upsertProfileWithColumnFallback(supabase, {
        id: user.id,
        email: user.email ?? null,
        fullName,
        displayName,
        firstName,
        lastName,
      })

      const { error: authSaveError } = await supabase.auth.updateUser({
        data: {
          full_name: profilePayload.full_name ?? null,
          name: profilePayload.name ?? null,
          first_name: profilePayload.first_name ?? null,
          last_name: profilePayload.last_name ?? null,
        },
      })

      if (authSaveError) {
        throw new Error(authSaveError.message)
      }

      setProfileMessage("Profile updated.")
      router.refresh()
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Failed to save profile.")
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPasswordError(null)
    setPasswordMessage(null)

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.")
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.")
      return
    }

    setIsSavingPassword(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        throw new Error(error.message)
      }

      setNewPassword("")
      setConfirmPassword("")
      setPasswordMessage("Password updated.")
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Failed to update password.")
    } finally {
      setIsSavingPassword(false)
    }
  }

  return (
    <AppShell sidebar={getConsumerSidebar("account", sidebarUser)}>
      <main id="page-main" className="flex h-full w-full flex-1 flex-col gap-6 overflow-auto p-6 md:p-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
          <p className="text-sm text-muted-foreground">
            Update your profile details and password.
          </p>
        </header>

        <section className="border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold">Profile</h2>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSaveProfile}>
            <label className="grid gap-1.5 text-sm">
              Full name
              <Input value={fullName} onChange={(event) => setFullName(event.target.value)} disabled={isLoading} />
            </label>
            <label className="grid gap-1.5 text-sm">
              Display name
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={isLoading} />
            </label>
            <label className="grid gap-1.5 text-sm">
              First name
              <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={isLoading} />
            </label>
            <label className="grid gap-1.5 text-sm">
              Last name
              <Input value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={isLoading} />
            </label>
            <label className="grid gap-1.5 text-sm">
              Email
              <Input value={email} disabled />
            </label>
            <label className="grid gap-1.5 text-sm">
              User ID
              <Input value={userId} disabled className="font-mono text-xs" />
            </label>
            <div className="md:col-span-2">
              {profileError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{profileError}</p>
              ) : null}
              {profileMessage ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-300">{profileMessage}</p>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={isSavingProfile || isLoading} className="gap-2">
                <Save className="size-4" />
                {isSavingProfile ? "Saving..." : "Save profile"}
              </Button>
            </div>
          </form>
        </section>

        <section className="border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold">Password</h2>
          <form className="grid gap-3 md:max-w-xl" onSubmit={handleChangePassword}>
            <label className="grid gap-1.5 text-sm">
              New password
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              Confirm new password
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            {passwordError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
            ) : null}
            {passwordMessage ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-300">{passwordMessage}</p>
            ) : null}
            <div>
              <Button type="submit" disabled={isSavingPassword} className="gap-2">
                <KeyRound className="size-4" />
                {isSavingPassword ? "Updating..." : "Update password"}
              </Button>
            </div>
          </form>
        </section>
      </main>
    </AppShell>
  )
}
