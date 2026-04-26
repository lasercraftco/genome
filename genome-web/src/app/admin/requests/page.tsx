import { engine } from "@/lib/engine";
import { RequestsTable } from "./RequestsTable";

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  let requests = [];

  try {
    const result = await engine.listLibraryRequests("requested");
    requests = result.requests || [];
  } catch (err) {
    console.error("Failed to fetch library requests:", err);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-text">Library Requests</h2>
        <p className="text-sm text-text-dim">Approve or deny pending track requests</p>
      </div>

      <RequestsTable initialRequests={requests} />
    </div>
  );
}
