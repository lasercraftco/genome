import { createHash } from "crypto";
import { getUser } from "@/lib/auth/session";
import { UserMenuContent } from "./UserMenuContent";

export async function UserMenu() {
  const u = await getUser();
  if (!u) return null;

  const display = u.displayName || u.username || u.email?.split("@")[0] || "friend";
  // Gravatar still works — hash whatever stable identifier we have
  const hashSrc = (u.email ?? u.username ?? u.id).toLowerCase();
  const hash = createHash("md5").update(hashSrc).digest("hex");
  const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?s=80&d=mp`;

  const initials = display
    .split(/[._\s-]/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || display.slice(0, 2).toUpperCase();

  return (
    <UserMenuContent
      email={display}
      gravatarUrl={gravatarUrl}
      initials={initials}
      role={u.role}
    />
  );
}
