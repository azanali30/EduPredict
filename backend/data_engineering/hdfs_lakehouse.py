"""
EduPredict - Hadoop / HDFS Data Lake Storage Manager
Provides WebHDFS REST API client capabilities to organize, upload, retrieve, and verify
academic dataset files across the EduPredict analytical lakehouse.
"""

import os
import hashlib
import logging
from typing import Dict, Any, List, Optional
import urllib.request
import urllib.error
import json

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Standard EduPredict HDFS logical paths
HDFS_ROOT = "/edupredict"
HDFS_DIRS = [
    f"{HDFS_ROOT}/raw/academic",
    f"{HDFS_ROOT}/processed/academic",
    f"{HDFS_ROOT}/analytics/subject_performance",
    f"{HDFS_ROOT}/analytics/attendance",
    f"{HDFS_ROOT}/analytics/student_progress",
]


class HDFSLakehouseManager:
    """
    Manages Apache Hadoop Distributed File System (HDFS) integration via WebHDFS.
    Adheres to Apache Hadoop 3.x WebHDFS REST API specification.
    """

    def __init__(
        self,
        namenode_url: Optional[str] = None,
        hdfs_user: Optional[str] = None,
        enabled: Optional[bool] = None,
    ):
        self.namenode_url = namenode_url or os.getenv("HDFS_NAMENODE_URL", "http://localhost:9870/webhdfs/v1")
        self.hdfs_user = hdfs_user or os.getenv("HDFS_USER", "edupredict")
        self.enabled = enabled if enabled is not None else os.getenv("HDFS_ENABLED", "false").lower() == "true"

    def probe_connection(self) -> Dict[str, Any]:
        """
        Actively probes the HDFS NameNode / WebHDFS REST API endpoint.
        Returns detailed connectivity diagnostics.
        """
        probe_url = f"{self.namenode_url}/?op=LISTSTATUS&user.name={self.hdfs_user}"
        try:
            req = urllib.request.Request(probe_url, headers={"User-Agent": "EduPredict-HDFS-Client/1.0"})
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return {
                    "connected": True,
                    "namenode_url": self.namenode_url,
                    "status_code": resp.status,
                    "response": data,
                    "error": None,
                }
        except urllib.error.URLError as e:
            return {
                "connected": False,
                "namenode_url": self.namenode_url,
                "status_code": None,
                "response": None,
                "error": f"HDFS NameNode Unreachable: {e.reason}",
            }
        except Exception as e:
            return {
                "connected": False,
                "namenode_url": self.namenode_url,
                "status_code": None,
                "response": None,
                "error": str(e),
            }

    def ensure_lakehouse_directories(self) -> Dict[str, Any]:
        """Create required logical HDFS directories using WebHDFS MKDIRS operation."""
        probe = self.probe_connection()
        if not probe["connected"]:
            logger.warning(
                f"Cannot create HDFS directories: {probe['error']}. "
                "HDFS is currently offline or unreachable on this host."
            )
            return {
                "success": False,
                "reason": probe["error"],
                "planned_directories": HDFS_DIRS,
            }

        created = []
        for directory in HDFS_DIRS:
            url = f"{self.namenode_url}{directory}?op=MKDIRS&user.name={self.hdfs_user}&permission=755"
            req = urllib.request.Request(url, method="PUT")
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                if resp.status in (200, 201):
                    created.append(directory)
                    logger.info(f"HDFS directory created/verified: {directory}")

        return {"success": True, "created_directories": created}

    def upload_file(self, local_path: str, hdfs_path: str, overwrite: bool = True) -> Dict[str, Any]:
        """
        Uploads a local file to HDFS using the standard WebHDFS two-step creation protocol.
        Step 1: PUT request to NameNode with op=CREATE receives 307 redirect to DataNode.
        Step 2: PUT request with file payload to DataNode location.
        """
        if not os.path.exists(local_path):
            raise FileNotFoundError(f"Local file not found: {local_path}")

        probe = self.probe_connection()
        if not probe["connected"]:
            return {
                "success": False,
                "error": f"HDFS Unavailable: {probe['error']}",
                "local_path": local_path,
                "hdfs_path": hdfs_path,
            }

        with open(local_path, "rb") as f:
            local_bytes = f.read()

        local_md5 = hashlib.md5(local_bytes).hexdigest()
        local_size = len(local_bytes)

        # Step 1: Request upload location from NameNode
        create_url = (
            f"{self.namenode_url}{hdfs_path}?op=CREATE&user.name={self.hdfs_user}&overwrite={'true' if overwrite else 'false'}"
        )
        req1 = urllib.request.Request(create_url, method="PUT")

        try:
            with urllib.request.urlopen(req1, timeout=5.0) as resp1:
                datanode_location = resp1.headers.get("Location")

            # Step 2: Upload payload to DataNode
            req2 = urllib.request.Request(datanode_location, data=local_bytes, method="PUT", headers={"Content-Type": "application/octet-stream"})
            with urllib.request.urlopen(req2, timeout=30.0) as resp2:
                success = resp2.status in (200, 201)

            return {
                "success": success,
                "hdfs_path": hdfs_path,
                "size_bytes": local_size,
                "md5_checksum": local_md5,
                "error": None,
            }
        except Exception as e:
            logger.error(f"Failed to upload to HDFS {hdfs_path}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "local_path": local_path,
                "hdfs_path": hdfs_path,
            }

    @staticmethod
    def get_architectural_blueprint() -> Dict[str, Any]:
        """Return logical Lakehouse directory layout descriptions and purpose."""
        return {
            "/edupredict/raw/academic/": {
                "tier": "Raw Ingestion (Bronze Layer)",
                "purpose": "Immutable preservation of raw source datasets (student-mat.csv, student-por.csv).",
                "format": "CSV (Semicolon Delimited)",
                "retention": "Permanent Archive",
            },
            "/edupredict/processed/academic/": {
                "tier": "Cleaned & Normalized (Silver Layer)",
                "purpose": "Validated and schema-standardized student coursework observations (cleaned_academic_records.csv).",
                "format": "CSV / Apache Parquet (Snappy Compressed)",
                "retention": "Curated Analytical Master",
            },
            "/edupredict/analytics/subject_performance/": {
                "tier": "Analytical Aggregates (Gold Layer)",
                "purpose": "Pre-computed subject-level average marks, pass rates, and grade distributions for Apache Impala OLAP queries.",
                "format": "Parquet Partitioned by subject",
            },
            "/edupredict/analytics/attendance/": {
                "tier": "Analytical Aggregates (Gold Layer)",
                "purpose": "Correlated attendance vs final examination score aggregates and attendance bracket segmentations.",
                "format": "Parquet Partitioned by term",
            },
            "/edupredict/analytics/student_progress/": {
                "tier": "Analytical Aggregates (Gold Layer)",
                "purpose": "Longitudinal student trajectory data (G1 -> G2 -> G3 trends) for early academic risk classification.",
                "format": "Parquet Partitioned by academic_status",
            },
        }


def main():
    print("=== EDUPREDICT HDFS LAKEHOUSE DIAGNOSTIC ===")
    manager = HDFSLakehouseManager()
    probe = manager.probe_connection()
    print(f"NameNode URL : {manager.namenode_url}")
    print(f"HDFS User    : {manager.hdfs_user}")
    print(f"Connection   : {'CONNECTED' if probe['connected'] else 'UNREACHABLE / OFFLINE'}")
    if not probe["connected"]:
        print(f"Diagnostic   : {probe['error']}")
        print("\n[NOTE ON 8GB RAM HOST]")
        print("A native Apache Hadoop cluster requires 4-8 GB of RAM for NameNode, DataNode, and YARN daemons.")
        print("To run HDFS on a dedicated or remote environment, refer to 'analytics/hdfs/docker-compose-hdfs.yml'.")
    else:
        print("HDFS cluster is active. Provisioning directories...")
        dirs_res = manager.ensure_lakehouse_directories()
        print("Directories:", dirs_res)

    print("\n--- Lakehouse Architecture Blueprint ---")
    for path, meta in manager.get_architectural_blueprint().items():
        print(f"{path}")
        print(f"  Tier   : {meta['tier']}")
        print(f"  Format : {meta['format']}")
        print(f"  Purpose: {meta['purpose']}\n")


if __name__ == "__main__":
    main()
