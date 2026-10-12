import { randomUUID } from "crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { db, schema } from "./db";

export function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
export function isCnPhone(s: string) {
  return /^1[3-9]\d{9}$/.test(s);
}

// 发送验证码：60秒频控 + 5分钟有效期
// 渠道可插拔：配置 RESEND_API_KEY 走真实邮件；配置短信服务商后在 sendSms 中实现；
// 都未配置时为「开发模式」——验证码打印到服务器控制台并随响应返回（仅原型阶段）
export async function issueCode(target: string): Promise<{ ok: boolean; error?: string; devCode?: string }> {
  const recent = await db.select().from(schema.verificationCodes)
    .where(eq(schema.verificationCodes.target, target))
    .orderBy(desc(schema.verificationCodes.createdAt)).limit(1);
  if (recent[0] && Date.now() - recent[0].createdAt.getTime() < 60_000) {
    return { ok: false, error: "发送太频繁，请60秒后重试" };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await db.insert(schema.verificationCodes).values({
    id: randomUUID(), target, code,
    expiresAt: new Date(Date.now() + 5 * 60_000),
    createdAt: new Date(),
  });

  if (isEmail(target) && process.env.RESEND_API_KEY) {
    // 发件地址的域名必须已在 Resend 后台验证（如 shutong.ai）；未验证时只能用 onboarding@resend.dev 发给 Resend 账号本人
    const from = process.env.MAIL_FROM || "书童 ShuTong <noreply@shutong.ai>";
    try {
      const res = await fetch(process.env.RESEND_BASE_URL || "https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from,
          to: target,
          subject: `书童验证码：${code}`,
          text: `您的书童验证码是 ${code}，5 分钟内有效。如非本人操作，请忽略此邮件。`,
          html: `<div style="font-family:-apple-system,'PingFang SC',sans-serif;max-width:440px;margin:0 auto;padding:28px;color:#151a2d">
  <div style="font-size:18px;font-weight:700;margin-bottom:18px">书童 ShuTong</div>
  <div style="font-size:14px;color:#545c73;margin-bottom:10px">您的验证码是：</div>
  <div style="font-size:32px;font-weight:700;letter-spacing:6px;color:#3b4fd8;margin-bottom:18px">${code}</div>
  <div style="font-size:13px;color:#8a92a8;line-height:1.8">5 分钟内有效。如非本人操作，请忽略此邮件。</div>
</div>`,
        }),
      });
      if (!res.ok) {
        // 发送失败：作废这条验证码，让用户可以立刻重试；具体原因只写服务端日志
        console.error(`[mail] Resend ${res.status}:`, (await res.text()).slice(0, 300));
        await db.delete(schema.verificationCodes).where(and(eq(schema.verificationCodes.target, target), eq(schema.verificationCodes.code, code)));
        return { ok: false, error: "验证码邮件发送失败，请稍后重试" };
      }
    } catch (e: any) {
      console.error("[mail] Resend request failed:", e.message);
      await db.delete(schema.verificationCodes).where(and(eq(schema.verificationCodes.target, target), eq(schema.verificationCodes.code, code)));
      return { ok: false, error: "验证码邮件发送失败，请稍后重试" };
    }
    return { ok: true };
  }
  if (isCnPhone(target) && process.env.SMS_ACCESS_KEY) {
    // TODO: 接入阿里云/腾讯云短信（需企业实名 + 签名模板审批后填入密钥）
    return { ok: false, error: "短信通道尚未配置" };
  }

  console.log(`[开发模式] 验证码 ${target} -> ${code}`);
  return { ok: true, devCode: code };
}

// 校验并消费验证码
export async function consumeCode(target: string, code: string): Promise<boolean> {
  const rows = await db.select().from(schema.verificationCodes)
    .where(and(
      eq(schema.verificationCodes.target, target),
      eq(schema.verificationCodes.code, code),
      eq(schema.verificationCodes.used, false),
      gt(schema.verificationCodes.expiresAt, new Date()),
    ))
    .orderBy(desc(schema.verificationCodes.createdAt)).limit(1);
  if (!rows[0]) return false;
  await db.update(schema.verificationCodes).set({ used: true })
    .where(eq(schema.verificationCodes.id, rows[0].id));
  return true;
}
