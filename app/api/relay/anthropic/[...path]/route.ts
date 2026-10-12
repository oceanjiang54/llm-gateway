import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

// Claude 中继（部署在境外节点，如 Vercel / 新加坡服务器）
// 作用：为无法直连 Anthropic 的部署（国内服务器）转发请求，流式响应原样回传
// 安全：仅当配置了 RELAY_TOKEN 时启用；请求必须携带匹配的 x-relay-token；
//       Anthropic 密钥只存在于中继侧，调用方无需持有
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const token = process.env.RELAY_TOKEN;
  if (!token) return new Response(null, { status: 404 }); // 未启用中继角色
  if (req.headers.get("x-relay-token") !== token) {
    return Response.json({ error: { message: "Invalid relay token", type: "auth_error" } }, { status: 401 });
  }

  const upstream = process.env.RELAY_UPSTREAM || "https://api.anthropic.com";
  const url = `${upstream}/${params.path.join("/")}${req.nextUrl.search}`;

  // anthropic-* 头按开放列表原样转发（Claude Code 的 anthropic-beta 依赖于此）
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  req.headers.forEach((v, k) => { if (k.startsWith("anthropic-")) headers[k] = v; });
  headers["anthropic-version"] ||= "2023-06-01";
  headers["x-api-key"] = process.env.ANTHROPIC_API_KEY || "";

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: req.body,
    // @ts-ignore Node fetch 转发流式请求体所需
    duplex: "half",
  });

  // 流式/非流式统一：响应体原样管回，不解析不落盘
  const out = new Headers({ "Content-Type": res.headers.get("Content-Type") || "application/json", "Cache-Control": "no-cache" });
  res.headers.forEach((v, k) => {
    if (k === "retry-after" || k === "x-should-retry" || k === "request-id" || k.startsWith("anthropic-ratelimit")) out.set(k, v);
  });
  return new Response(res.body, { status: res.status, headers: out });
}
