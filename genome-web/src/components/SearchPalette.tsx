"use client";

import { Command } from "cmdk";
import { Disc3, Music, Search, Sparkles, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { engine, type SearchResult } from "@/lib/engine";

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Cmd-K toggles the palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key.toLowerCase() === "n" && !(e.metaKey || e.ctrlKey)) {
        if (e.target instanceof HTMLInputElement) return;
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!open || !q) {
      setResults([]);
      return;
    }
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const r = await engine.search(q);
        setResults(r.results);
      } catch (e) {
        toast.error("Search failed", { description: String(e) });
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => window.clearTimeout(t);
  }, [q, open]);

  async function pick(r: SearchResult) {
    try {
      const station = await engine.createStation({
        seed_type: r.kind,
        seed_id: r.id,
        seed_label: r.label,
        name: r.label,
      });
      setOpen(false);
      setQ("");
      router.push(`/stations/${station.id}`);
    } catch (e) {
      toast.error("Couldn't create station", { description: String(e) });
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full bg-surface ring-1 ring-text/5 px-4 py-2 text-sm text-text-dim hover:text-text hover:ring-text/15 transition w-full md:w-72"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search artists, tracks, tags…</span>
          <kbd className="hidden md:inline rounded bg-text/5 px-1.5 py-0.5 text-[10px] text-text-faint">⌘K</kbd>
        </button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle>Start a station</SheetTitle>
        <SheetDescription>
          Pick an artist, track, or tag — Genome will build a station around it.
        </SheetDescription>
        <Command label="Search" shouldFilter={false} className="mt-4">
          <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3">
            <Search className="h-4 w-4 text-text-dim" />
            <Command.Input
              autoFocus
              value={q}
              onValueChange={setQ}
              placeholder="Type to search…"
              className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-text-faint"
            />
          </div>
          <Command.List className="mt-3 max-h-[60vh] overflow-y-auto scrollbar-thin">
            {loading ? (
              <div className="py-8 text-center text-sm text-text-faint">Searching…</div>
            ) : null}
            {!loading && q && results.length === 0 ? (
              <div className="py-8 text-center text-sm text-text-faint">No matches</div>
            ) : null}
            {results.map((r) => (
              <Command.Item
                key={`${r.kind}-${r.id}`}
                value={`${r.kind} ${r.label} ${r.sublabel ?? ""}`}
                onSelect={() => pick(r)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm cursor-pointer aria-selected:bg-text/5"
              >
                <KindIcon kind={r.kind} />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-text">{r.label}</div>
                  {r.sublabel ? <div className="truncate text-xs text-text-dim">{r.sublabel}</div> : null}
                </div>
                <span className="text-[10px] uppercase tracking-wider text-text-faint">{r.kind}</span>
              </Command.Item>
            ))}
          </Command.List>
        </Command>
        <div className="mt-4 text-[11px] text-text-faint">
          <Sparkles className="inline h-3 w-3 mr-1" />
          Tip: press <kbd className="rounded bg-text/5 px-1">N</kbd> to start a new station from anywhere.
        </div>
      </SheetContent>
    </Sheet>
  );
}

function KindIcon({ kind }: { kind: string }) {
  if (kind === "artist") return <Disc3 className="h-4 w-4 text-primary" />;
  if (kind === "tag") return <Tag className="h-4 w-4 text-accent" />;
  return <Music className="h-4 w-4 text-text-dim" />;
}
