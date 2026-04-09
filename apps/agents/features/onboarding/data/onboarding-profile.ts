import { createSupabaseBrowserClient } from "@/lib/supabase/browser"
import type { OnboardingCollectedData } from "../domain/types"

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

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { error?: string } & T

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status})`)
  }

  return payload
}

export async function completeOnboarding(args: {
  agentId: string
  collected: OnboardingCollectedData
}): Promise<void> {
  const response = await fetch("/api/onboarding/complete", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      agentId: args.agentId,
      userName: args.collected.userName,
      agentName: args.collected.agentName,
      agentDescription: args.collected.agentDescription,
      knowledgeSources: args.collected.knowledgeSources,
      channels: args.collected.channels,
    }),
  })

  await parseResponse<{ complete: boolean }>(response)
}
