import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Mail } from "lucide-react";

interface SignInPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

const ERROR_COPY: Record<string, string> = {
  invalid_email: "That doesn't look like a valid email. Try again.",
  expired: "That link has expired. Request a fresh one below.",
  used: "That link has already been used. Request a new one.",
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const user = await getUser();
  if (user) {
    redirect("/home");
  }

  const params = await searchParams;
  const error = asString(params.error);
  const sent = asString(params.sent) === "1";
  const devLink = asString(params.devLink);
  const errorMsg = error ? ERROR_COPY[error] ?? error : null;

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8">
      {/* Ambient gradient */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 blur-3xl animate-pulse" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl">{BRAND.name}</CardTitle>
          <CardDescription>{BRAND.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {errorMsg && (
            <Badge variant="warn" className="w-full justify-center">
              {errorMsg}
            </Badge>
          )}

          {sent ? (
            <div className="space-y-4">
              <Badge variant="up" className="w-full justify-center">
                Check your inbox for a magic link.
              </Badge>
              {devLink && (
                <div className="space-y-2 text-xs text-text-dim">
                  <p>Dev mode (no RESEND_API_KEY set on server) — use this link:</p>
                  <a
                    href={devLink}
                    className="block break-all rounded-md border border-surface-2 bg-surface-2/50 p-2 font-mono text-text hover:bg-surface-2"
                  >
                    {devLink}
                  </a>
                </div>
              )}
              <a
                href="/signin"
                className="block text-center text-xs text-text-dim underline-offset-4 hover:underline"
              >
                Send another link
              </a>
            </div>
          ) : (
            <form action="/api/auth/request" method="POST" className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-text">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  placeholder="your@email.com"
                  required
                  autoFocus
                  disabled={false}
                />
              </div>

              <Button
                type="submit"
                className="w-full flex items-center justify-center gap-2"
              >
                <Mail className="h-4 w-4" />
                Send magic link
                <ChevronRight className="h-4 w-4" />
              </Button>
            </form>
          )}

          <p className="text-xs text-text-dim text-center">
            We&apos;ll send you a secure link to sign in. No password needed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
