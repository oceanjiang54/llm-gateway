import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

// 公开接口：可用模型列表（Keys 页模型切换标签用）
export async function GET() {
  const models = await db.select({ id: schema.models.id, displayName: schema.models.displayName, vendor: schema.models.vendor, inputPerM: schema.models.inputPerM, outputPerM: schema.models.outputPerM })
    .from(schema.models).where(eq(schema.models.enabled, true)).orderBy(asc(schema.models.sortOrder));
  return NextResponse.json({ models });
}
