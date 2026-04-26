import { engine } from "@/lib/engine";
import { UsersTable } from "./UsersTable";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  let users = [];

  try {
    const result = await engine.listUsers();
    users = result.users || [];
  } catch (err) {
    console.error("Failed to fetch users:", err);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-text">Users</h2>
        <p className="text-sm text-text-dim">Manage user roles, quotas, and bans</p>
      </div>

      <UsersTable initialUsers={users} />
    </div>
  );
}
