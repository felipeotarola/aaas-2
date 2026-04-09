import { type NextRequest, NextResponse } from "next/server"

import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware"

const LOGIN_PATH = "/login"
const ONBOARDING_PATH = "/onboarding"

export async function middleware(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLoginRoute = pathname === LOGIN_PATH
  const isOnboardingRoute = pathname === ONBOARDING_PATH
  const onboardingAgentId = request.nextUrl.searchParams.get("agentId")?.trim() ?? ""

  if (!user) {
    if (isLoginRoute) return response
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url))
  }

  if (isLoginRoute) return response

  // Check onboarding status for non-admin users
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_onboarded")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean; is_onboarded: boolean }>()

  const isAdmin = profile?.is_admin === true
  const isOnboarded = profile?.is_onboarded === true

  // Admins skip the initial onboarding gate but can do scoped agent setups
  if (isAdmin) {
    if (isOnboardingRoute && onboardingAgentId.length === 0) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return response
  }

  // First-login users must complete onboarding before accessing the app.
  if (!isOnboarded && !isOnboardingRoute) {
    return NextResponse.redirect(new URL(ONBOARDING_PATH, request.url))
  }

  // After initial onboarding, only allow onboarding route when targeting
  // a specific agent setup flow (launched from Discover Agents).
  if (isOnboarded && isOnboardingRoute && onboardingAgentId.length === 0) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
