import { Suspense } from "react";
import { RecipientScreen } from "@/components/sharing-screens";

export default async function RecipientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<div className="sharing-loading">Đang mở file…</div>}><RecipientScreen key={id} id={id} /></Suspense>;
}
