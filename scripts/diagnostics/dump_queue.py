import sys
sys.path.append(r"c:\Users\patil\OneDrive\Desktop\open\OpenJam")

from backend.database import SessionLocal
from backend.models.queue_item import QueueItem

def dump():
    db = SessionLocal()
    try:
        items = db.query(QueueItem).all()
        print(f"Total queue items: {len(items)}")
        for item in items:
            print(f"ID: {item.id}")
            print(f"  track_name: {item.track_name}")
            print(f"  artist: {item.artist}")
            print(f"  track_uri: {item.track_uri}")
            print(f"  status: {item.status}")
    finally:
        db.close()

if __name__ == "__main__":
    dump()
