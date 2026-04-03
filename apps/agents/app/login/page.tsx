"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"

import { createSupabaseBrowserClient } from "@/lib/supabase/browser"

export default function AgentsLoginPage() {
  const router = useRouter()

  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      router.replace("/")
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Agents sign in</h1>
        <p className="text-sm text-muted-foreground">Sign in to access your agents dashboard.</p>
      </header>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <form className="grid gap-3" onSubmit={handleSignIn}>
        <label className="grid gap-1.5 text-sm">
          Email
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          Password
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <Button type="button" variant="outline" onClick={() => void handleSignOut()}>
        Sign out current session
      </Button>
    </main>
  )
}
