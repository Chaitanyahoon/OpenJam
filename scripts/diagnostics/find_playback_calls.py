path = "c:/Users/patil/OneDrive/Desktop/open/OpenJam/backend/sockets/playback.py"
with open(path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if "music_search_service" in line:
        print(f"{idx+1}: {line.strip()}")
