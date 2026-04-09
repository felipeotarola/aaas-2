"use client"

import * as React from "react"
import { AnimatePresence } from "framer-motion"
import { ArrowLeft, Bot } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import {
  type ChannelChoice,
  type ChatStepId,
  type KnowledgeSource,
  type OnboardingAgent,
  type OnboardingCollectedData,
} from "../domain/types"
import {
  type ChatMessage,
  MessageBubble,
  TypingIndicator,
  makeMsg,
} from "./chat-ui"
import { useOnboardingChannelConnections } from "../hooks/use-onboarding-channel-connections"
import { OnboardingChatFooter } from "./onboarding-chat-footer"

type OnboardingChatProps = {
  agent: OnboardingAgent
  onBack: () => void
  onComplete: (data: OnboardingCollectedData) => Promise<void> | void
  isCompleting?: boolean
}

function isLikelyUrl(text: string): boolean {
  return /^https?:\/\/.+/i.test(text.trim()) || /^www\..+\..+/i.test(text.trim())
}

export function OnboardingChat({
  agent,
  onBack,
  onComplete,
  isCompleting = false,
}: OnboardingChatProps) {
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
  const channelConnections = useOnboardingChannelConnections({
    agentId: agent.id,
    enabled: chatStep === "connect-channels",
  })

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
  }, [agent?.name, chatStep, pushAssistant])

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

    if (selectedChannels.length > 0) {
      pushAssistant(
        "Final step: connect your selected channels now.\n\nTelegram needs a BotFather token.\nWhatsApp needs a QR scan from Linked Devices.\n\nYou can still continue even if one channel is not connected yet.",
        "connect-channels",
      )
      return
    }

    showConfirmation()
  }

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
    const channelSetupList =
      selectedChannels.length > 0
        ? selectedChannels
            .map((channel) => {
              const connected =
                channel === "telegram"
                  ? channelConnections.channelConnectionState.telegram
                  : channelConnections.channelConnectionState.whatsapp
              return `- ${channel === "telegram" ? "Telegram" : "WhatsApp"}: ${connected ? "connected" : "not connected yet"}`
            })
            .join("\n")
        : "- none"

    pushAssistant(
      `Here's a summary:\n\n👤 Your name: ${userName}\n🤖 Agent name: ${agentName}\n📝 Purpose: ${agentDescription}\n📚 Sources:\n${sourcesList}\n📡 Channels: ${channelsList}\n🔌 Channel setup:\n${channelSetupList}`,
      "confirm",
      { type: "confirmation" },
    )
  }, [
    channelConnections.channelConnectionState.telegram,
    channelConnections.channelConnectionState.whatsapp,
    userName,
    agentName,
    agentDescription,
    sources,
    selectedChannels,
    pushAssistant,
  ])

  const handleConfirm = () => {
    if (isCompleting) return

    void onComplete({
      userName,
      agentName,
      agentDescription,
      knowledgeSources: sources,
      channels: selectedChannels,
    })
  }

  const handleRestart = () => {
    if (isCompleting) return
    pushAssistant("No worries! Let's start over. What's your name?", "ask-user-name")
    channelConnections.resetState()
    setUserName(null)
    setAgentName(null)
    setAgentDescription(null)
    setSources([])
    setSelectedChannels([])
  }

  const handleChoiceSelect = (value: string) => {
    if (value === "__custom__") {
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

  const handleSkipDescription = () => {
    setMessages((prev) => [...prev, makeMsg("user", "Skipped")])
    processAnswer("General assistant")
  }

  const handleFileDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleFileDragLeave = () => {
    setIsDragging(false)
  }

  return (
    <div className="flex h-full flex-col">
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
                isConfirming={isCompleting}
              />
            ))}
            {isTyping ? <TypingIndicator key="typing" agent={agent} /> : null}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
      </div>

      <footer className="shrink-0 border-t px-4 py-5">
        <OnboardingChatFooter
          chatStep={chatStep}
          inputRef={inputRef}
          textareaRef={textareaRef}
          fileInputRef={fileInputRef}
          inputValue={inputValue}
          setInputValue={setInputValue}
          isTyping={isTyping}
          onSend={handleSend}
          onInputKeyDown={handleKeyDown}
          onSkipDescription={handleSkipDescription}
          sources={sources}
          fileSources={fileSources}
          urlSources={urlSources}
          removeSource={removeSource}
          isDragging={isDragging}
          onDragOver={handleFileDragOver}
          onDragLeave={handleFileDragLeave}
          onDrop={handleDrop}
          onOpenFilePicker={() => fileInputRef.current?.click()}
          onFileChange={handleFileChange}
          onFilesDone={handleFilesDone}
          urlInput={urlInput}
          setUrlInput={setUrlInput}
          onAddUrl={handleAddUrl}
          onUrlsDone={handleUrlsDone}
          selectedChannels={selectedChannels}
          toggleChannel={toggleChannel}
          onChannelsContinue={handleChannelsContinue}
          channelConnections={channelConnections}
          isCompleting={isCompleting}
          onConnectChannelsContinue={showConfirmation}
        />
      </footer>
    </div>
  )
}
