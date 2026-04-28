from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseIngestor(ABC):
    """
    Abstract base class for all topology ingestors.
    Each ingestor is responsible for parsing a specific file format
    and returning a standardized topology dictionary.
    """

    @abstractmethod
    def ingest(self, file_path: str) -> Dict[str, Any]:
        """
        Parses the input file and returns a standardized topology dict.
        
        Returns:
            dict: {
                "nodes": [
                    {"id": "...", "label": "...", "role": "...", "icon": "...", ...}
                ],
                "links": [
                    {"from": "...", "to": "...", "cable": "...", ...}
                ],
                "groups": [...],
                "meta": {...}
            }
        """
        pass

    @classmethod
    @abstractmethod
    def can_handle(cls, file_path: str) -> bool:
        """Returns True if this ingestor can handle the given file."""
        pass
