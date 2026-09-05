import { NextRequest, NextResponse } from "next/server";
import { issueCode, isEmail, isCnPhone } from "@/lib/verify";

export async function POST(req: NextRequest) {
  const { target } = await req.json();
  if (!target || (!isEmail(target) && !isCnPhone(target))) {
    return NextResponse.json({ error: "请输入正确的邮箱或手机号" }, { status: 400 });
  }
  const r = await issueCode(target);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 429 });
  // devCode 仅在未配置真实发送渠道时返回（原型演示用，接入渠道后自动消失）
  return NextResponse.json({ ok: true, ...(r.devCode ? { devCode: r.devCode } : {}) });
}
