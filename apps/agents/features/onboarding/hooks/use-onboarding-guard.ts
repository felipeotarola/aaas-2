"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { fetchOnboardingStatus } from "../data/onboarding-profile"

/**
 * Redirects users who are already onboarded (or admins) away from onboarding.
 * Returns loading state so the page can show a skeleton while checking.
 */
export function useOnboardingGuard() {
  const router = useRouter()
  const [isChecking, setIsChecking] = React.useState(true)

  React.useEffect(() => {
    let mounted = true

    void fetchOnboardingStatus().then(({ isOnboarded, isAdmin }) => {
      if (!mounted) return

      const hasScopedAgentSetup = new URL(window.location.href).searchParams.get("agentId")?.trim().length
      if (isAdmin || (isOnboarded && !hasScopedAgentSetup)) {
        router.replace("/")
        return
      }

      setIsChecking(false)
    })

    return () => {
      mounted = false
    }
  }, [router])

  return { isChecking }
}
