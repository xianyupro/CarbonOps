import { Suspense } from "react";
import { CloudEdgePage } from "@/components/cloud-edge/cloud-edge-page";

export const dynamic = "force-dynamic";

export default function CloudEdgeRoute() {
  return (
    <Suspense fallback={null}>
      <CloudEdgePage />
    </Suspense>
  );
}
