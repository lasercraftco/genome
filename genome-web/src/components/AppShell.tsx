import * as React from "react";
import { getUser, isOwner } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { MiniPlayer } from "@/components/player/MiniPlayer";
import { SearchPalette } from "@/components/SearchPalette";
import { UserMenu } from "@/components/UserMenu";
import {
  Sparkles,
  Home,
  Music,
  Library,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

interface AppShellProps {
  children: React.ReactNode;
}

export async function AppShell({ children }: AppShellProps) {
  const u = await getUser();

  const navItems = [
    { href: "/home", label: "Home", icon: Home },
    { href: "/stations", label: "Stations", icon: Music },
    { href: "/library", label: "Library", icon: Library },
    { href: "/smart", label: "Smart", icon: Sparkles },
    ...(u && isOwner(u)
      ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }]
      : []),
  ];

  return (
    <div className="flex min-h-screen bg-bg flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-surface-2 bg-surface/50 backdrop-blur-sm">
        <div className="flex items-center justify-between h-16 px-4 sm:px-6">
          {/* Brand */}
          <Link href="/home" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div className="hidden sm:flex flex-col">
              <div className="text-sm font-bold text-text">{BRAND.name}</div>
              <div className="text-xs text-text-dim">{BRAND.tagline}</div>
            </div>
          </Link>

          {/* Search trigger + User menu */}
          <div className="flex items-center gap-2 flex-1 max-w-xs ml-4 justify-end">
            <SearchPalette />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:w-56 border-r border-surface-2 bg-surface/30 flex-col p-4 gap-4">
          <nav className="flex flex-col gap-1">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 px-4 py-2 rounded-lg text-text-dim hover:text-text hover:bg-surface-2 transition-all"
              >
                <Icon className="h-5 w-5" />
                <span className="text-sm font-medium">{label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {/* Persistent mini-player — only renders when something is playing */}
      <MiniPlayer />

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-16 left-0 right-0 border-t border-surface-2 bg-surface/80 backdrop-blur-sm z-20">
        <div className="flex justify-around h-16">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-1 flex-1 text-text-dim hover:text-primary transition-colors"
              title={label}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
