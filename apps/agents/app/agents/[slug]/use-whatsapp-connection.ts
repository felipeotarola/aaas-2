"use client"

import * as React from "react"

import {
  disconnectConsumerAgentWhatsApp,
  startConsumerAgentWhatsAppLogin,
  waitConsumerAgentWhatsAppLogin,
} from "@/app/agents/data/consumer-agent-settings-client"
import type { ConsumerAgentSetting, ConsumerWhatsAppConnection } from "@/app/agents/data/contracts"

import { parseWhatsAppConnection } from "./telegram-connect-utils"

export function useWhatsAppConnection(slug: string) {
  const [connection, setConnection] = React.useState<ConsumerWhatsAppConnection | null>(null)
  const [accountId, setAccountId] = React.useState("default")
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null)
  const [loginMessage, setLoginMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [isPollingStatus, setIsPollingStatus] = React.useState(false)
  const pollingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollingRunIdRef = React.useRef(0)

  const stopPolling = React.useCallback(() => {
    pollingRunIdRef.current += 1
    if (pollingTimerRef.current) {
      clearTimeout(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
    setIsPollingStatus(false)
  }, [])

  const schedulePolling = React.useCallback(
    (nextAccountId: string) => {
      const accountToPoll = nextAccountId.trim() || "default"
      stopPolling()
      const runId = pollingRunIdRef.current
      let attempts = 0
      const maxAttempts = 60
      const delayMs = 3_000
      setIsPollingStatus(true)

      const poll = async () => {
        if (pollingRunIdRef.current !== runId) return
        attempts += 1

        try {
          const payload = await waitConsumerAgentWhatsAppLogin({
            agentId: slug,
            accountId: accountToPoll,
          })

          if (pollingRunIdRef.current !== runId) return

          setConnection(payload.whatsapp)
          setAccountId(payload.whatsapp.accountId)
          setLoginMessage(payload.login.message)

          if (payload.login.connected) {
            setQrDataUrl(null)
            setIsPollingStatus(false)
            return
          }
        } catch {
          if (pollingRunIdRef.current !== runId) return
        }

        if (attempts >= maxAttempts) {
          if (pollingRunIdRef.current !== runId) return
          setIsPollingStatus(false)
          setLoginMessage((current) => current ?? "Still waiting for scan confirmation. You can regenerate the QR code.")
          return
        }

        pollingTimerRef.current = setTimeout(() => {
          void poll()
        }, delayMs)
      }

      void poll()
    },
    [slug, stopPolling],
  )

  const applySetting = React.useCallback(
    (setting: ConsumerAgentSetting | null) => {
      const whatsApp = parseWhatsAppConnection(setting)
      setConnection(whatsApp)
      setAccountId(whatsApp?.accountId ?? "default")
      setLoginMessage(whatsApp?.lastLoginMessage ?? null)
      setQrDataUrl(null)
      setError(null)
      stopPolling()
    },
    [stopPolling],
  )

  const reset = React.useCallback(() => {
    stopPolling()
    setConnection(null)
    setAccountId("default")
    setQrDataUrl(null)
    setLoginMessage(null)
    setError(null)
    setIsUpdating(false)
  }, [stopPolling])

  const startLogin = React.useCallback(async () => {
    if (isUpdating) return

    stopPolling()
    setIsUpdating(true)
    setError(null)

    try {
      const payload = await startConsumerAgentWhatsAppLogin({
        agentId: slug,
        accountId,
      })

      setConnection(payload.whatsapp)
      setAccountId(payload.whatsapp.accountId)
      setQrDataUrl(payload.login.qrDataUrl)
      setLoginMessage(payload.login.message)

      if (payload.login.connected) {
        stopPolling()
      } else if (payload.login.qrDataUrl) {
        schedulePolling(payload.whatsapp.accountId)
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : "Failed to start WhatsApp QR login.")
      stopPolling()
    } finally {
      setIsUpdating(false)
    }
  }, [accountId, isUpdating, schedulePolling, slug, stopPolling])

  const waitLogin = React.useCallback(async () => {
    if (isUpdating) return

    stopPolling()
    setIsUpdating(true)
    setError(null)

    try {
      const payload = await waitConsumerAgentWhatsAppLogin({
        agentId: slug,
        accountId,
      })

      setConnection(payload.whatsapp)
      setAccountId(payload.whatsapp.accountId)
      setLoginMessage(payload.login.message)
      if (payload.login.connected) {
        setQrDataUrl(null)
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : "Failed to verify WhatsApp login.")
    } finally {
      setIsUpdating(false)
    }
  }, [accountId, isUpdating, slug, stopPolling])

  const disconnect = React.useCallback(async () => {
    if (isUpdating) return

    stopPolling()
    setIsUpdating(true)
    setError(null)

    try {
      const payload = await disconnectConsumerAgentWhatsApp({
        agentId: slug,
        accountId,
      })

      setConnection(payload.whatsapp)
      setAccountId(payload.whatsapp.accountId)
      setQrDataUrl(null)
      setLoginMessage("WhatsApp disconnected.")
    } catch (value) {
      setError(value instanceof Error ? value.message : "Failed to disconnect WhatsApp.")
    } finally {
      setIsUpdating(false)
    }
  }, [accountId, isUpdating, slug, stopPolling])

  React.useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  return {
    connection,
    accountId,
    qrDataUrl,
    loginMessage,
    error,
    isUpdating,
    isPollingStatus,
    setAccountId,
    startLogin,
    waitLogin,
    disconnect,
    applySetting,
    reset,
  }
}
