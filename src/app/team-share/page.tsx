import { Suspense } from "react";
import { ShareScreen } from "@/components/sharing-screens";

export default function TeamSharePage() { return <Suspense fallback={<div className="sharing-loading">Đang mở link nhóm…</div>}><ShareScreen team /></Suspense>; }
