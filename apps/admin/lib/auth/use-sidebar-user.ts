"use client"

import * as React from "react"

import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

export type SidebarUser = {
  name: string
  email: string
  avatar: string
}

type ProfileRow = Record<string, unknown> | null

const DEFAULT_AVATAR = "https://github.com/shadcn.png"

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getProfileName(profile: ProfileRow): string | null {
  if (!profile) return null

  const fullName = asNonEmptyString(profile.full_name)
  if (fullName) return fullName

  const name = asNonEmptyString(profile.name)
  if (name) return name

  const firstName = asNonEmptyString(profile.first_name)
  const lastName = asNonEmptyString(profile.last_name)
  if (firstName && lastName) return `${firstName} ${lastName}`
  if (firstName) return firstName
  if (lastName) return lastName

  return null
}

function getMetadataName(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null
  const record = metadata as Record<string, unknown>
  return asNonEmptyString(record.full_name) ?? asNonEmptyString(record.name)
}

function getAvatar(profile: ProfileRow, metadata: unknown): string {
  if (profile) {
    const profileAvatar = asNonEmptyString(profile.avatar_url)
    if (profileAvatar) return profileAvatar
  }

  if (metadata && typeof metadata === "object") {
    const record = metadata as Record<string, unknown>
    const metadataAvatar = asNonEmptyString(record.avatar_url) ?? asNonEmptyString(record.picture)
    if (metadataAvatar) return metadataAvatar
  }

  return DEFAULT_AVATAR
}

function getFallbackName(email: string): string {
  const localPart = email.split("@")[0]?.trim()
  if (!localPart) return "User"
  return localPart
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

async function loadSidebarUser(defaultUser: SidebarUser): Promise<SidebarUser> {
  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return defaultUser
  }

  const authUser = data.user

  let profile: ProfileRow = null
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle()

  if (profileData && typeof profileData === "object") {
    profile = profileData as Record<string, unknown>
  }

  const email =
    authUser.email ??
    asNonEmptyString(profile?.email) ??
    defaultUser.email

  const name =
    getProfileName(profile) ??
    getMetadataName(authUser.user_metadata) ??
    (email ? getFallbackName(email) : defaultUser.name)

  return {
    name,
    email,
    avatar: getAvatar(profile, authUser.user_metadata),
  }
}

export function useSidebarUser(defaultUser: SidebarUser): SidebarUser {
  const [sidebarUser, setSidebarUser] = React.useState(defaultUser)

  React.useEffect(() => {
    let mounted = true

    void loadSidebarUser(defaultUser).then((nextUser) => {
      if (mounted) {
        setSidebarUser(nextUser)
      }
    })

    return () => {
      mounted = false
    }
  }, [defaultUser])

  return sidebarUser
}
