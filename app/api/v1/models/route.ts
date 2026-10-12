import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { authenticateApiKey } from "@/lib/apikey";
import { providers } from "@/lib/providers";

export const dynamic = "force-dynamic";

// GET /api/v1/models：OpenAI 兼容的模型列表，也可用来检查 API Key 是否有效
export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: { message: "Invalid API key", type: "auth_error" } }, { status: 401 });
  const rows = await db.select().from(schema.models)
    .where(and(eq(schema.models.enabled, true), eq(schema.models.status, "live")))
    .orderBy(asc(schema.models.sortOrder));
  const data = rows.map((m) => {
    const p = providers[m.provider];
    return {
      id: m.id, object: "model", created: 1767225600, owned_by: m.vendor || m.provider,
      name: m.displayName,
      available: !!p && (!p.configured || p.configured()),
      pricing: { currency: "CNY", unit: "1M tokens", input: m.inputPerM, output: m.outputPerM },
    };
  });
  return NextResponse.json({ object: "list", data });
}
