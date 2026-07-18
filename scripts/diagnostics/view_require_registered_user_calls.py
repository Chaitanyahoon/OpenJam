from pathlib import Path

files = ["backend/routes/likes.py", "backend/routes/playlists.py", "backend/routes/profile.py"]
for fp in files:
    path = Path("c:/Users/patil/OneDrive/Desktop/open/OpenJam") / fp
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for idx, line in enumerate(lines):
        if "require_registered_user" in line:
            print(f"{fp}:{idx+1}: {line.strip()}")
