"use client";

import { useState } from "react";
import { engine } from "@/lib/engine";
import { formatRelative } from "@/lib/utils";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface User {
  id: string;
  email: string;
  role: string;
  banned: boolean;
  auto_approve: boolean;
  daily_add_quota: number;
  last_seen_at?: string;
}

interface UsersTableProps {
  initialUsers: User[];
}

export function UsersTable({ initialUsers }: UsersTableProps) {
  const [users, setUsers] = useState(initialUsers);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const updateUser = async (id: string, body: Partial<User>) => {
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      await engine.updateUser(id, body);
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, ...body } : u))
      );
      toast.success("User updated");
    } catch (err) {
      console.error("Failed to update user:", err);
      toast.error("Failed to update user");
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, any> = {
      owner: "default",
      trusted: "secondary",
      friend: "outline",
      guest: "outline",
    };
    return variants[role] || "outline";
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-2">
              <th className="text-left py-3 px-4 font-semibold text-text-dim">User</th>
              <th className="text-left py-3 px-4 font-semibold text-text-dim">Role</th>
              <th className="text-left py-3 px-4 font-semibold text-text-dim">Auto Approve</th>
              <th className="text-left py-3 px-4 font-semibold text-text-dim">Quota</th>
              <th className="text-left py-3 px-4 font-semibold text-text-dim">Banned</th>
              <th className="text-left py-3 px-4 font-semibold text-text-dim">Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-surface-2 hover:bg-surface/30">
                <td className="py-3 px-4 text-text">{user.displayName ?? user.username ?? user.email ?? user.id.slice(0,8)}</td>
                <td className="py-3 px-4">
                  <select
                    value={user.role}
                    onChange={(e) =>
                      updateUser(user.id, { role: e.target.value })
                    }
                    disabled={loading[user.id]}
                    className="bg-surface-2 text-text rounded px-2 py-1 text-xs disabled:opacity-50"
                  >
                    <option value="owner">Owner</option>
                    <option value="trusted">Trusted</option>
                    <option value="friend">Friend</option>
                    <option value="guest">Guest</option>
                  </select>
                </td>
                <td className="py-3 px-4">
                  <Switch
                    checked={user.auto_approve}
                    onCheckedChange={(checked) =>
                      updateUser(user.id, { auto_approve: checked })
                    }
                    disabled={loading[user.id]}
                  />
                </td>
                <td className="py-3 px-4">
                  <input
                    type="number"
                    value={user.daily_add_quota}
                    onChange={(e) =>
                      updateUser(user.id, {
                        daily_add_quota: parseInt(e.target.value) || 0,
                      })
                    }
                    disabled={loading[user.id]}
                    className="w-16 bg-surface-2 text-text rounded px-2 py-1 text-xs disabled:opacity-50"
                  />
                </td>
                <td className="py-3 px-4">
                  <Switch
                    checked={user.banned}
                    onCheckedChange={(checked) =>
                      updateUser(user.id, { banned: checked })
                    }
                    disabled={loading[user.id]}
                  />
                </td>
                <td className="py-3 px-4 text-text-dim">
                  {formatRelative(user.last_seen_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {users.length === 0 && (
        <Card className="p-8 text-center text-text-dim">
          No users found
        </Card>
      )}
    </div>
  );
}
