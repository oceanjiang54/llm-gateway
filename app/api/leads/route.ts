import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db, schema } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { inRange, parseRange } from "@/lib/report-range";

export const dynamic = "force-dynamic";

const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// 企业客户留资：公开提交，字段校验 + 同号码 10 分钟内只收一次
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const company = clean(body.company, 80);
  const name = clean(body.name, 40);
  const phone = clean(body.phone, 30).replace(/[\s-]/g, "");
  const source = clean(body.source, 30) || "home";

  if (company.length < 2) return NextResponse.json({ error: "请填写企业名称" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "请填写姓名" }, { status: 400 });
  // 大陆手机 / 带区号固话 / 国际号码（+开头）
  if (!/^(1[3-9]\d{9}|0\d{2,3}\d{7,8}|\+\d{7,15})$/.test(phone)) {
    return NextResponse.json({ error: "电话格式不正确" }, { status: 400 });
  }

  const recent = await db.select({ id: schema.leads.id }).from(schema.leads)
    .where(and(eq(schema.leads.phone, phone), gte(schema.leads.createdAt, new Date(Date.now() - 10 * 60_000))))
    .limit(1);
  if (recent.length === 0) {
    await db.insert(schema.leads).values({ id: randomUUID(), company, name, phone, source, createdAt: new Date() });
  }
  return NextResponse.json({ ok: true });
}

// 管理后台：按区间列出线索（默认当天）；pending=1 时列出全部待联系（不限时间）
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "not found" }, { status: 404 });
  const sp = req.nextUrl.searchParams;
  const [{ pending }] = await db.execute(sql`SELECT count(*)::int AS pending FROM leads WHERE status = 'new'`) as any;
  if (sp.get("pending") === "1") {
    const leads = await db.select().from(schema.leads).where(eq(schema.leads.status, "new")).orderBy(desc(schema.leads.createdAt)).limit(200);
    return NextResponse.json({ leads, pending });
  }
  const r = parseRange(sp);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  const leads = await db.select().from(schema.leads).where(inRange(sql.raw("created_at"), r)).orderBy(desc(schema.leads.createdAt)).limit(200);
  return NextResponse.json({ leads, pending });
}

// 管理后台：标记已联系 / 未联系
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { id, status } = await req.json().catch(() => ({}));
  if (!id || !["new", "contacted"].includes(status)) return NextResponse.json({ error: "参数错误" }, { status: 400 });
  await db.update(schema.leads).set({ status }).where(eq(schema.leads.id, id));
  return NextResponse.json({ ok: true });
}
