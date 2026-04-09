"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import {
  ChooseAgentStep,
  OnboardingChat,
  completeOnboarding,
  fetchOnboardingAgents,
  useOnboardingGuard,
} from "@/features/onboarding"
import type { OnboardingStep, OnboardingCollectedData, OnboardingAgent } from "@/features/onboarding"
import { Skeleton } from "@workspace/ui/components/skeleton"

export default function OnboardingPage() {
  const router = useRouter()
  const { isChecking } = useOnboardingGuard()
  const [step, setStep] = React.useState<OnboardingStep>("choose-agent")
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null)
  const [availableAgents, setAvailableAgents] = React.useState<OnboardingAgent[]>([])
  const [isAgentsLoading, setIsAgentsLoading] = React.useState(true)
  const [agentsError, setAgentsError] = React.useState<string | null>(null)
  const [completionError, setCompletionError] = React.useState<string | null>(null)
  const [isCompleting, setIsCompleting] = React.useState(false)
  const selectedAgent = React.useMemo(
    () => availableAgents.find((agent) => agent.id === selectedAgentId) ?? null,
    [availableAgents, selectedAgentId],
  )

  const loadAgents = React.useCallback(async () => {
    setIsAgentsLoading(true)
    setAgentsError(null)

    try {
      const runtimeAgents = await fetchOnboardingAgents()
      setAvailableAgents(runtimeAgents)
    } catch (error) {
      setAvailableAgents([])
      setAgentsError(error instanceof Error ? error.message : "Failed to load agents")
    } finally {
      setIsAgentsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadAgents()
  }, [loadAgents])

  const handleComplete = async (data: OnboardingCollectedData) => {
    if (isCompleting) return

    setCompletionError(null)
    setIsCompleting(true)

    try {
      if (!selectedAgentId) {
        throw new Error("No agent selected")
      }

      await completeOnboarding({ agentId: selectedAgentId, collected: data })
      router.replace("/")
    } catch (error) {
      console.error("Failed to mark onboarding complete", error)
      setCompletionError("Could not save onboarding status. Please try again.")
    } finally {
      setIsCompleting(false)
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

  if (step === "chat" && selectedAgent) {
    return (
      <main className="flex h-screen flex-col">
        {completionError ? (
          <div className="border-b border-destructive/25 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {completionError}
          </div>
        ) : null}
        <OnboardingChat
          agent={selectedAgent}
          isCompleting={isCompleting}
          onBack={() => setStep("choose-agent")}
          onComplete={(data) => void handleComplete(data)}
        />
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-6 py-12">
      <ChooseAgentStep
        agents={availableAgents}
        selectedAgentId={selectedAgentId}
        isLoading={isAgentsLoading}
        error={agentsError}
        onRetry={() => void loadAgents()}
        onSelect={setSelectedAgentId}
        onContinue={() => {
          setCompletionError(null)
          setStep("chat")
        }}
      />
    </main>
  )
}
