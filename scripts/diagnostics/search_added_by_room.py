from pathlib import Path

path = Path("c:/Users/patil/OneDrive/Desktop/open/OpenJam/frontend-next/app/room/[id]/RoomClient.js")
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if "added_by_" in line:
        print(f"{idx+1}: {line.strip()}")
