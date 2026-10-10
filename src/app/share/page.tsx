import { Suspense } from "react";
import { ShareScreen } from "@/components/sharing-screens";

export default function SharePage() { return <Suspense fallback={<div className="sharing-loading">Đang tạo mã QR…</div>}><ShareScreen /></Suspense>; }
