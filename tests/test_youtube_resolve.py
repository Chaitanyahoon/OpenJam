import asyncio
import logging
import sys

sys.path.append(r"c:\Users\patil\OneDrive\Desktop\open\OpenJam")

from backend.services.music_search import music_search_service

async def test():
    query = "Zubaida Nanku, Natiq official audio"
    print("Resolving query:", query)
    vid = music_search_service.resolve_youtube(query)
    print("Resolved video ID:", vid)
    if vid:
        meta = music_search_service.resolve_youtube_metadata(vid)
        print("Resolved metadata:")
        print("  title:", meta.get("title") if meta else None)
        print("  author:", meta.get("author") if meta else None)

if __name__ == "__main__":
    asyncio.run(test())
