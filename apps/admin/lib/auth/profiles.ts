import type { SupabaseClient, User } from "@supabase/supabase-js"

export async function isAdminUser(supabase: SupabaseClient, user: User): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>()

  if (error) {
    return false
  }

  return data?.is_admin === true
}
