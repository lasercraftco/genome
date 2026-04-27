import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, User } from "lucide-react";

interface SignInPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

const ERROR_COPY: Record<string, string> = {
  name_required: "Enter your first name to keep going.",
  invalid_name: "That name didn't take. Try just letters and numbers.",
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const user = await getUser();
  if (user) redirect("/home");

  const params = await searchParams;
  const error = asString(params.error);
  const next = asString(params.next);
  const errorMsg = error ? ERROR_COPY[error] ?? error : null;

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8">
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

          <form action="/api/auth/sign-in" method="POST" className="space-y-4">
            {next && <input type="hidden" name="next" value={next} />}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-text">
                Enter your first name
              </label>
              <Input
                id="name"
                type="text"
                name="name"
                placeholder="e.g. tyler"
                autoComplete="given-name"
                required
                autoFocus
                disabled={false}
              />
            </div>

            <Button
              type="submit"
              className="w-full flex items-center justify-center gap-2"
            >
              <User className="h-4 w-4" />
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="text-xs text-text-dim text-center">
            Single sign-on across Tyflix &mdash; same name on Reel, Genome, and Karaoke.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
