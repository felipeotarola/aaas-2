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
  email: string | null
  full_name: string | null
  name: string | null
  first_name: string | null
  last_name: string | null
}

function asNullable(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
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
        .select("email, full_name, name, first_name, last_name")
        .eq("id", user.id)
        .maybeSingle<ProfileRow>()

      if (mounted) {
        setUserId(user.id)
        setEmail(profile?.email ?? user.email ?? "")
        setFullName(profile?.full_name ?? "")
        setDisplayName(profile?.name ?? "")
        setFirstName(profile?.first_name ?? "")
        setLastName(profile?.last_name ?? "")

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

      const profilePayload = {
        id: user.id,
        email: user.email ?? null,
        full_name: asNullable(fullName),
        name: asNullable(displayName),
        first_name: asNullable(firstName),
        last_name: asNullable(lastName),
      }

      const { error: profileSaveError } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" })

      if (profileSaveError) {
        throw new Error(profileSaveError.message)
      }

      const { error: authSaveError } = await supabase.auth.updateUser({
        data: {
          full_name: profilePayload.full_name,
          name: profilePayload.name,
          first_name: profilePayload.first_name,
          last_name: profilePayload.last_name,
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
