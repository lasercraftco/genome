import { notFound } from "next/navigation";

import { engine } from "@/lib/engine";
import { requireUser } from "@/lib/auth/session";
import { StationPlayerView } from "./StationPlayerView";

export const dynamic = "force-dynamic";

export default async function StationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const station = await engine.getStation(id).catch(() => null);
  if (!station) notFound();
  return <StationPlayerView station={station} />;
}
