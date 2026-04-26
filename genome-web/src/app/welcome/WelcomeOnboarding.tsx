"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, Search, CheckCircle, Sparkles } from "lucide-react";
import { engine } from "@/lib/engine";
import { toast } from "sonner";

type Step = "welcome" | "artists" | "complete";

interface Artist {
  id: string;
  label: string;
  sublabel?: string;
}

interface WelcomeOnboardingProps {
  userId: string;
  email: string;
}

export function WelcomeOnboarding({ userId, email }: WelcomeOnboardingProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [selectedArtists, setSelectedArtists] = useState<Artist[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Artist[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await engine.search(q);
      const artists = result.results.filter((r) => r.kind === "artist");
      setSearchResults(artists);
    } catch (err) {
      console.error("Search failed:", err);
      toast.error("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const toggleArtist = (artist: Artist) => {
    setSelectedArtists((prev) => {
      const exists = prev.find((a) => a.id === artist.id);
      if (exists) {
        return prev.filter((a) => a.id !== artist.id);
      } else {
        return [...prev, artist];
      }
    });
  };

  const handleComplete = async () => {
    if (selectedArtists.length === 0) {
      toast.error("Please pick at least one artist");
      return;
    }

    setIsSubmitting(true);
    try {
      // Call server action to complete onboarding
      const res = await fetch("/api/welcome/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artists: selectedArtists.map((a) => ({
            seed_type: "artist",
            seed_id: a.id,
            seed_label: a.label,
          })),
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        throw new Error(error);
      }

      toast.success("Welcome to Genome!");
      router.push("/home");
    } catch (err) {
      console.error("Completion failed:", err);
      toast.error("Failed to complete setup. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-8">
      {/* Ambient gradient */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-2xl">
        {step === "welcome" && (
          <div className="space-y-6 p-6 sm:p-8">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-text">Welcome to Genome</h1>
              <p className="text-text-dim">
                Let's get you started with personalized music discovery. Pick a few artists you love, and we'll create stations tailored to your taste.
              </p>
            </div>

            <Button
              size="lg"
              className="w-full flex items-center justify-center gap-2"
              onClick={() => setStep("artists")}
            >
              Pick artists
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === "artists" && (
          <div className="space-y-6 p-6 sm:p-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-text">
                Pick 3 artists you love
              </h2>
              <p className="text-text-dim">
                These will seed your initial stations. You can add more later.
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-dim" />
              <Input
                className="pl-10"
                placeholder="Search for an artist..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                disabled={isSearching}
              />
            </div>

            {/* Search results */}
            {isSearching && (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            )}

            {!isSearching && searchResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((artist) => (
                  <button
                    key={artist.id}
                    onClick={() => toggleArtist(artist)}
                    className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                      selectedArtists.find((a) => a.id === artist.id)
                        ? "border-primary bg-primary/10"
                        : "border-surface-2 hover:border-primary"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-text">{artist.label}</div>
                        {artist.sublabel && (
                          <div className="text-xs text-text-dim">{artist.sublabel}</div>
                        )}
                      </div>
                      {selectedArtists.find((a) => a.id === artist.id) && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="text-center py-6 text-text-dim">
                No artists found. Try a different search.
              </div>
            )}

            {/* Selected artists */}
            {selectedArtists.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-text">
                  Selected ({selectedArtists.length}/3):
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedArtists.map((artist) => (
                    <Badge
                      key={artist.id}
                      variant="default"
                      className="cursor-pointer hover:opacity-80"
                      onClick={() => toggleArtist(artist)}
                    >
                      {artist.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => setStep("welcome")}
                disabled={isSubmitting}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={() => {
                  if (selectedArtists.length > 0) {
                    setStep("complete");
                  } else {
                    toast.error("Please pick at least one artist");
                  }
                }}
                disabled={isSubmitting || selectedArtists.length === 0}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "complete" && (
          <div className="space-y-6 p-6 sm:p-8 text-center">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-up to-accent flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-text">You're all set!</h2>
              <p className="text-text-dim">
                We've created seed stations for the artists you picked. Start discovering!
              </p>
            </div>

            <div className="bg-surface-2 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-text">Your artists:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {selectedArtists.map((artist) => (
                  <Badge key={artist.id} variant="secondary">
                    {artist.label}
                  </Badge>
                ))}
              </div>
            </div>

            <Button
              size="lg"
              onClick={handleComplete}
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? "Setting up..." : "Go to Genome"}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
