"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  ChooseAgentStep,
  OnboardingChat,
  useOnboardingGuard,
  markOnboarded,
} from "@/features/onboarding"
import type { OnboardingStep, OnboardingCollectedData } from "@/features/onboarding"
import { Skeleton } from "@workspace/ui/components/skeleton"

export default function OnboardingPage() {
  const router = useRouter()
  const { isChecking } = useOnboardingGuard()
  const [step, setStep] = React.useState<OnboardingStep>("choose-agent")
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null)

  const handleComplete = async (data: OnboardingCollectedData) => {
    // TODO: persist collected data to backend
    console.log("Onboarding complete", { agentId: selectedAgentId, ...data })

    try {
      await markOnboarded()
      router.replace("/")
    } catch {
      // If marking fails, still navigate — the user finished the flow
      router.replace("/")
    }
  }

  if (isChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </main>
    )
  }

  if (step === "chat" && selectedAgentId) {
    return (
      <main className="flex h-screen flex-col">
        <OnboardingChat
          agentId={selectedAgentId}
          onBack={() => setStep("choose-agent")}
          onComplete={(data) => void handleComplete(data)}
        />
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-6 py-12">
      <ChooseAgentStep
        selectedAgentId={selectedAgentId}
        onSelect={setSelectedAgentId}
        onContinue={() => setStep("chat")}
      />
    </main>
  )
}
