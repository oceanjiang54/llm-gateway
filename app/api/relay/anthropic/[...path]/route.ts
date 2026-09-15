import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  const url = `${upstream}/${params.path.join("/")}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": req.headers.get("anthropic-version") || "2023-06-01",
    },
    body: req.body,
    // @ts-ignore Node fetch 转发流式请求体所需
    duplex: "half",
  });

  // 流式/非流式统一：响应体原样管回，不解析不落盘
  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
      "Cache-Control": "no-cache",
    },
  });
}
