"""Mixcloud — DJ sets + radio shows. Useful for electronic / longer-form."""

from __future__ import annotations

from app.sources._ytdlp_helpers import ytdlp_resolve
from app.sources.base import ResolveResult


class MixcloudResolver:
    name = "mixcloud"
    quality = 60

    async def resolve(self, artist: str, title: str) -> ResolveResult | None:
        return await ytdlp_resolve(
            artist, title, source=self.name, search_prefix="mixcloud", quality=self.quality
        )


resolver = MixcloudResolver()
