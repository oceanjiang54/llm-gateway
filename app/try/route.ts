import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";

// 「立即试用」智能入口：未登录 → 注册(带next)；已登录 → 密钥页引导模式
export async function GET(req: NextRequest) {
  const model = req.nextUrl.searchParams.get("model") || "deepseek-chat";
  const dest = `/console/keys?model=${encodeURIComponent(model)}&onboarding=1`;
  const userId = await getSessionUserId();
  const target = userId ? dest : `/register?next=${encodeURIComponent(dest)}`;
  return NextResponse.redirect(new URL(target, req.url));
}
