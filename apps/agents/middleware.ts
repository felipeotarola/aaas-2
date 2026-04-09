import { type NextRequest, NextResponse } from "next/server"

import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware"

const LOGIN_PATH = "/login"
const ONBOARDING_PATH = "/onboarding"

// Feature flag: treat everyone as not-onboarded for testing
const FORCE_ONBOARDING = process.env.FORCE_ONBOARDING === "true"

export async function middleware(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLoginRoute = pathname === LOGIN_PATH
  const isOnboardingRoute = pathname === ONBOARDING_PATH

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
  const isOnboarded = FORCE_ONBOARDING ? false : profile?.is_onboarded === true

  // Admins skip onboarding entirely
  if (isAdmin) {
    if (isOnboardingRoute) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return response
  }

  // Non-admin, not onboarded → force onboarding
  if (!isOnboarded && !isOnboardingRoute) {
    return NextResponse.redirect(new URL(ONBOARDING_PATH, request.url))
  }

  // Already onboarded → don't let them back into onboarding
  if (isOnboarded && isOnboardingRoute) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
