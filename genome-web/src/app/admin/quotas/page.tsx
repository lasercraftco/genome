"use client";

import { useEffect, useState } from "react";
import { engine } from "@/lib/engine";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface User {
  id: string;
  email: string;
  role: string;
  daily_add_quota: number;
}

export default function AdminQuotasPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [quotaEdits, setQuotaEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const result = await engine.listUsers();
        // Filter for friend role only
        const friendUsers = result.users.filter(u => u.role === "friend");
        setUsers(friendUsers);
      } catch (err) {
        console.error("Failed to fetch users:", err);
        toast.error("Failed to load users");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleQuotaChange = (userId: string, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      setQuotaEdits(prev => ({ ...prev, [userId]: num }));
    }
  };

  const handleSaveQuota = async (userId: string) => {
    const newQuota = quotaEdits[userId];
    if (newQuota === undefined) return;

    setSaving(prev => ({ ...prev, [userId]: true }));
    try {
      await engine.updateUser(userId, { daily_add_quota: newQuota });
      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, daily_add_quota: newQuota } : u)
      );
      setQuotaEdits(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      toast.success("Quota updated");
    } catch (err) {
      console.error("Failed to update quota:", err);
      toast.error("Failed to update quota");
    } finally {
      setSaving(prev => ({ ...prev, [userId]: false }));
    }
  };

  if (loading) {
    return <div className="text-text-dim">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-text">Daily Add Quotas</h2>
        <p className="text-sm text-text-dim">Manage per-user daily library add limits (friend role only)</p>
      </div>

      {users.length === 0 ? (
        <Card className="p-8 text-center text-text-dim">
          No friend users found
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map(user => (
            <Card key={user.id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text">{user.displayName ?? user.username ?? user.email}</div>
                  <div className="text-xs text-text-dim">ID: {user.id.slice(0, 8)}…</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-dim">Daily quota:</span>
                  <Input
                    type="number"
                    min="1"
                    max="1000"
                    value={quotaEdits[user.id] ?? user.daily_add_quota}
                    onChange={(e) => handleQuotaChange(user.id, e.target.value)}
                    className="w-20 h-9"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleSaveQuota(user.id)}
                    disabled={saving[user.id] || quotaEdits[user.id] === undefined}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
