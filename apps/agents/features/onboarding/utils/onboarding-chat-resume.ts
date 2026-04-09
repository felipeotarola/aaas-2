import type { ChatStepId } from "../domain/types"

export function buildOnboardingResumePrompt(chatStep: ChatStepId): string {
  switch (chatStep) {
    case "ask-user-name":
      return "Welcome back. We saved your progress. What is your name?"
    case "ask-agent-name":
      return "Welcome back. Continue by picking your agent name."
    case "ask-agent-description":
      return "Welcome back. Continue by describing what the agent should do."
    case "ask-files":
      return "Welcome back. Add documents or files, then continue."
    case "ask-urls":
      return "Welcome back. Add any important links, then continue."
    case "ask-channels":
      return "Welcome back. Select channels to connect, then continue."
    case "connect-channels":
      return "Welcome back. Continue connecting channels, or continue without them for now."
    case "confirm":
      return "Welcome back. Review your setup summary and confirm when ready."
    case "done":
      return "Finalizing your onboarding."
    case "greet":
    default:
      return "Welcome back. Let's continue your onboarding."
  }
}
