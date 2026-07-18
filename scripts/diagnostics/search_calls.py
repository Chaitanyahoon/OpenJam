import re
from pathlib import Path

backend_dir = Path("c:/Users/patil/OneDrive/Desktop/open/OpenJam/backend")
methods = ["search_tracks", "resolve_youtube", "get_recommendations", "resolve_youtube_metadata"]

for path in backend_dir.glob("**/*.py"):
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for idx, line in enumerate(lines):
        for method in methods:
            if method in line and "def " not in line:
                print(f"{path.name}:{idx+1}: {line.strip()}")
