export { ChooseAgentStep } from "./components/choose-agent-step"
export { OnboardingChat } from "./components/onboarding-chat"
export { useOnboardingGuard } from "./hooks/use-onboarding-guard"
export { fetchOnboardingAgents } from "./data/onboarding-agents"
export {
  completeOnboarding,
  fetchLatestOnboardingProgress,
  fetchOnboardingProgressForAgent,
  fetchOnboardingStatus,
  markOnboarded,
  saveOnboardingProgress,
} from "./data/onboarding-profile"
export type {
  OnboardingStep,
  OnboardingState,
  OnboardingAgent,
  OnboardingCollectedData,
  OnboardingProgressSnapshot,
  PersistedOnboardingProgress,
  KnowledgeSource,
  ChannelChoice,
  ChatStepId,
} from "./domain/types"
