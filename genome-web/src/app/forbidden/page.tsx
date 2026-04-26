import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldOff, Home } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8">
      {/* Ambient gradient */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-down/10 via-transparent to-transparent blur-3xl animate-pulse" />
      </div>

      <Card className="w-full max-w-md border-down/30">
        <CardHeader className="space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-lg bg-down/20 flex items-center justify-center">
              <ShieldOff className="w-6 h-6 text-down" />
            </div>
          </div>
          <CardTitle className="text-2xl text-down">Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access this page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-text-dim mb-6">
            If you believe this is a mistake, please contact the administrator.
          </p>
          <Link href="/home">
            <Button className="w-full flex items-center justify-center gap-2">
              <Home className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
