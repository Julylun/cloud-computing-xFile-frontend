import { Suspense } from "react";
import { AnalyticsScreen } from "../../components/workspace-screens";
export default function AnalyticsPage() { return <Suspense fallback={<div />}><AnalyticsScreen /></Suspense>; }
