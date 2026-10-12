import { NextRequest } from "next/server";
import { aErr, authAnthropic, passHeaders, upstreamHeaders, upstreamUrl } from "@/lib/anthropic-gateway";

export const runtime = "nodejs";

// 精确计数（可选端点，Anthropic 不收费）：Claude Code 用它显示上下文占用
export async function POST(req: NextRequest) {
  const auth = await authAnthropic(req);
  if (!auth) return aErr(401, "authentication_error", "Invalid ShuTong API key (sk-gw-...)");
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_RELAY_TOKEN) return aErr(503, "api_error", "Claude upstream is not configured");
  const res = await fetch(upstreamUrl("/messages/count_tokens", req.nextUrl.search), {
    method: "POST", headers: upstreamHeaders(req), body: await req.text(),
  }).catch(() => null);
  if (!res) return aErr(502, "api_error", "Upstream unreachable");
  return new Response(res.body, { status: res.status, headers: passHeaders(res) });
}
