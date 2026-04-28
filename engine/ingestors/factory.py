from typing import List, Type
from engine.ingestors.base import BaseIngestor
from engine.ingestors.drawio import DrawIOIngestor

class IngestorFactory:
    _ingestors: List[Type[BaseIngestor]] = [
        DrawIOIngestor,
        # Future: CMLIngestor, EveNGIngestor
    ]

    @classmethod
    def get_ingestor(cls, file_path: str) -> BaseIngestor:
        """
        Returns an instance of the appropriate ingestor for the given file.
        Raises ValueError if no matching ingestor is found.
        """
        for ingestor_cls in cls._ingestors:
            if ingestor_cls.can_handle(file_path):
                return ingestor_cls()
        
        raise ValueError(f"No suitable ingestor found for file: {file_path}")
