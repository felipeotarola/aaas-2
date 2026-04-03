import { AdminLoginForm } from "./login-form"

type LoginSearchParams = {
  reason?: string | string[]
}

type LoginPageProps = {
  searchParams?: Promise<LoginSearchParams> | LoginSearchParams
}

export default async function AdminLoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const reasonValue = resolvedSearchParams?.reason
  const reason = Array.isArray(reasonValue) ? reasonValue[0] : reasonValue

  return <AdminLoginForm reason={reason} />
}
