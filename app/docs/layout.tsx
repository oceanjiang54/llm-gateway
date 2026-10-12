import DocsNav from "@/components/docs/DocsNav";

export const metadata = { title: "文档中心 · 书童 ShuTong" };

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="docs">
      <aside className="docs-side"><DocsNav /></aside>
      <article className="docs-main">{children}</article>
    </div>
  );
}
