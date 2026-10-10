import { Suspense } from "react";
import { CreateScreen } from "@/components/sharing-screens";

export default function CreatePage() { return <Suspense fallback={<div className="sharing-loading">Đang mở trình tạo link…</div>}><CreateScreen /></Suspense>; }
