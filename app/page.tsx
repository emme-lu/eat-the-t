import { getAllPicks } from "@/app/actions";
import { MapView } from "@/app/components/MapView";

export default async function Home() {
  const picks = await getAllPicks();
  return <MapView picks={picks} />;
}
