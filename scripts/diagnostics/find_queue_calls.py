path = "c:/Users/patil/OneDrive/Desktop/open/OpenJam/backend/routes/queue.py"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if "lastfm_service" in line or "music_search_service" in line:
        print(f"{idx+1}: {line.strip()}")
