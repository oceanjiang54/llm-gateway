import { redirect } from "next/navigation";

// 旧「接入指南」已并入文档中心
export default function Guide() { redirect("/docs"); }
