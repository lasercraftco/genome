import { createHash } from "crypto";
import { getUser } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/session";
import { UserMenuContent } from "./UserMenuContent";

export async function UserMenu() {
  const u = await getUser();
  if (!u) return null;

  // Generate gravatar URL
  const hash = createHash("md5").update(u.email.toLowerCase()).digest("hex");
  const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?s=80&d=mp`;

  // Get initials
  const initials = u.email
    .split("@")[0]
    .split(/[._-]/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <UserMenuContent
      email={u.email}
      gravatarUrl={gravatarUrl}
      initials={initials}
      role={u.role}
    />
  );
}
