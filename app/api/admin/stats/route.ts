import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { inRange, parseRange, REPORT_TZ } from "@/lib/report-range";

export const dynamic = "force-dynamic";

// 管理后台指标：按所选区间统计（默认当天）+ 区间趋势（单日按小时，多日按天）+ 模型分布
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "not found" }, { status: 404 });
  const r = parseRange(req.nextUrl.searchParams);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });

  const L = inRange(sql.raw("created_at"), r);
  const [core] = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM users)::int AS total_users,
      (SELECT count(*) FROM users WHERE ${L})::int AS new_users,
      (SELECT count(*) FROM usage_logs WHERE ${L})::int AS calls,
      (SELECT count(*) FROM usage_logs WHERE ${L} AND status = 'error')::int AS errors,
      (SELECT count(DISTINCT user_id) FROM usage_logs WHERE ${L})::int AS active_users,
      (SELECT coalesce(sum(cost), 0) FROM usage_logs WHERE ${L}) AS revenue,
      (SELECT coalesce(sum(upstream_cost), 0) FROM usage_logs WHERE ${L}) AS cost,
      (SELECT count(*) FROM leads WHERE ${L})::int AS leads
  `);

  const single = r.from === r.to;
  const trend = single
    ? await db.execute(sql`
        WITH h AS (SELECT generate_series(0, 23) AS k)
        SELECT lpad(h.k::text, 2, '0') || ':00' AS d, count(l.id)::int AS c
        FROM h LEFT JOIN usage_logs l ON ${inRange(sql.raw("l.created_at"), r)}
          AND extract(hour FROM l.created_at AT TIME ZONE ${REPORT_TZ})::int = h.k
        GROUP BY h.k ORDER BY h.k`)
    : await db.execute(sql`
        WITH d AS (SELECT generate_series(${r.from}::date, ${r.to}::date, interval '1 day')::date AS day)
        SELECT to_char(d.day, 'MM-DD') AS d, count(l.id)::int AS c
        FROM d LEFT JOIN usage_logs l ON (l.created_at AT TIME ZONE ${REPORT_TZ})::date = d.day
          AND ${inRange(sql.raw("l.created_at"), r)}
        GROUP BY d.day ORDER BY d.day`);

  const byModel = await db.execute(sql`
    SELECT model, count(*)::int AS calls, coalesce(sum(input_tokens + output_tokens), 0)::bigint AS tokens,
           coalesce(sum(cost), 0) AS revenue
    FROM usage_logs WHERE ${L} GROUP BY model ORDER BY calls DESC
  `);
  return NextResponse.json({ range: { ...r, tz: REPORT_TZ }, core, trend, byModel });
}
