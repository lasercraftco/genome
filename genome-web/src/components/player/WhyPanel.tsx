"use client";

import type { NowPlayingTrack } from "@/lib/engine";
import { Badge } from "@/components/ui/badge";

const FEATURE_LABELS: Record<string, string> = {
  bpm: "BPM",
  energy: "Energy",
  valence: "Mood",
  danceability: "Dance",
  acousticness: "Acoustic",
  instrumentalness: "Instrumental",
};

export function WhyPanel({ current }: { current: NowPlayingTrack }) {
  const expl = current.explanation;
  const features = current.track.audio_features ?? {};
  return (
    <div className="space-y-6 mt-2">
      <p className="text-text leading-relaxed">{expl.reason || "Closely related to the seed."}</p>

      {expl.tag_overlap.length > 0 && (
        <Section title="Shared tags">
          <div className="flex flex-wrap gap-2">
            {expl.tag_overlap.map((t) => (
              <Badge key={t} variant="secondary">{t}</Badge>
            ))}
          </div>
        </Section>
      )}

      {Object.keys(features).length > 0 && (
        <Section title="Music genome">
          <ul className="grid grid-cols-2 gap-y-2 text-sm">
            {Object.entries(FEATURE_LABELS).map(([k, label]) => {
              const v = features[k];
              if (v == null) return null;
              return (
                <li key={k} className="flex justify-between">
                  <span className="text-text-dim">{label}</span>
                  <span className="font-mono text-text">
                    {k === "bpm" ? Math.round(v) : (typeof v === "number" ? v.toFixed(2) : v)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {expl.sources.length > 0 && (
        <Section title="Signal sources">
          <div className="flex flex-wrap gap-2">
            {expl.sources.map((s) => (
              <Badge key={s} variant="outline">{s}</Badge>
            ))}
          </div>
        </Section>
      )}

      {expl.similarity_score != null && (
        <div className="rounded-2xl bg-surface-2 p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-text-faint">Similarity score</div>
          <div className="mt-1 text-2xl font-mono text-primary">
            {(expl.similarity_score * 100).toFixed(0)}%
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-text-faint mb-2">{title}</div>
      {children}
    </div>
  );
}
