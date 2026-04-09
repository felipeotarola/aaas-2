export { ChooseAgentStep } from "./components/choose-agent-step"
export { OnboardingChat } from "./components/onboarding-chat"
export { useOnboardingGuard } from "./hooks/use-onboarding-guard"
export { fetchOnboardingStatus, markOnboarded } from "./data/onboarding-profile"
export { ONBOARDING_AGENTS } from "./domain/types"
export type {
  OnboardingStep,
  OnboardingState,
  OnboardingAgent,
  OnboardingCollectedData,
  KnowledgeSource,
  ChannelChoice,
  ChatStepId,
} from "./domain/types"
