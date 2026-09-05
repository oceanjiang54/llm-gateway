import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

// GET /logout：清除会话并回到登录页（用于失效会话的自动清理）
export async function GET() {
  clearSession();
  return new NextResponse(null, { status: 307, headers: { Location: "/login" } });
}
