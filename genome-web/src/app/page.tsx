import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Radio,
  Music,
  Heart,
  Lock,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export default async function LandingPage() {
  const u = await getUser();
  if (u) {
    redirect("/home");
  }

  return (
    <div className="min-h-screen bg-bg overflow-hidden">
      {/* Ambient gradient background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 blur-3xl animate-pulse" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center justify-center min-h-screen px-4 sm:px-6">
        {/* Hero section */}
        <div className="text-center mb-12 max-w-2xl">
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Radio className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-text mb-4 font-display">
            {BRAND.name}
          </h1>
          <p className="text-xl text-text-dim mb-8">{BRAND.tagline}</p>

          {/* Features */}
          <div className="grid sm:grid-cols-2 gap-4 mb-12">
            <div className="flex items-start gap-3 text-left">
              <Music className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
              <div>
                <div className="font-semibold text-text">Pandora-style stations</div>
                <p className="text-sm text-text-dim">Pick an artist or song, get endless discovery</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-left">
              <Heart className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
              <div>
                <div className="font-semibold text-text">Your library grows</div>
                <p className="text-sm text-text-dim">Thumb up to refine, add to your library when you love it</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-left">
              <Lock className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
              <div>
                <div className="font-semibold text-text">Self-hosted</div>
                <p className="text-sm text-text-dim">Run on your own infrastructure, no streaming fees</p>
              </div>
            </div>
            <div className="flex items-start gap-3 text-left">
              <Sparkles className="h-5 w-5 text-accent flex-shrink-0 mt-1" />
              <div>
                <div className="font-semibold text-text">Smart discovery</div>
                <p className="text-sm text-text-dim">Find music beyond your usual playlists</p>
              </div>
            </div>
          </div>

          {/* CTA Card */}
          <Card className="max-w-md mx-auto p-8 bg-gradient-to-br from-surface to-surface-2">
            <CardContent className="space-y-4">
              <h2 className="text-2xl font-bold text-text">Get started</h2>
              <SignInForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

async function SignInForm() {
  return (
    <form action="/api/auth/request" method="POST" className="space-y-4">
      <Input
        type="email"
        name="email"
        placeholder="your@email.com"
        required
        className="text-center"
      />
      <Button
        type="submit"
        className="w-full flex items-center justify-center gap-2"
      >
        Sign in with magic link
        <ChevronRight className="h-4 w-4" />
      </Button>
      <p className="text-xs text-text-dim">
        We'll send you a link to sign in. No password needed.
      </p>
    </form>
  );
}
