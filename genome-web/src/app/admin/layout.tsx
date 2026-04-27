import { requireRole } from "@/lib/auth/session";
import { AppShell } from "@/components/AppShell";
import { Users, FileText, Settings, AlertCircle } from "lucide-react";
import Link from "next/link";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  await requireRole("owner");

  return (
    <AppShell>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text flex items-center gap-2">
            <AlertCircle className="h-8 w-8 text-primary" />
            Admin Panel
          </h1>
          <p className="text-text-dim mt-1">Manage users, requests, and system settings</p>
        </div>

        <div className="space-y-6">
          <nav className="flex gap-2 border-b border-surface-2">
            <Link href="/admin/users">
              <button className="flex items-center gap-2 px-4 py-2 border-b-2 border-transparent text-text-dim hover:text-text hover:border-primary transition-colors">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Users</span>
              </button>
            </Link>
            <Link href="/admin/audit">
              <button className="flex items-center gap-2 px-4 py-2 border-b-2 border-transparent text-text-dim hover:text-text hover:border-primary transition-colors">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Audit</span>
              </button>
            </Link>
            <Link href="/admin/quotas">
              <button className="flex items-center gap-2 px-4 py-2 border-b-2 border-transparent text-text-dim hover:text-text hover:border-primary transition-colors">
                <AlertCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Quotas</span>
              </button>
            </Link>
            <Link href="/admin/settings">
              <button className="flex items-center gap-2 px-4 py-2 border-b-2 border-transparent text-text-dim hover:text-text hover:border-primary transition-colors">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            </Link>
          </nav>

          <div>{children}</div>
        </div>
      </div>
    </AppShell>
  );
}
