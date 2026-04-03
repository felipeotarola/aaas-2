import { type NextRequest, NextResponse } from "next/server"

import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware"

const LOGIN_PATH = "/login"

export async function middleware(request: NextRequest) {
  const { supabase, response } = createSupabaseMiddlewareClient(request)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isLoginRoute = request.nextUrl.pathname === LOGIN_PATH

  if (!user) {
    if (isLoginRoute) return response
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url))
  }

  if (isLoginRoute) return response

  return response
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
