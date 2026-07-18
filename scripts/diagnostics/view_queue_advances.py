from pathlib import Path

files = [
    "backend/routes/queue.py",
    "backend/sockets/playback.py",
    "backend/sockets/queue.py"
]

for fp in files:
    full_path = Path("c:/Users/patil/OneDrive/Desktop/open/OpenJam") / fp
    if not full_path.exists():
        continue
    print("=" * 80)
    print(f"FILE: {fp}")
    print("=" * 80)
    with open(full_path, "r", encoding="utf-8") as f:
        lines = f.readlines()
    for idx, line in enumerate(lines):
        if "advance_queue" in line:
            start = max(0, idx - 4)
            end = min(len(lines), idx + 5)
            for j in range(start, end):
                print(f"{j+1}: {lines[j].strip()}")
            print("-" * 40)
