import { asc, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import ModelMarket from "@/components/ModelMarket";
import LeadButton from "@/components/LeadButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "模型市场 · 书童 ShuTong" };

export default async function Models() {
  const rows = await db.select().from(schema.models)
    .where(inArray(schema.models.status, ["live", "coming"]))
    .orderBy(asc(schema.models.sortOrder));
  const models = rows.map(({ id, provider, displayName, vendor, category, description, status, inputPerM, outputPerM }) =>
    ({ id, provider, displayName, vendor, category, description, status, inputPerM, outputPerM }));
  const live = models.filter((m) => m.status === "live").length;

  return (
    <div className="wrap" style={{ padding: "48px 24px 72px" }}>
      <div className="sec-head">
        <div>
          <h2>模型市场</h2>
          <p>{live} 个模型可立即调用，一个 API Key 全部通用。价格为每百万 tokens（人民币，输入 / 输出）。</p>
        </div>
        <LeadButton className="btn secondary" source="模型市场">需要私有化部署？</LeadButton>
      </div>
      <ModelMarket models={models} />
    </div>
  );
}
