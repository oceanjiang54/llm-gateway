import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// 管理后台核心指标：用户/调用/进账/成本/毛利 + 7日趋势 + 模型分布
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [core] = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM users) AS total_users,
      (SELECT count(*) FROM users WHERE created_at >= CURRENT_DATE) AS today_users,
      (SELECT count(*) FROM usage_logs) AS total_calls,
      (SELECT count(*) FROM usage_logs WHERE created_at >= CURRENT_DATE) AS today_calls,
      (SELECT coalesce(sum(cost_usd), 0) FROM usage_logs) AS revenue_total,
      (SELECT coalesce(sum(cost_usd), 0) FROM usage_logs WHERE created_at >= CURRENT_DATE) AS revenue_today,
      (SELECT coalesce(sum(upstream_cost_usd), 0) FROM usage_logs) AS cost_total,
      (SELECT coalesce(sum(upstream_cost_usd), 0) FROM usage_logs WHERE created_at >= CURRENT_DATE) AS cost_today
  `);
  const trend = await db.execute(sql`
    SELECT to_char(created_at::date, 'MM-DD') AS d, count(*)::int AS c
    FROM usage_logs WHERE created_at > now() - interval '7 days'
    GROUP BY created_at::date ORDER BY created_at::date
  `);
  const byModel = await db.execute(sql`
    SELECT model, count(*)::int AS calls, coalesce(sum(input_tokens + output_tokens), 0)::bigint AS tokens,
           coalesce(sum(cost_usd), 0) AS revenue
    FROM usage_logs GROUP BY model ORDER BY calls DESC
  `);
  return NextResponse.json({ core, trend, byModel });
}
