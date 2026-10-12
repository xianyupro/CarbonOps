/**
 * 场景详情路由 — /scenarios/[id]
 */
import { SceneDetailView } from "../../scenes/scene-detail-view";

interface Props {
  params: { id: string };
}

export default function SceneDetailPage({ params }: Props) {
  return <SceneDetailView sceneId={params.id} />;
}

export const dynamic = "force-dynamic";
