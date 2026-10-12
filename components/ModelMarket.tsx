"use client";
import { useState } from "react";
import ModelCard, { ModelInfo } from "./ModelCard";

const DOMESTIC = ["deepseek", "qwen", "kimi", "minimax"];
const FILTERS: { k: string; label: string; test: (m: ModelInfo) => boolean }[] = [
  { k: "all", label: "全部", test: () => true },
  { k: "live", label: "可立即调用", test: (m) => m.status === "live" },
  { k: "cn", label: "国产模型", test: (m) => DOMESTIC.includes(m.provider) },
  { k: "global", label: "海外模型", test: (m) => !DOMESTIC.includes(m.provider) },
  { k: "coming", label: "即将接入", test: (m) => m.status === "coming" },
];

export default function ModelMarket({ models }: { models: ModelInfo[] }) {
  const [f, setF] = useState("all");
  const list = models.filter(FILTERS.find((x) => x.k === f)!.test);
  return (
    <>
      <div className="filters" role="group" aria-label="筛选模型">
        {FILTERS.map((x) => {
          const n = models.filter(x.test).length;
          return (
            <button key={x.k} className={f === x.k ? "on" : ""} aria-pressed={f === x.k} onClick={() => setF(x.k)}>
              {x.label} {n}
            </button>
          );
        })}
      </div>
      <div className="mkt-grid">
        {list.map((m) => <ModelCard key={m.id} m={m} />)}
      </div>
    </>
  );
}
