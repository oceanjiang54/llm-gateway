"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_GROUPS } from "@/lib/docs-nav";


export default function DocsNav() {
  const path = usePathname();
  return (
    <nav className="docs-nav" aria-label="文档目录">
      {DOC_GROUPS.map((g) => (
        <div key={g.t} className="docs-group">
          <div className="docs-gt">{g.t}</div>
          {g.items.map((i) => (
            <Link key={i.href} href={i.href} className={path === i.href ? "on" : ""} aria-current={path === i.href ? "page" : undefined}>{i.label}</Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
