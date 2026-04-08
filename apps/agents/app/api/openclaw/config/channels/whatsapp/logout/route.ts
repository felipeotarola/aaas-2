import { handleLogoutWhatsApp } from "@/app/api/openclaw/config/whatsapp/handlers"

export const runtime = "nodejs"

export async function POST(request: Request) {
  return handleLogoutWhatsApp(request)
}
