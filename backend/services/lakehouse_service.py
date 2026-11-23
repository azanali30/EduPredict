"""
EduPredict - Lakehouse Service
Service layer wrapper for triggering and inspecting analytical Parquet lakehouse exports.
"""

import logging
from typing import Dict, Any, Optional
from pymongo.database import Database

from backend.data_engineering.parquet_exporter import (
    ParquetLakehouseExporter,
    LakehouseExportError,
    export_mongodb_to_parquet,
)

logger = logging.getLogger(__name__)


class LakehouseService:
    """Service layer interface for EduPredict analytical lakehouse operations."""

    def __init__(self, db: Optional[Database] = None):
        self.db = db

    def export_academic_lakehouse(
        self,
        export_dir: Optional[str] = None,
        collection_name: str = "analytical_academic_records",
        batch_size: int = 500,
        overwrite: bool = False,
    ) -> Dict[str, Any]:
        """
        Executes an export of academic records from MongoDB to the partitioned Parquet lakehouse.
        """
        if self.db is None:
            raise ValueError("Database instance must be provided to LakehouseService.")

        exporter = ParquetLakehouseExporter(
            db=self.db,
            export_dir=export_dir,
            batch_size=batch_size,
        )
        return exporter.export_academic_records(
            collection_name=collection_name,
            overwrite=overwrite,
        )
