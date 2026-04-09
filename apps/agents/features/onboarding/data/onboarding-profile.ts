import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

export async function fetchOnboardingStatus(): Promise<{
  isOnboarded: boolean
  isAdmin: boolean
}> {
  const supabase = createSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { isOnboarded: false, isAdmin: false }
  }

  const { data } = await supabase
    .from("profiles")
    .select("is_onboarded, is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_onboarded: boolean; is_admin: boolean }>()

  return {
    isOnboarded: data?.is_onboarded === true,
    isAdmin: data?.is_admin === true,
  }
}

export async function markOnboarded(): Promise<void> {
  const supabase = createSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error("Not authenticated")

  const { error } = await supabase
    .from("profiles")
    .update({ is_onboarded: true })
    .eq("id", user.id)

  if (error) throw new Error(error.message)
}
