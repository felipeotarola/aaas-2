"use client"

import * as React from "react"
import { Link2, Send, Upload } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

import type { ChannelChoice, ChatStepId, KnowledgeSource } from "../domain/types"
import { ChannelCard, SourcePill } from "./chat-ui"
import { ChannelConnectStep } from "./channel-connect-step"
import type { useOnboardingChannelConnections } from "../hooks/use-onboarding-channel-connections"

type OnboardingChannelConnections = ReturnType<typeof useOnboardingChannelConnections>

type OnboardingChatFooterProps = {
  chatStep: ChatStepId
  inputRef: React.RefObject<HTMLInputElement | null>
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  fileInputRef: React.RefObject<HTMLInputElement | null>
  inputValue: string
  setInputValue: (value: string) => void
  isTyping: boolean
  onSend: () => void
  onInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  onSkipDescription: () => void
  sources: KnowledgeSource[]
  fileSources: KnowledgeSource[]
  urlSources: KnowledgeSource[]
  removeSource: (index: number) => void
  isDragging: boolean
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void
  onDragLeave: () => void
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void
  onOpenFilePicker: () => void
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onFilesDone: () => void
  urlInput: string
  setUrlInput: (value: string) => void
  onAddUrl: () => void
  onUrlsDone: () => void
  selectedChannels: ChannelChoice[]
  toggleChannel: (channel: ChannelChoice) => void
  onChannelsContinue: () => void
  channelConnections: OnboardingChannelConnections
  isCompleting: boolean
  onConnectChannelsContinue: () => void
}

export function OnboardingChatFooter({
  chatStep,
  inputRef,
  textareaRef,
  fileInputRef,
  inputValue,
  setInputValue,
  isTyping,
  onSend,
  onInputKeyDown,
  onSkipDescription,
  sources,
  fileSources,
  urlSources,
  removeSource,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenFilePicker,
  onFileChange,
  onFilesDone,
  urlInput,
  setUrlInput,
  onAddUrl,
  onUrlsDone,
  selectedChannels,
  toggleChannel,
  onChannelsContinue,
  channelConnections,
  isCompleting,
  onConnectChannelsContinue,
}: OnboardingChatFooterProps) {
  switch (chatStep) {
    case "ask-user-name":
    case "ask-agent-name":
      return (
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <input
            ref={inputRef}
            placeholder={chatStep === "ask-user-name" ? "Your name…" : "Agent name…"}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={onInputKeyDown}
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-12 w-full rounded-xl border px-4 text-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            autoFocus
          />
          <Button
            size="lg"
            className="h-12 w-12 shrink-0 rounded-xl"
            onClick={onSend}
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
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                onSend()
              }
            }}
            rows={4}
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex w-full rounded-xl border px-4 py-3 text-base leading-relaxed focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onSkipDescription}>
              Skip
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={onSend}
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
          {fileSources.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {sources.map((source, index) =>
                source.type === "file" ? (
                  <SourcePill
                    key={`file-${index}`}
                    source={source}
                    onRemove={() => removeSource(index)}
                  />
                ) : null,
              )}
            </div>
          ) : null}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={onOpenFilePicker}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 transition-colors",
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={onFileChange}
              accept=".pdf,.doc,.docx,.txt,.md,.csv,.json"
            />
            <Upload className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Click to upload files or drag and drop</p>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={onFilesDone}>
              {fileSources.length > 0 ? "Continue" : "Skip"}
            </Button>
          </div>
        </div>
      )

    case "ask-urls":
      return (
        <div className="mx-auto max-w-2xl space-y-3">
          {urlSources.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {sources.map((source, index) =>
                source.type === "url" ? (
                  <SourcePill
                    key={`url-${index}`}
                    source={source}
                    onRemove={() => removeSource(index)}
                  />
                ) : null,
              )}
            </div>
          ) : null}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="https://…"
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    onAddUrl()
                  }
                }}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-12 w-full rounded-xl border pl-10 pr-3 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                autoFocus
              />
            </div>
            <Button
              size="lg"
              variant="outline"
              onClick={onAddUrl}
              disabled={!urlInput.trim()}
              className="h-12 rounded-xl"
            >
              Add
            </Button>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={onUrlsDone}>
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
            <Button size="sm" onClick={onChannelsContinue}>
              {selectedChannels.length > 0 ? "Continue" : "Skip"}
            </Button>
          </div>
        </div>
      )

    case "connect-channels":
      return (
        <ChannelConnectStep
          selectedChannels={selectedChannels}
          isPreparing={channelConnections.isPreparing}
          prepareError={channelConnections.prepareError}
          onRetryPrepare={() => void channelConnections.prepareAgent()}
          isCompleting={isCompleting}
          onContinue={onConnectChannelsContinue}
          telegram={{
            connection: channelConnections.telegram.connection,
            botToken: channelConnections.telegram.botToken,
            accountId: channelConnections.telegram.accountId,
            error: channelConnections.telegram.error,
            isSaving: channelConnections.telegram.isSaving,
            setBotToken: channelConnections.telegram.setBotToken,
            setAccountId: channelConnections.telegram.setAccountId,
            connect: () => void channelConnections.telegram.connect(),
          }}
          whatsApp={{
            connection: channelConnections.whatsApp.connection,
            accountId: channelConnections.whatsApp.accountId,
            qrDataUrl: channelConnections.whatsApp.qrDataUrl,
            loginMessage: channelConnections.whatsApp.loginMessage,
            error: channelConnections.whatsApp.error,
            isSaving: channelConnections.whatsApp.isSaving,
            isPollingStatus: channelConnections.whatsApp.isPollingStatus,
            setAccountId: channelConnections.whatsApp.setAccountId,
            startLogin: () => void channelConnections.whatsApp.startLogin(),
            checkStatus: () => void channelConnections.whatsApp.checkStatus(),
          }}
        />
      )

    case "done":
      return (
        <div className="mx-auto flex max-w-2xl items-center justify-center py-2">
          <p className="text-sm text-muted-foreground">Setting up your agent…</p>
        </div>
      )

    default:
      return null
  }
}
