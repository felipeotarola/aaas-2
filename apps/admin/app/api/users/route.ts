import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import type { User } from "@supabase/supabase-js"

import { isAdminUser } from "@/lib/auth/profiles"
import { getSupabaseUrl } from "@/lib/supabase/config"
import { createSupabaseServerClient } from "@/lib/supabase/server"

type AdminListUser = {
  id: string
  email: string
  name: string
  createdAt: string | null
  lastSignInAt: string | null
  isAdmin: boolean
}

type ProfileRow = {
  id: string
  full_name: string | null
  name: string | null
  is_admin: boolean | null
}

type ProfileRowWithoutFullName = {
  id: string
  name: string | null
  is_admin: boolean | null
}

function toNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? ""
  const fromLocal = localPart
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

  return fromLocal || "User"
}

function normalizeName(profile: ProfileRow | null, fallbackEmail: string): string {
  const fullName = profile?.full_name?.trim()
  if (fullName) return fullName

  const name = profile?.name?.trim()
  if (name) return name

  return toNameFromEmail(fallbackEmail)
}

function isMissingFullNameColumn(error: { code?: string; message: string }): boolean {
  if (error.code === "42703") return true
  return /column\s+profiles\.full_name\s+does not exist/i.test(error.message)
}

async function ensureAdmin(): Promise<NextResponse | null> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = await isAdminUser(supabase, user)
  if (!admin) {
    return NextResponse.json({ error: "Forbidden: admin access required." }, { status: 403 })
  }

  return null
}

export async function GET() {
  const authError = await ensureAdmin()
  if (authError) return authError

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Missing SUPABASE_SERVICE_ROLE_KEY. Add it in apps/admin/.env.local to list all registered users.",
      },
      { status: 500 },
    )
  }

  const adminClient = createClient(getSupabaseUrl(), serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const users: User[] = []

  let page = 1
  const perPage = 200

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage })
    if (error) {
      return NextResponse.json({ error: `Failed to list users: ${error.message}` }, { status: 500 })
    }

    users.push(...data.users)

    const total = data.total ?? data.users.length
    if (users.length >= total || data.users.length < perPage) {
      break
    }

    page += 1
  }

  const userIds = users.map((user) => user.id)
  const profileById = new Map<string, ProfileRow>()

  if (userIds.length > 0) {
    const { data: profilesWithFullName, error: profilesWithFullNameError } = await adminClient
      .from("profiles")
      .select("id, full_name, name, is_admin")
      .in("id", userIds)

    let profiles: ProfileRow[] | null = profilesWithFullName ?? null
    let profilesError = profilesWithFullNameError

    if (profilesError && isMissingFullNameColumn(profilesError)) {
      const { data: fallbackProfiles, error: fallbackProfilesError } = await adminClient
        .from("profiles")
        .select("id, name, is_admin")
        .in("id", userIds)

      if (!fallbackProfilesError) {
        profiles = (fallbackProfiles as ProfileRowWithoutFullName[]).map((profile) => ({
          id: profile.id,
          full_name: null,
          name: profile.name,
          is_admin: profile.is_admin,
        }))
        profilesError = null
      } else {
        profilesError = fallbackProfilesError
      }
    }

    if (profilesError) {
      return NextResponse.json({ error: `Failed to load profile metadata: ${profilesError.message}` }, { status: 500 })
    }

    for (const profile of profiles ?? []) {
      profileById.set(profile.id, profile)
    }
  }

  const rows: AdminListUser[] = users.map((user) => {
    const email = user.email ?? "no-email"
    const profile = profileById.get(user.id) ?? null

    return {
      id: user.id,
      email,
      name: normalizeName(profile, email),
      createdAt: user.created_at ?? null,
      lastSignInAt: user.last_sign_in_at ?? null,
      isAdmin: profile?.is_admin === true,
    }
  })

  rows.sort((a, b) => {
    const aTs = a.createdAt ? Date.parse(a.createdAt) : 0
    const bTs = b.createdAt ? Date.parse(b.createdAt) : 0
    return bTs - aTs
  })

  return NextResponse.json({ users: rows })
}
