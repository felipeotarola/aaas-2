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

  const applySetting = React.useCallback((setting: ConsumerAgentSetting | null) => {
    const whatsApp = parseWhatsAppConnection(setting)
    setConnection(whatsApp)
    setAccountId(whatsApp?.accountId ?? "default")
    setLoginMessage(whatsApp?.lastLoginMessage ?? null)
    setQrDataUrl(null)
    setError(null)
  }, [])

  const reset = React.useCallback(() => {
    setConnection(null)
    setAccountId("default")
    setQrDataUrl(null)
    setLoginMessage(null)
    setError(null)
    setIsUpdating(false)
  }, [])

  const startLogin = React.useCallback(async () => {
    if (isUpdating) return

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
    } catch (value) {
      setError(value instanceof Error ? value.message : "Failed to start WhatsApp QR login.")
    } finally {
      setIsUpdating(false)
    }
  }, [accountId, isUpdating, slug])

  const waitLogin = React.useCallback(async () => {
    if (isUpdating) return

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
  }, [accountId, isUpdating, slug])

  const disconnect = React.useCallback(async () => {
    if (isUpdating) return

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
  }, [accountId, isUpdating, slug])

  return {
    connection,
    accountId,
    qrDataUrl,
    loginMessage,
    error,
    isUpdating,
    setAccountId,
    startLogin,
    waitLogin,
    disconnect,
    applySetting,
    reset,
  }
}
