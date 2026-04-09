"use client"

import * as React from "react"
import { AnimatePresence } from "framer-motion"
import { ArrowLeft, Bot, Link2, Send, Upload } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  ONBOARDING_AGENTS,
  type ChannelChoice,
  type ChatStepId,
  type KnowledgeSource,
  type OnboardingAgent,
  type OnboardingCollectedData,
} from "../domain/types"
import {
  type ChatMessage,
  ChannelCard,
  MessageBubble,
  SourcePill,
  TypingIndicator,
  makeMsg,
} from "./chat-ui"

type OnboardingChatProps = {
  agentId: string
  onBack: () => void
  onComplete: (data: OnboardingCollectedData) => void
}

function getAgent(agentId: string): OnboardingAgent | undefined {
  return ONBOARDING_AGENTS.find((a) => a.id === agentId)
}

function isLikelyUrl(text: string): boolean {
  return /^https?:\/\/.+/i.test(text.trim()) || /^www\..+\..+/i.test(text.trim())
}

export function OnboardingChat({ agentId, onBack, onComplete }: OnboardingChatProps) {
  const agent = getAgent(agentId)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const bottomRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [chatStep, setChatStep] = React.useState<ChatStepId>("greet")
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = React.useState("")
  const [isTyping, setIsTyping] = React.useState(false)
  const [urlInput, setUrlInput] = React.useState("")
  const [isDragging, setIsDragging] = React.useState(false)

  // Collected data
  const [userName, setUserName] = React.useState<string | null>(null)
  const [agentName, setAgentName] = React.useState<string | null>(null)
  const [agentDescription, setAgentDescription] = React.useState<string | null>(null)
  const [sources, setSources] = React.useState<KnowledgeSource[]>([])
  const [selectedChannels, setSelectedChannels] = React.useState<ChannelChoice[]>([])

  const scrollToBottom = React.useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    })
  }, [])

  React.useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, chatStep, scrollToBottom])

  const pushAssistant = React.useCallback(
    (
      content: string,
      thenStep?: ChatStepId,
      extra?: Pick<ChatMessage, "type" | "options">,
    ) => {
      setIsTyping(true)
      const timer = setTimeout(() => {
        setMessages((prev) => [...prev, makeMsg("assistant", content, extra)])
        setIsTyping(false)
        if (thenStep) setChatStep(thenStep)
      }, 700)
      return () => clearTimeout(timer)
    },
    [],
  )

  // Kick off the greeting (ref guard prevents double-fire in Strict Mode)
  const didGreet = React.useRef(false)
  React.useEffect(() => {
    if (didGreet.current || chatStep !== "greet") return
    didGreet.current = true
    const agentLabel = agent?.name ?? "your agent"
    pushAssistant(
      `Hey there! 👋 I'm going to help you set up ${agentLabel}. I'll ask a few quick questions so I can personalize everything for you.\n\nFirst — what's your name?`,
      "ask-user-name",
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Process text answers ───────────────────────────

  const processAnswer = (text: string) => {
    switch (chatStep) {
      case "ask-user-name": {
        setUserName(text)
        pushAssistant(
          `Nice to meet you, ${text}! 🎉\n\nNow, what would you like to call me? Pick a name or type your own:`,
          "ask-agent-name",
          {
            type: "choice",
            options: [
              { label: "Cai", value: "Cai" },
              { label: "Nova", value: "Nova" },
              { label: "Atlas", value: "Atlas" },
              { label: "Sage", value: "Sage" },
              { label: "Custom name…", value: "__custom__" },
            ],
          },
        )
        break
      }
      case "ask-agent-name": {
        setAgentName(text)
        const suggestions = agent?.suggestions ?? []
        pushAssistant(
          `Love it — "${text}" it is! ✨\n\nGive me a short description of what you'd like me to do — or pick one of these:`,
          "ask-agent-description",
          suggestions.length > 0
            ? {
                type: "choice",
                options: [
                  ...suggestions.map((s) => ({ label: s, value: s })),
                  { label: "Custom description…", value: "__custom__" },
                ],
              }
            : undefined,
        )
        break
      }
      case "ask-agent-description": {
        setAgentDescription(text)
        pushAssistant(
          "Perfect! Do you have any documents, files, or resources you'd like to share with me? I can use these to better understand your needs.",
          "ask-files",
        )
        break
      }
      default:
        break
    }
  }

  // ─── Knowledge handlers ─────────────────────────────

  const handleAddUrl = () => {
    const url = urlInput.trim()
    if (!url || !isLikelyUrl(url)) return
    setSources((prev) => [...prev, { type: "url", value: url }])
    setUrlInput("")
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newSources: KnowledgeSource[] = Array.from(files).map((f) => ({
      type: "file" as const,
      name: f.name,
      size: f.size,
    }))
    setSources((prev) => [...prev, ...newSources])
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (!files.length) return
    const newSources: KnowledgeSource[] = Array.from(files).map((f) => ({
      type: "file" as const,
      name: f.name,
      size: f.size,
    }))
    setSources((prev) => [...prev, ...newSources])
  }

  const removeSource = (index: number) => {
    setSources((prev) => prev.filter((_, i) => i !== index))
  }

  const fileSources = sources.filter((s) => s.type === "file")
  const urlSources = sources.filter((s) => s.type === "url")

  const handleFilesDone = () => {
    if (fileSources.length > 0) {
      setMessages((prev) => [
        ...prev,
        makeMsg("user", `Uploaded ${fileSources.length} file${fileSources.length > 1 ? "s" : ""}`),
      ])
    } else {
      setMessages((prev) => [...prev, makeMsg("user", "Skipped")])
    }
    pushAssistant(
      "Awesome! Any important links I should know about? Websites, tools, or resources you use frequently?",
      "ask-urls",
    )
  }

  const handleUrlsDone = () => {
    if (urlSources.length > 0) {
      setMessages((prev) => [
        ...prev,
        makeMsg("user", `Added ${urlSources.length} link${urlSources.length > 1 ? "s" : ""}`),
      ])
    } else {
      setMessages((prev) => [...prev, makeMsg("user", "Skipped")])
    }
    pushAssistant(
      "Almost done! Which channels would you like to connect? Select below — or hit Continue to skip.",
      "ask-channels",
    )
  }

  // ─── Channel handlers ──────────────────────────────

  const toggleChannel = (ch: ChannelChoice) => {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    )
  }

  const handleChannelsContinue = () => {
    const labels =
      selectedChannels.length > 0
        ? selectedChannels
            .map((c) => (c === "whatsapp" ? "WhatsApp" : "Telegram"))
            .join(" and ")
        : "none"
    setMessages((prev) => [
      ...prev,
      makeMsg(
        "user",
        selectedChannels.length > 0 ? `Selected: ${labels}` : "Skipped",
      ),
    ])
    showConfirmation()
  }

  // ─── Confirmation ──────────────────────────────────

  const showConfirmation = React.useCallback(() => {
    const sourcesList =
      sources.length > 0
        ? sources
            .map((s) => (s.type === "url" ? `🌐 ${s.value}` : `📎 ${s.name}`))
            .join("\n")
        : "None"
    const channelsList =
      selectedChannels.length > 0
        ? selectedChannels
            .map((c) => (c === "whatsapp" ? "📱 WhatsApp" : "✈️ Telegram"))
            .join(", ")
        : "None (you can connect later)"

    pushAssistant(
      `Here's a summary:\n\n👤 Your name: ${userName}\n🤖 Agent name: ${agentName}\n📝 Purpose: ${agentDescription}\n📚 Sources:\n${sourcesList}\n📡 Channels: ${channelsList}`,
      "confirm",
      { type: "confirmation" },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName, agentName, agentDescription, sources, selectedChannels, pushAssistant])

  const handleConfirm = () => {
    setChatStep("done")
    pushAssistant("Setting everything up for you… 🚀")
    setTimeout(() => {
      onComplete({
        userName,
        agentName,
        agentDescription,
        knowledgeSources: sources,
        channels: selectedChannels,
      })
    }, 1200)
  }

  const handleRestart = () => {
    pushAssistant("No worries! Let's start over. What's your name?", "ask-user-name")
    setUserName(null)
    setAgentName(null)
    setAgentDescription(null)
    setSources([])
    setSelectedChannels([])
  }

  // ─── Text input handlers ───────────────────────────

  const handleChoiceSelect = (value: string) => {
    if (value === "__custom__") {
      // Focus the appropriate input for manual entry
      if (chatStep === "ask-agent-description") {
        textareaRef.current?.focus()
      } else {
        inputRef.current?.focus()
      }
      return
    }
    setMessages((prev) => [...prev, makeMsg("user", value)])
    processAnswer(value)
  }

  const handleSend = () => {
    const text = inputValue.trim()
    if (!text || isTyping || chatStep === "done") return
    setMessages((prev) => [...prev, makeMsg("user", text)])
    setInputValue("")
    processAnswer(text)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ─── Step-driven footer ────────────────────────────

  const renderFooter = () => {
    switch (chatStep) {
      case "ask-user-name":
      case "ask-agent-name":
        return (
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <input
              ref={inputRef}
              placeholder={
                chatStep === "ask-user-name"
                  ? "Your name…"
                  : "Agent name…"
              }
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-12 w-full rounded-xl border px-4 text-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              autoFocus
            />
            <Button
              size="lg"
              className="h-12 w-12 shrink-0 rounded-xl"
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
              aria-label="Send"
            >
              <Send className="size-5" />
            </Button>
          </div>
        )

      case "ask-agent-description":
        return (
          <div className="mx-auto max-w-2xl space-y-3">
            <textarea
              ref={textareaRef}
              placeholder="Tell me about what your agent should do, your goals… (or skip if you prefer)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              rows={4}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-xl border px-4 py-3 text-base leading-relaxed focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMessages((prev) => [...prev, makeMsg("user", "Skipped")])
                  processAnswer("General assistant")
                }}
              >
                Skip
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={handleSend}
                disabled={!inputValue.trim() || isTyping}
              >
                <Send className="size-3.5" />
                Continue
              </Button>
            </div>
          </div>
        )

      case "ask-files":
        return (
          <div className="mx-auto max-w-2xl space-y-3">
            {fileSources.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sources.map((source, i) =>
                  source.type === "file" ? (
                    <SourcePill
                      key={`file-${i}`}
                      source={source}
                      onRemove={() => removeSource(i)}
                    />
                  ) : null,
                )}
              </div>
            )}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition-colors",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50",
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt,.md,.csv,.json"
              />
              <Upload className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Click to upload files or drag and drop
              </p>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleFilesDone}>
                {fileSources.length > 0 ? "Continue" : "Skip"}
              </Button>
            </div>
          </div>
        )

      case "ask-urls":
        return (
          <div className="mx-auto max-w-2xl space-y-3">
            {urlSources.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sources.map((source, i) =>
                  source.type === "url" ? (
                    <SourcePill
                      key={`url-${i}`}
                      source={source}
                      onRemove={() => removeSource(i)}
                    />
                  ) : null,
                )}
              </div>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  placeholder="https://…"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddUrl()
                    }
                  }}
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-12 w-full rounded-xl border pl-10 pr-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  autoFocus
                />
              </div>
              <Button
                size="lg"
                variant="outline"
                onClick={handleAddUrl}
                disabled={!urlInput.trim()}
                className="h-12 rounded-xl"
              >
                Add
              </Button>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleUrlsDone}>
                {urlSources.length > 0 ? "Continue" : "Skip"}
              </Button>
            </div>
          </div>
        )

      case "ask-channels":
        return (
          <div className="mx-auto max-w-2xl space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <ChannelCard
                channel="whatsapp"
                selected={selectedChannels.includes("whatsapp")}
                onToggle={() => toggleChannel("whatsapp")}
              />
              <ChannelCard
                channel="telegram"
                selected={selectedChannels.includes("telegram")}
                onToggle={() => toggleChannel("telegram")}
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleChannelsContinue}>
                {selectedChannels.length > 0 ? "Continue" : "Skip"}
              </Button>
            </div>
          </div>
        )

      case "done":
        return (
          <div className="mx-auto flex max-w-2xl items-center justify-center py-2">
            <p className="text-sm text-muted-foreground">
              Setting up your agent…
            </p>
          </div>
        )

      default:
        return null
    }
  }

  // ─── Render ────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={onBack}
          aria-label="Back to agent selection"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex size-8 items-center justify-center rounded-full bg-gradient-to-br",
              agent?.color ?? "from-gray-500 to-gray-600",
            )}
          >
            <Bot className="size-4 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">
              {agent?.name ?? "Agent"} Setup
            </span>
            <span className="text-xs text-muted-foreground">Onboarding</span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                agent={agent}
                onChoiceSelect={handleChoiceSelect}
                onConfirm={handleConfirm}
                onRestart={handleRestart}
              />
            ))}
            {isTyping ? <TypingIndicator key="typing" agent={agent} /> : null}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Step-driven footer */}
      <footer className="shrink-0 border-t px-4 py-5">{renderFooter()}</footer>
    </div>
  )
}
