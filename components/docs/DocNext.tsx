import Link from "next/link";
import { DOC_GROUPS } from "@/lib/docs-nav";

// 页底「上一篇 / 下一篇」
export default function DocNext({ href }: { href: string }) {
  const flat = DOC_GROUPS.flatMap((g) => g.items);
  const i = flat.findIndex((x) => x.href === href);
  const prev = flat[i - 1], next = flat[i + 1];
  return (
    <div className="docs-next">
      {prev ? <Link href={prev.href}>← {prev.label}</Link> : <span />}
      {next ? <Link href={next.href}>{next.label} →</Link> : <span />}
    </div>
  );
}
