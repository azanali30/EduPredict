# EduPredict — Analytical Lakehouse Parquet Export Bridge (Phase 7E.1)

The **Parquet Lakehouse Export Bridge** provides reliable, deterministic serialization of academic records from MongoDB 6.x into partitioned Apache Parquet files for the EduPredict Analytical Lakehouse.

---

## 1. Architecture & Design

### 1.1 Target Schema
The output Parquet dataset maps 1:1 with the Apache Impala Lakehouse table DDL specified in `analytics/impala/01_create_academic_lakehouse_tables.sql`:

- **Database**: `edupredict_lakehouse`
- **Table**: `student_academic_records`
- **File Format**: Apache Parquet (`STORED AS PARQUET`)
- **Compression**: `SNAPPY` (`TBLPROPERTIES ('parquet.compression'='SNAPPY')`)
- **Partitioning Columns**:
  - `subject` (e.g. `Mathematics`, `Portuguese Language`)
  - `academic_year` (e.g. `2024-2025`, `2025-2026`)

### 1.2 Storage Layout
Parquet files are organized according to standard Hive directory partitioning outside the frontend public directory:

```
data/lakehouse/student_academic_records/
├── _SUCCESS
├── _export_summary.json
├── subject=Mathematics/
│   ├── academic_year=2024-2025/
│   │   └── <uuid>.parquet
│   └── academic_year=2025-2026/
│       └── <uuid>.parquet
└── subject=Portuguese Language/
    └── academic_year=2025-2026/
        └── <uuid>.parquet
```

Internal MongoDB identifiers (`_id`) are excluded during extraction to ensure clean relational and columnar interoperability.

---

## 2. Configuration Options

Configured in `backend/config.py` with environment variable overrides:

| Configuration Variable | Environment Variable | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `LAKEHOUSE_PARQUET_DIR` | `LAKEHOUSE_PARQUET_DIR` | `data/lakehouse/student_academic_records` | Root destination directory for partitioned Parquet output. |
| `LAKEHOUSE_EXPORT_BATCH_SIZE` | `LAKEHOUSE_EXPORT_BATCH_SIZE` | `500` | Cursor batch size for reading records from MongoDB. |

---

## 3. How to Run the Export

### A. Via Command-Line Interface (CLI)

Run the module directly using Python within the virtual environment:

```powershell
# Standard export using default configuration
.\.venv\Scripts\python.exe -m backend.data_engineering.parquet_exporter

# Export with explicit overwrite and custom directory
.\.venv\Scripts\python.exe -m backend.data_engineering.parquet_exporter --output-dir data/lakehouse/student_academic_records --overwrite

# Custom batch size
.\.venv\Scripts\python.exe -m backend.data_engineering.parquet_exporter --batch-size 250 --overwrite
```

### B. Programmatically via Python API

```python
from backend.app import create_app
from backend.extensions import mongo
from backend.data_engineering.parquet_exporter import export_mongodb_to_parquet

app = create_app("development")
with app.app_context():
    summary = export_mongodb_to_parquet(
        db=mongo.db,
        overwrite=True,
    )
    print(f"Exported {summary['valid_records_exported']} records across {summary['partition_count']} partitions.")
```

### C. Programmatically via Service Layer

```python
from backend.services.lakehouse_service import LakehouseService

service = LakehouseService(db=mongo.db)
summary = service.export_academic_lakehouse(overwrite=True)
```

---

## 4. Export Telemetry & Manifest

Every completed export produces an `export_summary.json` file inside the lakehouse directory containing comprehensive audit telemetry:

```json
{
  "source_collection": "analytical_academic_records",
  "total_records_read": 1044,
  "valid_records_exported": 1044,
  "rejected_records": 0,
  "partition_count": 2,
  "partitions": [
    {
      "subject": "Mathematics",
      "academic_year": "2025-2026",
      "record_count": 395,
      "files": 1
    },
    {
      "subject": "Portuguese Language",
      "academic_year": "2025-2026",
      "record_count": 649,
      "files": 1
    }
  ],
  "output_location": "C:\\Users\\Azan's PC\\Documents\\EduPredict\\data\\lakehouse\\student_academic_records",
  "export_timestamp": "2026-11-23T17:28:00+00:00",
  "compression": "SNAPPY",
  "file_format": "PARQUET",
  "status": "COMPLETED_SUCCESSFULLY"
}
```

---

## 5. Error Handling & Safety Guarantees

1. **Duplicate & Overwrite Guard**:
   - `overwrite=False` raises `FileExistsError` if the output directory already contains Parquet files.
   - `overwrite=True` writes to an isolated temporary staging directory (`.tmp_lakehouse_<uuid>`) and atomically replaces the target path on success. This guarantees that failed exports never leave partially written or corrupted data.
2. **Schema & Boundary Validation**:
   - Out-of-bounds percentages ($< 0\%$ or $> 100\%$), invalid risk categories, or missing required keys are safely filtered and recorded in `rejected_records`.
3. **MongoDB Resilience**:
   - Connection timeouts or query errors raise `LakehouseExportError` with diagnostic context.
   - Empty collections produce a valid summary with `status: "EMPTY_DATASET"` and zero generated files.
