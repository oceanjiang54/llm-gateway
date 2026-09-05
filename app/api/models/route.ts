import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

// 公开接口：可用模型列表（Keys 页模型切换标签用）
export async function GET() {
  const models = await db.select({ id: schema.models.id, displayName: schema.models.displayName, inputPerM: schema.models.inputPerM, outputPerM: schema.models.outputPerM })
    .from(schema.models).where(eq(schema.models.enabled, true));
  return NextResponse.json({ models });
}
