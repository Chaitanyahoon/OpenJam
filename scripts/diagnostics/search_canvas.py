import re

file_path = r"c:\Users\patil\OneDrive\Desktop\open\OpenJam\frontend-next\app\room\[id]\RoomClient.js"
with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "canvas" in line.lower():
        print(f"{i+1}: {line.strip()}")
