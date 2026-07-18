from pathlib import Path

path = Path("c:/Users/patil/OneDrive/Desktop/open/OpenJam/backend/sockets/queue.py")
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if "_db_play_now" in line:
        start = max(0, idx - 4)
        end = min(len(lines), idx + 25)
        print("=" * 80)
        print(f"LINE {idx+1}")
        print("=" * 80)
        for j in range(start, end):
            print(f"{j+1}: {lines[j].strip()}")
