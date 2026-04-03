import { type NextRequest, NextResponse } from "next/server"

import { isAdminUser } from "@/lib/auth/profiles"
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware"

const LOGIN_PATH = "/login"

function redirectToLogin(request: NextRequest, reason?: string) {
  const loginUrl = new URL(LOGIN_PATH, request.url)
  if (reason) {
    loginUrl.searchParams.set("reason", reason)
  }

  return NextResponse.redirect(loginUrl)
}

export async function middleware(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginRoute = request.nextUrl.pathname === LOGIN_PATH

  if (!user) {
    if (isLoginRoute) return response
    return redirectToLogin(request)
  }

  const isAdmin = await isAdminUser(supabase, user)

  if (!isAdmin) {
    if (isLoginRoute) return response
    return redirectToLogin(request, "admin_required")
  }

  if (isLoginRoute) return response

  return response
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
