import { SourceTasksClient } from "@/components/sources/SourceTasksClient";

export default function SourceTasksPage({ params }: { params: { id: string } }) {
  return <SourceTasksClient sourceId={params.id} />;
}
