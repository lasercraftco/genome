import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Music, Heart, Lock, Code } from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg py-12 px-4">
      {/* Ambient gradient */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 blur-3xl animate-pulse" />
      </div>

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-text mb-4">{BRAND.name}</h1>
          <p className="text-xl text-text-dim">{BRAND.tagline}</p>
        </div>

        {/* Description */}
        <Card className="mb-12">
          <CardContent className="p-8 space-y-4">
            <p className="text-text-dim">
              {BRAND.description}
            </p>
            <p className="text-text-dim">
              Built by <span className="text-primary font-semibold">{BRAND.authorOf}</span>,
              Genome brings the joy of music discovery back to your hands. No streaming
              subscriptions required—just music, your taste, and algorithms that actually learn
              from what you love.
            </p>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="grid sm:grid-cols-2 gap-6 mb-12">
          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Music className="h-6 w-6 text-primary" />
                <h3 className="font-semibold text-text">Pandora-Style Stations</h3>
              </div>
              <p className="text-sm text-text-dim">
                Pick an artist, song, or tag. Get a station that learns and evolves with your
                feedback.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Heart className="h-6 w-6 text-accent" />
                <h3 className="font-semibold text-text">Your Library Grows</h3>
              </div>
              <p className="text-sm text-text-dim">
                Thumb up tracks you love. They get added to your library as you discover them.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Lock className="h-6 w-6 text-primary" />
                <h3 className="font-semibold text-text">Self-Hosted</h3>
              </div>
              <p className="text-sm text-text-dim">
                Run on your own infrastructure. Your music, your rules, no middleman.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Code className="h-6 w-6 text-accent" />
                <h3 className="font-semibold text-text">Built on Open Standards</h3>
              </div>
              <p className="text-sm text-text-dim">
                Powered by Next.js, React, and open music data sources. Designed to extend.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tech Stack */}
        <Card className="mb-12">
          <CardContent className="p-8">
            <h2 className="text-xl font-semibold text-text mb-4">Tech Stack</h2>
            <div className="grid sm:grid-cols-2 gap-6 text-sm">
              <div>
                <h3 className="font-semibold text-primary mb-2">Frontend</h3>
                <ul className="space-y-1 text-text-dim">
                  <li>Next.js 15 (App Router)</li>
                  <li>React 19</li>
                  <li>TypeScript (strict)</li>
                  <li>Tailwind CSS v4</li>
                  <li>shadcn/ui</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-accent mb-2">Backend</h3>
                <ul className="space-y-1 text-text-dim">
                  <li>Python FastAPI</li>
                  <li>PostgreSQL (Drizzle ORM)</li>
                  <li>Music recommendation engine</li>
                  <li>Lidarr integration</li>
                  <li>YouTube & Spotify sources</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="text-center space-y-4">
          <Link href="/">
            <Button size="lg">
              Get Started
            </Button>
          </Link>
          <p className="text-text-dim">
            Made with care for music lovers, by a music lover.
          </p>
        </div>
      </div>
    </div>
  );
}
