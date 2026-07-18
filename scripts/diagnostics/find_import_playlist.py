from pathlib import Path

path = Path("c:/Users/patil/OneDrive/Desktop/open/OpenJam/backend/routes/queue.py")
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if "def import_playlist" in line:
        start = idx
        end = min(len(lines), idx + 100)
        print("=" * 80)
        print(f"LINE {idx+1}")
        print("=" * 80)
        for j in range(start, end):
            print(f"{j+1}: {lines[j].rstrip()}")
