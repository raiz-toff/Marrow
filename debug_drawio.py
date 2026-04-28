import sys
import os

# Add the current directory to path so we can import engine
sys.path.append(os.getcwd())

from engine.ingestors.drawio import DrawIOIngestor

def test_ingest(file_path):
    print(f"Testing ingestion of {file_path}")
    ingestor = DrawIOIngestor()
    
    if not ingestor.can_handle(file_path):
        print("Ingestor claims it cannot handle this file.")
        return

    try:
        data = ingestor.ingest(file_path)
        print("Ingestion successful.")
        print(f"Nodes found: {len(data.get('nodes', []))}")
        print(f"Links found: {len(data.get('links', []))}")
        # print("Nodes:", data.get('nodes'))
    except Exception as e:
        print(f"Ingestion failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_ingest("/home/blackmagic/Downloads/Untitled Diagram.drawio.svg")
