import re
from pathlib import Path

backend_dir = Path("c:/Users/patil/OneDrive/Desktop/open/OpenJam/backend")
methods = ["search_tracks", "resolve_youtube", "get_recommendations", "resolve_youtube_metadata"]

for path in backend_dir.glob("**/*.py"):
    if path.name == "music_search.py":
        continue
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    for method in methods:
        if method in content:
            print(f"Found reference to {method} in {path}")
