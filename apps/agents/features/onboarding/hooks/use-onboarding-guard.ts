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

      // When FORCE_ONBOARDING is set, the middleware handles redirection;
      // the client guard simply allows rendering the onboarding page.
      if (isOnboarded || isAdmin) {
        // Still allow if middleware sent us here (force-onboarding mode)
        if (window.location.pathname === "/onboarding") {
          setIsChecking(false)
          return
        }
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
