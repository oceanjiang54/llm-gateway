import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import Code from "@/components/docs/Code";
import DocNext from "@/components/docs/DocNext";
import { db, schema } from "@/lib/db";
import { siteBase } from "@/lib/site";
import { samples } from "@/lib/docs-samples";

export const dynamic = "force-dynamic";
export const metadata = { title: "模型列表 · 书童文档" };

const RESP = `{
  "object": "list",
  "data": [
    {
      "id": "deepseek-chat",
      "object": "model",
      "owned_by": "深度求索",
      "name": "DeepSeek V3",
      "available": true,
      "pricing": { "currency": "CNY", "unit": "1M tokens", "input": 2.46, "output": 10.01 }
    }
  ]
}`;

export default async function ModelsDoc() {
  const base = siteBase();
  const s = samples(base);
  const models = await db.select().from(schema.models)
    .where(and(eq(schema.models.enabled, true), eq(schema.models.status, "live")))
    .orderBy(asc(schema.models.sortOrder));
  return (
    <>
      <h1>模型列表</h1>
      <p className="lead">列出当前可调用的模型及人民币价格，也是检查 API Key 是否有效最快的方式。</p>
      <Code label="Endpoint" code={`GET ${base}/api/v1/models`} />

      <h2>示例</h2>
      <Code tabs={[{ label: "cURL", code: s.modelsCurl }, { label: "Python", code: s.modelsPy }, { label: "Node.js", code: s.modelsNode }]} />

      <h2>响应</h2>
      <Code label="JSON" code={RESP} />
      <p><code>available</code> 为 <code>false</code> 表示该模型暂时无法调用（返回 503），请换用其他模型。</p>

      <h2>当前模型</h2>
      <table>
        <thead><tr><th>模型 ID</th><th>名称</th><th>输入 ¥/百万 tokens</th><th>输出 ¥/百万 tokens</th></tr></thead>
        <tbody>
          {models.map((m) => (
            <tr key={m.id}>
              <td><code>{m.id}</code></td>
              <td><Link href={`/models/${encodeURIComponent(m.id)}`}>{m.displayName}</Link></td>
              <td>¥{m.inputPerM.toFixed(2)}</td>
              <td>¥{m.outputPerM.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <DocNext href="/docs/models" />
    </>
  );
}
