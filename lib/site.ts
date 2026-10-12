import { headers } from "next/headers";

// 当前部署的访问地址（文档、示例代码里用）
export function siteBase() {
  const host = headers().get("host") || "shutong.ai";
  const proto = host.includes("localhost") || /^\d/.test(host) ? "http" : "https";
  return `${proto}://${host}`;
}
