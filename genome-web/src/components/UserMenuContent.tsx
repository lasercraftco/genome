"use client";

import { useState } from "react";
import { isOwner } from "@/lib/auth/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Settings, Library, Zap, ShieldCheck, LogOut } from "lucide-react";

interface UserMenuContentProps {
  email: string;
  gravatarUrl: string;
  initials: string;
  role: string;
}

export function UserMenuContent({
  email,
  gravatarUrl,
  initials,
  role,
}: UserMenuContentProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full overflow-hidden h-10 w-10 hover:ring-2 hover:ring-primary bg-primary/10 flex items-center justify-center"
          title={email}
        >
          {!imageError ? (
            <img
              src={gravatarUrl}
              alt={email}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <span className="text-xs font-semibold text-text">{initials}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center gap-2">
          <div className="text-sm font-medium text-text">{email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/stations" className="cursor-pointer flex items-center gap-2">
            <Zap className="h-4 w-4" />
            <span>My Stations</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/library" className="cursor-pointer flex items-center gap-2">
            <Library className="h-4 w-4" />
            <span>My Library Activity</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/settings" className="cursor-pointer flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </a>
        </DropdownMenuItem>
        {role === "owner" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/admin" className="cursor-pointer flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <span>Admin Panel</span>
              </a>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <form
            action="/api/auth/signout"
            method="POST"
            className="w-full cursor-pointer"
          >
            <button className="flex items-center gap-2 w-full text-down hover:text-down">
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
