"use client"

import * as React from "react"

import {
  connectOnboardingTelegram,
  ensureOnboardingAgentActive,
  startOnboardingWhatsAppLogin,
  waitOnboardingWhatsAppLogin,
  type OnboardingTelegramConnection,
  type OnboardingWhatsAppConnection,
} from "../data/onboarding-channel-connections"

const POLL_DELAY_MS = 3_000
const POLL_MAX_ATTEMPTS = 60

type UseOnboardingChannelConnectionsArgs = {
  agentId: string
  enabled: boolean
}

export function useOnboardingChannelConnections(args: UseOnboardingChannelConnectionsArgs) {
  const [isPreparing, setIsPreparing] = React.useState(false)
  const [prepareError, setPrepareError] = React.useState<string | null>(null)
  const [preparedAgentId, setPreparedAgentId] = React.useState<string | null>(null)

  const [telegramConnection, setTelegramConnection] = React.useState<OnboardingTelegramConnection | null>(null)
  const [telegramBotToken, setTelegramBotToken] = React.useState("")
  const [telegramAccountId, setTelegramAccountId] = React.useState("default")
  const [telegramError, setTelegramError] = React.useState<string | null>(null)
  const [isConnectingTelegram, setIsConnectingTelegram] = React.useState(false)

  const [whatsAppConnection, setWhatsAppConnection] = React.useState<OnboardingWhatsAppConnection | null>(null)
  const [whatsAppAccountId, setWhatsAppAccountId] = React.useState("default")
  const [whatsAppQrDataUrl, setWhatsAppQrDataUrl] = React.useState<string | null>(null)
  const [whatsAppLoginMessage, setWhatsAppLoginMessage] = React.useState<string | null>(null)
  const [whatsAppError, setWhatsAppError] = React.useState<string | null>(null)
  const [isUpdatingWhatsApp, setIsUpdatingWhatsApp] = React.useState(false)
  const [isPollingWhatsAppStatus, setIsPollingWhatsAppStatus] = React.useState(false)

  const pollingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollingRunIdRef = React.useRef(0)

  const stopWhatsAppPolling = React.useCallback(() => {
    pollingRunIdRef.current += 1
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
    setIsPollingWhatsAppStatus(false)
  }, [])

  const resetState = React.useCallback(() => {
    stopWhatsAppPolling()
    setIsPreparing(false)
    setPrepareError(null)
    setPreparedAgentId(null)
    setTelegramConnection(null)
    setTelegramBotToken("")
    setTelegramAccountId("default")
    setTelegramError(null)
    setIsConnectingTelegram(false)
    setWhatsAppConnection(null)
    setWhatsAppAccountId("default")
    setWhatsAppQrDataUrl(null)
    setWhatsAppLoginMessage(null)
    setWhatsAppError(null)
    setIsUpdatingWhatsApp(false)
  }, [stopWhatsAppPolling])

  React.useEffect(() => {
    resetState()
  }, [args.agentId, resetState])

  React.useEffect(() => {
    if (!args.enabled) {
      stopWhatsAppPolling()
    }
  }, [args.enabled, stopWhatsAppPolling])

  React.useEffect(() => {
    return () => {
      stopWhatsAppPolling()
    }
  }, [stopWhatsAppPolling])

  const prepareAgent = React.useCallback(async () => {
    if (!args.agentId.trim()) {
      setPrepareError("Missing selected agent.")
      return false
    }

    setIsPreparing(true)
    setPrepareError(null)

    try {
      await ensureOnboardingAgentActive(args.agentId)
      setPreparedAgentId(args.agentId)
      return true
    } catch (error) {
      setPrepareError(error instanceof Error ? error.message : "Failed to prepare agent workspace.")
      return false
    } finally {
      setIsPreparing(false)
    }
  }, [args.agentId])

  React.useEffect(() => {
    if (!args.enabled) return
    if (preparedAgentId === args.agentId) return
    if (isPreparing) return
    void prepareAgent()
  }, [args.agentId, args.enabled, isPreparing, prepareAgent, preparedAgentId])

  const ensurePrepared = React.useCallback(async () => {
    if (preparedAgentId === args.agentId) {
      return true
    }

    return prepareAgent()
  }, [args.agentId, prepareAgent, preparedAgentId])

  const connectTelegram = React.useCallback(async () => {
    if (isConnectingTelegram) return

    const botToken = telegramBotToken.trim()
    if (!botToken) {
      setTelegramError("Bot token is required.")
      return
    }

    setIsConnectingTelegram(true)
    setTelegramError(null)

    try {
      const prepared = await ensurePrepared()
      if (!prepared) {
        return
      }

      const payload = await connectOnboardingTelegram({
        agentId: args.agentId,
        botToken,
        accountId: telegramAccountId.trim() || "default",
      })

      setTelegramConnection(payload.telegram)
      setTelegramAccountId(payload.telegram.accountId)
      setTelegramBotToken("")
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : "Failed to connect Telegram.")
    } finally {
      setIsConnectingTelegram(false)
    }
  }, [args.agentId, ensurePrepared, isConnectingTelegram, telegramAccountId, telegramBotToken])

  const scheduleWhatsAppPolling = React.useCallback(
    (accountId: string) => {
      stopWhatsAppPolling()
      const runId = pollingRunIdRef.current
      const accountToPoll = accountId.trim() || "default"
      let attempts = 0
      setIsPollingWhatsAppStatus(true)

      const poll = async () => {
        if (pollingRunIdRef.current !== runId) return
        attempts += 1

        try {
          const payload = await waitOnboardingWhatsAppLogin({
            agentId: args.agentId,
            accountId: accountToPoll,
          })

          if (pollingRunIdRef.current !== runId) return

          setWhatsAppConnection(payload.whatsapp)
          setWhatsAppAccountId(payload.whatsapp.accountId)
          setWhatsAppLoginMessage(payload.login.message)
          setWhatsAppQrDataUrl(payload.login.connected ? null : payload.login.qrDataUrl)

          if (payload.login.connected) {
            setIsPollingWhatsAppStatus(false)
            return
          }
        } catch {
          if (pollingRunIdRef.current !== runId) return
        }

        if (attempts >= POLL_MAX_ATTEMPTS) {
          if (pollingRunIdRef.current !== runId) return
          setIsPollingWhatsAppStatus(false)
          setWhatsAppLoginMessage((current) => current ?? "Still waiting for scan confirmation. You can regenerate the QR code.")
          return
        }

        pollingTimerRef.current = setTimeout(() => {
          void poll()
        }, POLL_DELAY_MS)
      }

      void poll()
    },
    [args.agentId, stopWhatsAppPolling],
  )

  const startWhatsAppLogin = React.useCallback(async () => {
    if (isUpdatingWhatsApp) return

    setIsUpdatingWhatsApp(true)
    setWhatsAppError(null)

    try {
      const prepared = await ensurePrepared()
      if (!prepared) {
        return
      }

      stopWhatsAppPolling()

      const payload = await startOnboardingWhatsAppLogin({
        agentId: args.agentId,
        accountId: whatsAppAccountId.trim() || "default",
      })

      setWhatsAppConnection(payload.whatsapp)
      setWhatsAppAccountId(payload.whatsapp.accountId)
      setWhatsAppLoginMessage(payload.login.message)
      setWhatsAppQrDataUrl(payload.login.qrDataUrl)

      if (payload.login.connected) {
        setWhatsAppQrDataUrl(null)
      } else if (payload.login.qrDataUrl) {
        scheduleWhatsAppPolling(payload.whatsapp.accountId)
      }
    } catch (error) {
      setWhatsAppError(error instanceof Error ? error.message : "Failed to start WhatsApp login.")
      stopWhatsAppPolling()
    } finally {
      setIsUpdatingWhatsApp(false)
    }
  }, [args.agentId, ensurePrepared, isUpdatingWhatsApp, scheduleWhatsAppPolling, stopWhatsAppPolling, whatsAppAccountId])

  const checkWhatsAppStatus = React.useCallback(async () => {
    if (isUpdatingWhatsApp) return

    setIsUpdatingWhatsApp(true)
    setWhatsAppError(null)

    try {
      const payload = await waitOnboardingWhatsAppLogin({
        agentId: args.agentId,
        accountId: whatsAppAccountId.trim() || "default",
      })

      setWhatsAppConnection(payload.whatsapp)
      setWhatsAppAccountId(payload.whatsapp.accountId)
      setWhatsAppLoginMessage(payload.login.message)
      setWhatsAppQrDataUrl(payload.login.connected ? null : payload.login.qrDataUrl)
    } catch (error) {
      setWhatsAppError(error instanceof Error ? error.message : "Failed to verify WhatsApp status.")
    } finally {
      setIsUpdatingWhatsApp(false)
    }
  }, [args.agentId, isUpdatingWhatsApp, whatsAppAccountId])

  const channelConnectionState = React.useMemo(
    () => ({
      telegram: Boolean(telegramConnection?.connected),
      whatsapp: Boolean(whatsAppConnection?.connected),
    }),
    [telegramConnection?.connected, whatsAppConnection?.connected],
  )

  return {
    isPreparing,
    prepareError,
    prepareAgent,
    resetState,
    channelConnectionState,
    telegram: {
      connection: telegramConnection,
      botToken: telegramBotToken,
      accountId: telegramAccountId,
      error: telegramError,
      isSaving: isConnectingTelegram,
      setBotToken: setTelegramBotToken,
      setAccountId: setTelegramAccountId,
      connect: connectTelegram,
    },
    whatsApp: {
      connection: whatsAppConnection,
      accountId: whatsAppAccountId,
      qrDataUrl: whatsAppQrDataUrl,
      loginMessage: whatsAppLoginMessage,
      error: whatsAppError,
      isSaving: isUpdatingWhatsApp,
      isPollingStatus: isPollingWhatsAppStatus,
      setAccountId: setWhatsAppAccountId,
      startLogin: startWhatsAppLogin,
      checkStatus: checkWhatsAppStatus,
    },
  }
}
