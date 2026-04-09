"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Bot,
  Briefcase,
  Code,
  GraduationCap,
  Heart,
  Megaphone,
  Pencil,
  Shield,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"
import { ONBOARDING_AGENTS, type OnboardingAgent } from "../domain/types"

type ChooseAgentStepProps = {
  selectedAgentId: string | null
  onSelect: (agentId: string) => void
  onContinue: () => void
}

const ICON_MAP: Record<OnboardingAgent["icon"], React.ComponentType<{ className?: string }>> = {
  bot: Bot,
  code: Code,
  pencil: Pencil,
  briefcase: Briefcase,
  heart: Heart,
  megaphone: Megaphone,
  graduation: GraduationCap,
  shield: Shield,
}

function AgentCard({
  agent,
  index,
  isSelected,
  onSelect,
}: {
  agent: OnboardingAgent
  index: number
  isSelected: boolean
  onSelect: () => void
}) {
  const Icon = ICON_MAP[agent.icon]
  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelect}
      className={cn(
        "group relative flex flex-col items-start gap-4 rounded-xl border p-6 text-left transition-all duration-300",
        "hover:shadow-lg hover:shadow-accent/5",
        isSelected
          ? "border-accent/50 bg-card/80"
          : "border-border/50 bg-card hover:border-accent/50 hover:bg-card/80",
      )}
    >
      {/* Gradient icon */}
      <div
        className={cn(
          "flex size-12 items-center justify-center rounded-xl bg-gradient-to-br transition-transform duration-300",
          agent.color,
          isHovered && "scale-110",
        )}
      >
        <Icon className="size-6 text-white" />
      </div>

      {/* Title + arrow */}
      <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        {agent.name}
        <ArrowRight
          className={cn(
            "size-4 transition-all duration-300",
            isHovered || isSelected
              ? "translate-x-0 opacity-100"
              : "-translate-x-2 opacity-0",
          )}
        />
      </h3>

      {/* Description */}
      <p className="text-sm leading-relaxed text-muted-foreground">
        {agent.description}
      </p>

      {/* Capability pills */}
      <div className="mt-auto flex flex-wrap gap-2">
        {agent.capabilities.slice(0, 3).map((cap) => (
          <span
            key={cap}
            className="rounded-full bg-secondary px-2 py-1 text-xs text-secondary-foreground"
          >
            {cap}
          </span>
        ))}
      </div>

      {/* Hover glow overlay */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-br opacity-0 transition-opacity duration-300",
          agent.color,
          (isHovered || isSelected) && "opacity-5",
        )}
      />
    </motion.button>
  )
}

export function ChooseAgentStep({
  selectedAgentId,
  onSelect,
  onContinue,
}: ChooseAgentStepProps) {
  return (
    <div className="flex flex-col gap-10">
      <motion.header
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-3 text-center"
      >
        <h1 className="text-balance text-4xl font-bold tracking-tight md:text-5xl">
          Choose your agent
        </h1>
        <p className="mx-auto max-w-2xl text-pretty text-lg text-muted-foreground">
          Select an AI agent to personalize and deploy. Each agent specializes in
          different tasks and can be customized to your needs.
        </p>
      </motion.header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ONBOARDING_AGENTS.map((agent, i) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            index={i}
            isSelected={selectedAgentId === agent.id}
            onSelect={() => {
              onSelect(agent.id)
              onContinue()
            }}
          />
        ))}
      </div>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="text-center"
      >
        <p className="text-sm text-muted-foreground">
          Powered by advanced AI models. Your agent learns and adapts to your preferences.
        </p>
      </motion.footer>
    </div>
  )
}
