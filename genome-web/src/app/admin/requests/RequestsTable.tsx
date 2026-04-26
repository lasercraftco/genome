"use client";

import { useState } from "react";
import { engine } from "@/lib/engine";
import { formatRelative } from "@/lib/utils";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, X } from "lucide-react";

interface Request {
  id: number;
  user_email: string;
  track_title: string;
  track_artist: string;
  requested_at: string;
}

interface RequestsTableProps {
  initialRequests: Request[];
}

export function RequestsTable({ initialRequests }: RequestsTableProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [loading, setLoading] = useState<Record<number, boolean>>({});

  const approveRequest = async (id: number) => {
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await engine.approveRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      toast.success("Request approved");
    } catch (err) {
      console.error("Failed to approve request:", err);
      toast.error("Failed to approve request");
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const denyRequest = async (id: number) => {
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await engine.denyRequest(id, "Denied by admin");
      setRequests((prev) => prev.filter((r) => r.id !== id));
      toast.success("Request denied");
    } catch (err) {
      console.error("Failed to deny request:", err);
      toast.error("Failed to deny request");
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-2">
              <th className="text-left py-3 px-4 font-semibold text-text-dim">User</th>
              <th className="text-left py-3 px-4 font-semibold text-text-dim">Track</th>
              <th className="text-left py-3 px-4 font-semibold text-text-dim">Artist</th>
              <th className="text-left py-3 px-4 font-semibold text-text-dim">Requested</th>
              <th className="text-left py-3 px-4 font-semibold text-text-dim">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-b border-surface-2 hover:bg-surface/30">
                <td className="py-3 px-4 text-text">{request.user_email}</td>
                <td className="py-3 px-4 text-text">{request.track_title}</td>
                <td className="py-3 px-4 text-text-dim">{request.track_artist}</td>
                <td className="py-3 px-4 text-text-dim">
                  {formatRelative(request.requested_at)}
                </td>
                <td className="py-3 px-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => approveRequest(request.id)}
                    disabled={loading[request.id]}
                    className="flex items-center gap-1"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => denyRequest(request.id)}
                    disabled={loading[request.id]}
                    className="flex items-center gap-1"
                  >
                    <X className="h-4 w-4" />
                    Deny
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {requests.length === 0 && (
        <Card className="p-8 text-center text-text-dim">
          No pending requests
        </Card>
      )}
    </div>
  );
}
