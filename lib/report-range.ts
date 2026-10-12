import { sql } from "drizzle-orm";

// 管理后台的统计区间：按业务时区（默认北京时间）的自然日，from/to 均含当天
export const REPORT_TZ = process.env.REPORT_TZ || "Asia/Shanghai";

export function todayInTz(tz = REPORT_TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export function parseRange(sp: URLSearchParams): { from: string; to: string } | { error: string } {
  const today = todayInTz();
  const from = sp.get("from") || today;
  const to = sp.get("to") || from;
  if (!DAY.test(from) || !DAY.test(to) || isNaN(Date.parse(from)) || isNaN(Date.parse(to))) return { error: "日期格式应为 YYYY-MM-DD" };
  if (from > to) return { error: "开始日期不能晚于结束日期" };
  if ((Date.parse(to) - Date.parse(from)) / 864e5 > 366) return { error: "区间最长 366 天" };
  return { from, to };
}

// SQL 片段：col 落在区间内（按 REPORT_TZ 的 00:00 到结束日次日 00:00）
export function inRange(col: ReturnType<typeof sql.raw>, r: { from: string; to: string }) {
  return sql`${col} >= (${r.from}::date)::timestamp AT TIME ZONE ${REPORT_TZ} AND ${col} < (${r.to}::date + 1)::timestamp AT TIME ZONE ${REPORT_TZ}`;
}
