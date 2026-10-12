import { NextRequest } from "next/server";
import { aErr, authAnthropic } from "@/lib/anthropic-gateway";
import { CLAUDE_CODE_MODELS } from "@/lib/claude-pricing";

export const dynamic = "force-dynamic";

// 模型发现（Claude Code 开启 CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1 时调用）
export async function GET(req: NextRequest) {
  if (!(await authAnthropic(req))) return aErr(401, "authentication_error", "Invalid ShuTong API key (sk-gw-...)");
  const data = CLAUDE_CODE_MODELS.map((m) => ({ type: "model", id: m.id, display_name: m.display_name, description: "经书童网关调用 · 按书童价格计费", created_at: "2026-01-01T00:00:00Z" }));
  return Response.json({ data, has_more: false, first_id: data[0].id, last_id: data[data.length - 1].id });
}
