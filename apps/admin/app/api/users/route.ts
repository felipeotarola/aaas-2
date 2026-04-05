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
  [key: string]: unknown
  id: string
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

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeName(profile: ProfileRow | null, fallbackEmail: string): string {
  const fullName = asNonEmptyString(profile?.full_name)
  if (fullName) return fullName

  const name = asNonEmptyString(profile?.name)
  if (name) return name

  const firstName = asNonEmptyString(profile?.first_name)
  const lastName = asNonEmptyString(profile?.last_name)
  if (firstName && lastName) return `${firstName} ${lastName}`
  if (firstName) return firstName
  if (lastName) return lastName

  return toNameFromEmail(fallbackEmail)
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
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("*")
      .in("id", userIds)

    if (profilesError) {
      return NextResponse.json({ error: `Failed to load profile metadata: ${profilesError.message}` }, { status: 500 })
    }

    for (const profile of profiles ?? []) {
      const row = profile as ProfileRow
      if (typeof row.id === "string") {
        profileById.set(row.id, row)
      }
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
