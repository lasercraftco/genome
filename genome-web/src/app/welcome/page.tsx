import { requireUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { WelcomeOnboarding } from "./WelcomeOnboarding";

export default async function WelcomePage() {
  const u = await requireUser();

  // If already onboarded, redirect to home
  if (u.onboardedAt) {
    redirect("/home");
  }

  return <WelcomeOnboarding userId={u.id} email={u.email} />;
}
