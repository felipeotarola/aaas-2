import type { CatalogAgent } from "@/app/agents/data/contracts"

export type OnboardingStep = "choose-agent" | "chat"

export type OnboardingState = {
  step: OnboardingStep
  selectedAgentId: string | null
}

export type OnboardingAgent = {
  id: string
  name: string
  description: string
  icon: "bot" | "code" | "pencil" | "briefcase" | "heart" | "megaphone" | "graduation" | "shield"
  color: string
  category: string
  capabilities: string[]
  /** Quick-pick suggestions shown during the "describe your agent" step */
  suggestions: string[]
}

/** Data collected during the onboarding chat */
export type OnboardingCollectedData = {
  userName: string | null
  agentName: string | null
  agentDescription: string | null
  knowledgeSources: KnowledgeSource[]
  channels: ChannelChoice[]
}

export type ChannelChoice = "whatsapp" | "telegram"

export type KnowledgeSource =
  | { type: "url"; value: string }
  | { type: "file"; name: string; size: number }

/** The conversation-step ids the chat engine walks through */
export type ChatStepId =
  | "greet"
  | "ask-user-name"
  | "ask-agent-name"
  | "ask-agent-description"
  | "ask-files"
  | "ask-urls"
  | "ask-channels"
  | "confirm"
  | "done"

export const ONBOARDING_AGENTS: OnboardingAgent[] = [
  {
    id: "customer-support",
    name: "Customer Support",
    description: "Handle customer inquiries, resolve tickets, and provide 24/7 automated assistance.",
    icon: "heart",
    color: "from-rose-500 to-pink-500",
    category: "Support",
    capabilities: ["Ticket resolution", "FAQ handling", "Live chat", "Sentiment analysis"],
    suggestions: ["Help customers with billing questions", "Answer product FAQs 24/7", "Handle refund and return requests", "Triage and route support tickets"],
  },
  {
    id: "sales-assistant",
    name: "Sales Assistant",
    description: "Qualify leads, schedule demos, and guide prospects through your sales funnel.",
    icon: "briefcase",
    color: "from-amber-500 to-orange-500",
    category: "Sales",
    capabilities: ["Lead qualification", "Demo scheduling", "Follow-ups", "CRM updates"],
    suggestions: ["Qualify and route inbound leads", "Book demo calls with prospects", "Follow up on abandoned carts", "Send personalized outreach messages"],
  },
  {
    id: "content-writer",
    name: "Content Writer",
    description: "Generate blog posts, social media content, newsletters, and marketing copy.",
    icon: "pencil",
    color: "from-violet-500 to-purple-500",
    category: "Marketing",
    capabilities: ["Blog writing", "Social media", "SEO optimization", "Tone adaptation"],
    suggestions: ["Write weekly blog posts about tech", "Create social media captions daily", "Draft email newsletters for subscribers", "Generate product launch copy"],
  },
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    description: "Review pull requests, suggest improvements, and enforce coding standards.",
    icon: "code",
    color: "from-emerald-500 to-green-500",
    category: "Engineering",
    capabilities: ["Code review", "Debugging", "Documentation", "Best practices"],
    suggestions: ["Review PRs and suggest improvements", "Enforce our coding standards", "Generate documentation from code", "Catch bugs before they ship"],
  },
  {
    id: "marketing-strategist",
    name: "Marketing Strategist",
    description: "Plan campaigns, analyze market trends, and optimize your marketing efforts.",
    icon: "megaphone",
    color: "from-blue-500 to-indigo-500",
    category: "Marketing",
    capabilities: ["Campaign planning", "Market analysis", "A/B testing", "ROI tracking"],
    suggestions: ["Plan our next product launch campaign", "Analyze competitor marketing strategies", "Optimize ad spend across channels", "Build a monthly content calendar"],
  },
  {
    id: "research-analyst",
    name: "Research Analyst",
    description: "Gather insights, summarize reports, and perform competitive analysis.",
    icon: "graduation",
    color: "from-teal-500 to-cyan-500",
    category: "Research",
    capabilities: ["Web research", "Data analysis", "Report generation", "Fact checking"],
    suggestions: ["Summarize industry reports weekly", "Track competitor product launches", "Research market sizing for new ideas", "Compile data-driven insights for the team"],
  },
  {
    id: "security-auditor",
    name: "Security Auditor",
    description: "Monitor vulnerabilities, audit configurations, and enforce security best practices.",
    icon: "shield",
    color: "from-slate-500 to-zinc-500",
    category: "Engineering",
    capabilities: ["Vulnerability scanning", "Config auditing", "Compliance", "Threat analysis"],
    suggestions: ["Scan our repos for vulnerabilities", "Audit cloud infrastructure configs", "Monitor for dependency CVEs", "Enforce SOC 2 compliance checks"],
  },
]
