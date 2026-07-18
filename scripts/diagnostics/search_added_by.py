from pathlib import Path

frontend_dir = Path("c:/Users/patil/OneDrive/Desktop/open/OpenJam/frontend-next")
for path in frontend_dir.glob("**/*.js"):
    if "node_modules" in path.parts or ".next" in path.parts:
        continue
    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        if "added_by_id" in content:
            print(f"Found added_by_id in: {path}")
        if "added_by_user_id" in content:
            print(f"Found added_by_user_id in: {path}")
    except Exception as e:
        print(f"Failed to read {path}: {e}")
