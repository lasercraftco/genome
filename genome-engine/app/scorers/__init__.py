"""Multi-strategy scorer ensemble.

Each scorer takes a seed Track + Candidate and returns a normalized score
in [0, 1]. The ensemble combines them with per-station weights, applies a
diversity penalty, and reserves a 5–10% slice of recommendations for an
exploration / multi-armed-bandit slot."""

from __future__ import annotations

from app.scorers.collaborative import CollaborativeScorer
from app.scorers.content import ContentScorer
from app.scorers.critic import CriticScorer
from app.scorers.graph import GraphWalkScorer
from app.scorers.item2vec import Item2VecScorer
from app.scorers.llm import LLMScorer
from app.scorers.lyrical import LyricalScorer
from app.scorers.sequence import SequenceScorer
from app.scorers.setlist import SetlistScorer
from app.scorers.tag import TagScorer
from app.scorers.youtube_algo import YouTubeAlgoScorer

REGISTERED = [
    ContentScorer(),       # cosine over audio-feature vector
    CollaborativeScorer(), # Last.fm + ListenBrainz "people who like X also like Y"
    TagScorer(),           # Jaccard on tag union (Last.fm + MB + Discogs)
    LyricalScorer(),       # Genius lyrics cosine
    GraphWalkScorer(),     # MusicBrainz relationships — same producer, label, era
    SetlistScorer(),       # Setlist.fm + Songkick cohort
    YouTubeAlgoScorer(),   # YouTube mix-radio related signal
    CriticScorer(),        # Pitchfork BNM + AOTY editorial bias
    SequenceScorer(),      # Markov chain over Tyler's sessions
    LLMScorer(),           # Anthropic-augmented "deep think" rerank
    Item2VecScorer(),      # Skip-gram embedding over scrobble sessions
]


def by_name() -> dict[str, object]:
    return {s.name: s for s in REGISTERED}
