from pathlib import Path

backend_dir = Path("c:/Users/patil/OneDrive/Desktop/open/OpenJam/backend")
for path in backend_dir.glob("**/*.py"):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    if "require_registered_user" in content:
        print(f"Found in: {path}")
