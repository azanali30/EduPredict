# EduPredict — WebHDFS Contract Testing (Phase 7E.2)

**Specification Baseline**: Aptech eProject Big Data / EduPredict SRS  
**Target Component**: `backend/data_engineering/hdfs_lakehouse.py`  
**Test Suite**: `tests/test_webhdfs_contract.py`  
**Execution Mode**: Automated Mocked HTTP Contract Testing (Zero Live Cluster Dependency)  
**Status**: VERIFIED & DOCUMENTED

---

## 1. Executive Summary & Verification Context

Phase 7E.2 validates the client contract and operational protocol of EduPredict's WebHDFS Lakehouse integration against the Apache Hadoop 3.x WebHDFS v1 REST specification.

> [!IMPORTANT]
> **Statement on Live HDFS Runtime Availability**:
> The tests executed in Phase 7E.2 are **mocked HTTP contract tests**. They rigorously verify client protocol compliance, header composition, HTTP 307 redirect negotiation, timeout configuration, and exception sanitization against mocked NameNode and DataNode responses. **These contract tests do NOT establish that an active, live Apache Hadoop cluster is running locally.**
> As established in the [PHASE_7E_READINESS_AUDIT.md](file:///C:/Users/Azan's%20PC/Documents/EduPredict/documentation/PHASE_7E_READINESS_AUDIT.md), running live Hadoop JVM daemons (NameNode, DataNode, YARN) on this host machine (~7.93 GB RAM with ~1.27 GB free) would risk severe RAM exhaustion.

---

## 2. Existing WebHDFS Architecture & Supported Primitives

Inspection of `backend/data_engineering/hdfs_lakehouse.py` identified the existing `HDFSLakehouseManager` class, implementing the standard WebHDFS v1 REST API using Python's standard `urllib.request`.

### Discovered Supported Operations:
1. **Connectivity Probe (`probe_connection`)**:
   - Issues `GET /?op=LISTSTATUS&user.name={hdfs_user}` to the NameNode.
   - Enforces User-Agent header: `EduPredict-HDFS-Client/1.0`.
   - Timeout: **3.0 seconds**.
   - Handles network disconnection, timeouts, and HTTP errors gracefully without crashing the host application.
2. **Directory Topology Provisioning (`ensure_lakehouse_directories`)**:
   - First probes connectivity; if offline, bails out with diagnostic report.
   - Issues `PUT {directory}?op=MKDIRS&user.name={hdfs_user}&permission=755` for all 5 standard Lakehouse tiers:
     - `/edupredict/raw/academic` (Bronze Layer - CSV raw data)
     - `/edupredict/processed/academic` (Silver Layer - cleaned dataset)
     - `/edupredict/analytics/subject_performance` (Gold Layer - subject Parquet partitions)
     - `/edupredict/analytics/attendance` (Gold Layer - attendance metrics)
     - `/edupredict/analytics/student_progress` (Gold Layer - longitudinal trajectory)
   - Timeout: **5.0 seconds** per directory.
3. **Two-Step File Creation Protocol (`upload_file`)**:
   - Complies strictly with the Apache Hadoop WebHDFS file creation protocol:
     - **Step 1 (NameNode Negotiation)**: `PUT {path}?op=CREATE&user.name={hdfs_user}&overwrite={true|false}` (5.0s timeout). Receives an HTTP 307 Temporary Redirect with the target DataNode `Location` header.
     - **Step 2 (DataNode Streaming)**: `PUT {datanode_location}` with payload bytes, headers `{"Content-Type": "application/octet-stream"}` (30.0s timeout).
   - Verifies MD5 checksum and payload size upon completion.
4. **Architectural Blueprint (`get_architectural_blueprint`)**:
   - Exposes static metadata describing each tier's purpose, format, and retention policy.

---

## 3. Mocked Testing Approach

To prevent any dependency on heavy external JVM services or container runtimes, `tests/test_webhdfs_contract.py` implements a context-managed `MockHTTPResponse` and leverages `unittest.mock.patch` against `urllib.request.urlopen`.

### Contract Scenarios Verified:
- **Successful Connection**: Validates HTTP 200 parsing, JSON response structure, query parameters, User-Agent header, and 3.0s timeout enforcement.
- **Connection Refusal & Offline Bailing**: Simulates `ConnectionRefusedError` and `socket.timeout`, ensuring the client returns structured diagnostic error reports rather than crashing.
- **HTTP Error Codes**: Simulates HTTP 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), and 500 (Internal Server Error), verifying clean error reporting.
- **Malformed Responses**: Simulates non-JSON responses (e.g. HTML proxy errors), ensuring `json.JSONDecodeError` is caught and converted to diagnostic strings.
- **Directory Creation Topology**: Verifies that all 5 required directories are created with `op=MKDIRS` and `permission=755` over PUT requests.
- **Two-Step Upload & HTTP 307 Redirect**: Verifies that the NameNode's `Location` header in Step 1 is strictly extracted and used for Step 2 payload delivery.
- **Upload Failures**: Verifies failure handling if NameNode rejects Step 1 (e.g. 403), DataNode rejects Step 2 (e.g. 500 disk full), or DataNode stream times out.
- **Credential Protection**: Confirms that sensitive credentials or secret keys are not leaked in exception diagnostics.

---

## 4. Test Execution & Verification

### Focused WebHDFS Contract Tests Command:
```powershell
.\.venv\Scripts\pytest.exe tests/test_webhdfs_contract.py -v
```

### Full Backend Regression Suite Command:
```powershell
.\.venv\Scripts\pytest.exe tests/ -v
```

---

## 5. Architectural Boundaries & Limitations

1. **Mocked Contract vs Live Execution**: These tests confirm protocol adherence and fault tolerance, but do not interact with active HDFS storage nodes.
2. **Authentication Scope**: The existing client supports simple pseudo-distributed authentication (`user.name=...`). Enterprise Kerberos / SPNEGO authentication is not implemented in `hdfs_lakehouse.py`.
3. **Retry Logic**: As discovered during inspection, the client does not implement automatic retry loops; failed HTTP requests fail immediately and return diagnostic dictionaries. In accordance with Phase 7E.2 instructions, no artificial retry loops were introduced.
