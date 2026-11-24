# EduPredict — Remote Apache HDFS & Apache Impala Deployment Guide (Phase 7E.4)

**Specification Baseline**: Aptech eProject Big Data / EduPredict SRS  
**Target Environment**: Remote Dedicated 64-bit Linux Server or VM (Ubuntu 22.04 LTS / RHEL 8 / AlmaLinux 9)  
**Hardware Profile**: Dedicated 16+ GB RAM, 4+ Cores, 100+ GB Storage  
**Local Development Status**: Decoupled (Zero local JVM daemons on 8 GB Windows workstation)  
**Remote Deployment Status**: SPECIFICATION & DEPLOYMENT RUNBOOK (Not executed on this machine)  

---

## 1. Executive Summary & Hardware Context

The Aptech eProject Big Data specification outlines Apache Hadoop (HDFS) as the distributed Lakehouse storage tier and Apache Impala as the massively parallel processing (MPP) analytical SQL engine.

On this development computer (Windows 10 Pro, 8 GB total RAM, Intel Core i5), running live Hadoop JVM daemons (NameNode, DataNode, YARN) alongside Apache Impala daemons (`impalad`, `statestored`, `catalogd`), MongoDB 6.x, Flask, Vite, and Python would exhaust physical memory and swap aggressively.

Accordingly, EduPredict implements a decoupled architectural model:
- **Local Development**: Ingests, trains ML pipelines, serves REST APIs, exports bounded Parquet datasets, and validates SQL via in-memory SQLite emulation.
- **Production / Analytical Lakehouse**: Runs on a separate, dedicated remote Linux host or container cluster.

This deployment guide provides a step-by-step, reproducible deployment procedure to install, configure, verify, and operate Apache Hadoop/HDFS and Apache Impala on an external Linux server.

> [!CAUTION]
> **Statement on Remote Deployment Execution**:
> This runbook is a verified deployment specification. **The remote deployment has NOT been executed on this local development host.** No live remote cluster results or fictitious server connectivity are claimed.

---

## 2. Recommended Remote Linux Environment

### Minimum Hardware Sizing
- **Operating System**: Ubuntu 22.04 LTS (x86_64) or Rocky Linux 9 / RHEL 8.
- **CPU**: 4 vCPUs minimum (8 vCPUs recommended for multi-node Impala).
- **RAM**:
  - HDFS alone (NameNode + DataNode): 8 GB RAM.
  - HDFS + Apache Impala (`impalad` + `catalogd` + `statestored`): 16–32 GB RAM.
- **Disk Storage**: 100+ GB SSD (Ext4 or XFS with `noatime`).
- **Network**: Dedicated 1 Gbps or 10 Gbps LAN interface.

---

## 3. Java and Hadoop Prerequisites

Hadoop 3.3+ and Impala require OpenJDK 8 or 11.

```bash
# 1. Update package manager and install dependencies
sudo apt-get update && sudo apt-get install -y \
    openjdk-8-jdk-headless \
    curl wget net-tools rsync ssh libsnappy-dev \
    build-essential libsasl2-dev libsasl2-modules

# 2. Configure JAVA_HOME globally
echo "export JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64" | sudo tee -a /etc/profile.d/java.sh
source /etc/profile.d/java.sh
java -version

# 3. Create dedicated hadoop service user
sudo useradd -m -s /bin/bash hadoop
sudo usermod -aG sudo hadoop
```

---

## 4. HDFS NameNode and DataNode Configuration

Download and unpack Apache Hadoop 3.3.6:

```bash
# Download binary tarball
cd /opt
sudo wget https://archive.apache.org/dist/hadoop/common/hadoop-3.3.6/hadoop-3.3.6.tar.gz
sudo tar -xzf hadoop-3.3.6.tar.gz
sudo ln -s hadoop-3.3.6 hadoop
sudo chown -R hadoop:hadoop /opt/hadoop*

# Configure Hadoop environment variables for user 'hadoop'
cat << 'EOF' >> /home/hadoop/.bashrc
export HADOOP_HOME=/opt/hadoop
export HADOOP_INSTALL=$HADOOP_HOME
export HADOOP_MAPRED_HOME=$HADOOP_HOME
export HADOOP_COMMON_HOME=$HADOOP_HOME
export HADOOP_HDFS_HOME=$HADOOP_HOME
export YARN_HOME=$HADOOP_HOME
export HADOOP_COMMON_LIB_NATIVE_DIR=$HADOOP_HOME/lib/native
export PATH=$PATH:$HADOOP_HOME/sbin:$HADOOP_HOME/bin
export HADOOP_OPTS="-Djava.library.path=$HADOOP_HOME/lib/native"
EOF
```

### Configuration Files

#### 1. `/opt/hadoop/etc/hadoop/core-site.xml`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="configuration.xsl"?>
<configuration>
    <!-- Default HDFS filesystem URI: Must specify explicit NameNode hostname or IP -->
    <!-- DO NOT use 0.0.0.0 here: 0.0.0.0 is an invalid client destination URI -->
    <property>
        <name>fs.defaultFS</name>
        <value>hdfs://<NAMENODE_HOSTNAME_OR_IP>:9000</value>
    </property>
    <!-- Enable WebHDFS REST API -->
    <property>
        <name>dfs.webhdfs.enabled</name>
        <value>true</value>
    </property>
    <!-- Restrictive Proxy User Configuration for EduPredict Integration -->
    <!-- NOTE: Wildcards (*) must NEVER be used in real deployments. -->
    <!-- Authorize strictly the specific EduPredict backend host IP and required service group. -->
    <property>
        <name>hadoop.proxyuser.edupredict.hosts</name>
        <value><EDUPREDICT_BACKEND_HOST_IP></value>
    </property>
    <property>
        <name>hadoop.proxyuser.edupredict.groups</name>
        <value><AUTHORIZED_SERVICE_GROUP></value>
    </property>
</configuration>
```
> [!IMPORTANT]
> **Network Address Discipline**:
> The `0.0.0.0` wildcard address is valid **only as a daemon bind/listening interface** on the local server. It must **never** be used in `fs.defaultFS` or client connection URLs, as clients cannot connect to `0.0.0.0` over the network. Always configure an explicit resolvable FQDN or static IP.

#### 2. `/opt/hadoop/etc/hadoop/hdfs-site.xml`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="configuration.xsl"?>
<configuration>
    <!-- Replication factor for target deployment cluster -->
    <property>
        <name>dfs.replication</name>
        <value>2</value>
    </property>
    <!-- Persistent Storage directories -->
    <property>
        <name>dfs.namenode.name.dir</name>
        <value>file:///var/data/hadoop/hdfs/namenode</value>
    </property>
    <property>
        <name>dfs.datanode.data.dir</name>
        <value>file:///var/data/hadoop/hdfs/datanode</value>
    </property>
    <!-- WebHDFS HTTP Daemon Listen Bindings (0.0.0.0 binds daemon to all local interfaces) -->
    <property>
        <name>dfs.namenode.http-address</name>
        <value>0.0.0.0:9870</value>
    </property>
    <property>
        <name>dfs.datanode.http.address</name>
        <value>0.0.0.0:9864</value>
    </property>
    <!-- Standard POSIX Permission Checks: MUST remain enabled in production -->
    <property>
        <name>dfs.permissions.enabled</name>
        <value>true</value>
    </property>
</configuration>
```
> [!WARNING]
> **Production Permission Enforcement**:
> Setting `dfs.permissions.enabled` to `false` disables all access controls and is **strictly for isolated, non-networked local proof-of-concept sandboxes**. In any networked, staging, or production deployment, `dfs.permissions.enabled` must be `true` with appropriate POSIX ownership and group permissions enforced.

#### Format and Start HDFS:
> [!CAUTION]
> **Destructive Operation Warning**:
> Running `hdfs namenode -format` creates a fresh NameNode filesystem namespace and **permanently destroys all existing filesystem metadata and block pointers**. Run this command **ONLY ONCE** during initial cluster installation. Never format a NameNode on an active cluster without verified, tested off-site backups.

```bash
sudo mkdir -p /var/data/hadoop/hdfs/namenode /var/data/hadoop/hdfs/datanode
sudo chown -R hadoop:hadoop /var/data/hadoop

# Format the NameNode (Execute ONCE only during initial setup!)
su - hadoop -c "hdfs namenode -format"

# Start NameNode and DataNode daemons
su - hadoop -c "start-dfs.sh"

# Verify daemons are running via jps
su - hadoop -c "jps"
# Output should list: NameNode, DataNode, SecondaryNameNode
```

---

## 5. WebHDFS Activation and Connectivity Verification

WebHDFS operates over HTTP on port `9870` (NameNode) and port `9864` (DataNode).

```bash
# Verify NameNode REST API status
curl -i "http://localhost:9870/webhdfs/v1/?op=LISTSTATUS"

# Output should return HTTP/1.1 200 OK with FileStatuses JSON payload:
# {"FileStatuses":{"FileStatus":[]}}
```

---

## 6. HDFS Directory Topology for EduPredict

Provision the 5 standard EduPredict Lakehouse directories:

```bash
su - hadoop -c "hdfs dfs -mkdir -p /edupredict/raw/academic"
su - hadoop -c "hdfs dfs -mkdir -p /edupredict/processed/academic"
su - hadoop -c "hdfs dfs -mkdir -p /edupredict/analytics/subject_performance"
su - hadoop -c "hdfs dfs -mkdir -p /edupredict/analytics/attendance"
su - hadoop -c "hdfs dfs -mkdir -p /edupredict/analytics/student_progress"

# Set permissions for the lakehouse directory tree
su - hadoop -c "hdfs dfs -chmod -R 755 /edupredict"
```

---

## 7. Uploading Parquet Exports into HDFS

EduPredict exports MongoDB academic observations into partitioned Apache Parquet datasets via `backend/data_engineering/parquet_exporter.py`.

### Method A: Direct Remote Copy via WebHDFS REST API
From the EduPredict host:
```python
from backend.data_engineering.hdfs_lakehouse import HDFSLakehouseManager

manager = HDFSLakehouseManager(
    namenode_url="http://<remote-linux-host>:9870/webhdfs/v1",
    hdfs_user="edupredict"
)
manager.upload_file(
    local_path="data/lakehouse/parquet_export/subject=Mathematics/academic_year=2023-2024/part-0.parquet",
    hdfs_path="/edupredict/analytics/subject_performance/subject=Mathematics/academic_year=2023-2024/part-0.parquet"
)
```

### Method B: Native HDFS CLI Bulk Ingestion
```bash
# Copy entire partitioned Parquet export directory from server staging
su - hadoop -c "hdfs dfs -put -f /tmp/parquet_export/* /edupredict/analytics/subject_performance/"

# Verify partition structure in HDFS
su - hadoop -c "hdfs dfs -ls -R /edupredict/analytics/subject_performance"
```

---

## 8. Apache Impala Prerequisites and Installation

Apache Impala uses the Hive Metastore to discover Parquet schemas and partition directories on HDFS.

### Option 1: Apache Impala via Native Packages (Cloudera CDP / Apache Bigtop)
```bash
# Install Hive Metastore and PostgreSQL backend
sudo apt-get install -y postgresql postgresql-contrib
# Install Apache Impala packages
sudo apt-get install -y impala impala-server impala-state-store impala-catalog impala-shell
```

### Option 2: Dockerized Production-Grade Impala Cluster (Recommended for VM)
EduPredict provides a ready-to-use Compose blueprint:

```yaml
version: "3.8"
services:
  impala-statestore:
    image: apache/impala:4.2.0-statestored
    container_name: edupredict-impala-statestore
    restart: always

  impala-catalog:
    image: apache/impala:4.2.0-catalogd
    container_name: edupredict-impala-catalog
    environment:
      - HDFS_NAMENODE_URL=hdfs://namenode:9000
    restart: always

  impalad:
    image: apache/impala:4.2.0-impalad
    container_name: edupredict-impalad
    ports:
      - "21050:21050"  # HiveServer2 Thrift Port
      - "25000:25000"  # Impala Web UI
    restart: always
```

---

## 9. Impala Catalog & Query Execution

Once `impalad` is listening on port `21050`:

```bash
# 1. Connect via Impala Shell
impala-shell -i localhost:21050

# 2. Execute DDL script to create external Lakehouse tables
impala-shell -i localhost:21050 -f analytics/impala/01_create_academic_lakehouse_tables.sql

# 3. Synchronize partitioned Parquet files from HDFS
impala-shell -i localhost:21050 -q "ALTER TABLE edupredict_lakehouse.student_academic_records RECOVER PARTITIONS;"

# 4. Compute partition statistics for high-performance cost-based query optimization
impala-shell -i localhost:21050 -q "COMPUTE STATS edupredict_lakehouse.student_academic_records;"

# 5. Execute production analytical queries
impala-shell -i localhost:21050 -d edupredict_lakehouse -f analytics/impala/02_analytical_queries.sql
```

---

## 10. Connecting EduPredict to Remote WebHDFS & Impala

Configure EduPredict's `.env` on the backend application server:

```ini
# ==============================================================================
# EduPredict Remote Big Data Lakehouse Configuration
# ==============================================================================
HDFS_ENABLED=true
HDFS_NAMENODE_URL=http://<REMOTE_LINUX_IP>:9870/webhdfs/v1
HDFS_USER=edupredict

IMPALA_ENABLED=true
IMPALA_HOST=<REMOTE_LINUX_IP>
IMPALA_PORT=21050
```

Verify connectivity from the EduPredict backend using the diagnostic runners:
```powershell
# Probe remote WebHDFS
.\.venv\Scripts\python.exe -m backend.data_engineering.hdfs_lakehouse

# Probe remote Impala daemon
.\.venv\Scripts\python.exe -m analytics.impala.impala_query_runner
```

---

## 11. Network Ports and Firewall Requirements

Ensure the remote Linux firewall strictly isolates Hadoop and Impala internal communication while granting access only to authorized endpoints:

| Service | Port | Protocol | Purpose | Access Scope & Firewall Policy |
|:---|:---:|:---:|:---|:---|
| **HDFS NameNode RPC** | `9000` | TCP | Inter-daemon NameNode/DataNode metadata communication | **STRICTLY INTERNAL LAN / CLUSTER ONLY** — Never expose to public networks. |
| **HDFS NameNode WebHDFS** | `9870` | TCP / HTTP | REST API for status probes, MKDIRS, upload negotiation | Whitelist strictly to EduPredict Backend Host IP. |
| **HDFS DataNode Streaming** | `9864` | TCP / HTTP | REST API payload streaming (HTTP 307 redirect destination) | Whitelist strictly to EduPredict Backend Host IP. |
| **Impala HiveServer2** | `21050` | TCP / Thrift | SQL query client dispatch (`impala-shell`, Python DB-API) | Whitelist strictly to EduPredict Backend Host IP. |
| **Impala Web UI** | `25000` | TCP / HTTP | Cluster query profiling and metrics monitoring | Internal VPN / Authorized Admin IPs only. |
| **Internal Daemons** | `9866, 9867, 22000, 23000` | TCP | DataNode block transfer, Impala statestore/catalogd | **STRICTLY CLUSTER INTERNAL** — Block all external access. |

```bash
# Example UFW firewall rules on remote Linux host:
# 1. Block all incoming by default
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 2. Allow SSH administration
sudo ufw allow 22/tcp

# 3. Allow EduPredict backend application server ONLY for authorized ports
sudo ufw allow from <EDUPREDICT_BACKEND_SERVER_IP> to any port 9870 proto tcp comment "WebHDFS NameNode REST"
sudo ufw allow from <EDUPREDICT_BACKEND_SERVER_IP> to any port 9864 proto tcp comment "WebHDFS DataNode Stream"
sudo ufw allow from <EDUPREDICT_BACKEND_SERVER_IP> to any port 21050 proto tcp comment "Impala HiveServer2"

# 4. Allow cluster internal communication on private subnet (e.g. 10.0.0.0/24)
sudo ufw allow from 10.0.0.0/24 to any port 9000 proto tcp comment "HDFS RPC Internal"
sudo ufw allow from 10.0.0.0/24 to any port 9866 proto tcp comment "DataNode Transfer"

sudo ufw enable
sudo ufw status verbose
```

---

## 12. Authentication and Security Hardening

1. **Pseudo-Distributed Authentication (Testing Only)**:
   - In isolated staging environments, WebHDFS uses simple identity forwarding (`user.name=edupredict`).
   - The EduPredict client automatically strips all credentials and username occurrences from error diagnostics and application logs.
2. **Production Kerberos / SPNEGO (Enterprise Requirement)**:
   - For production enterprise deployments, configure MIT Kerberos or Active Directory.
   - Set `hadoop.security.authentication=kerberos` in `core-site.xml`.
   - Update WebHDFS requests to use SPNEGO HTTP Negotiate headers via Python `requests-kerberos`.
3. **Data-at-Rest Encryption**:
   - Enable HDFS Transparent Data Encryption (TDE) for `/edupredict/analytics` using Hadoop KMS.

---

## 13. Service Lifecycle & Recovery Procedures

### Graceful Startup:
```bash
# 1. Start Hadoop HDFS daemons
su - hadoop -c "start-dfs.sh"

# 2. Start Hive Metastore
sudo systemctl start hive-metastore

# 3. Start Impala daemons
sudo systemctl start impala-state-store
sudo systemctl start impala-catalog
sudo systemctl start impala-server
```

### Graceful Shutdown:
```bash
# 1. Stop Impala daemons
sudo systemctl stop impala-server
sudo systemctl stop impala-catalog
sudo systemctl stop impala-state-store

# 2. Stop HDFS daemons
su - hadoop -c "stop-dfs.sh"
```

### Disaster Recovery & HDFS Fsck:
> [!CAUTION]
> **Data Deletion Warning**:
> Running `hdfs dfs -rm -r` permanently and recursively removes files and directories from HDFS. Always ensure full MongoDB and Parquet backups exist before removing analytical directories. Confirm target paths carefully before executing deletion commands.

```bash
# Check filesystem health and identify missing or corrupt blocks
su - hadoop -c "hdfs fsck /edupredict -files -blocks -locations"

# If corrupt blocks are confirmed, repair or re-export from MongoDB:
su - hadoop -c "hdfs dfs -rm -r /edupredict/analytics/subject_performance/*"
# Re-trigger EduPredict Parquet exporter from backend
```

---

## 14. Explicit Runtime Verification Boundaries

To maintain rigorous engineering honesty, EduPredict enforces clear distinctions between local testing and remote infrastructure:
1. **Local SQL Validation Harness vs. Apache Impala**:
   - Local validation via `sql_validator.py` executes queries against an in-memory SQLite database.
   - Python aggregate classes (`SQLAppxMedianAggregate`, `SQLStdDevAggregate`, `SQLVarianceAggregate`) emulate Impala functions for logical schema and syntax validation.
   - This proves relational query compatibility; it does **not** constitute execution on a live distributed Apache Impala MPP cluster.
2. **WebHDFS Contract Tests vs. Live Hadoop Cluster**:
   - The 24 passing WebHDFS tests in `tests/test_webhdfs_contract.py` are **mocked HTTP contract tests**.
   - They verify HTTP 307 redirect negotiation, timeout enforcement, error code handling, and credential sanitization against simulated NameNode and DataNode responses.
   - They do **not** claim or establish that a live Hadoop cluster is running locally.
3. **Remote Deployment Status**:
   - This guide is a complete, reproducible **deployment specification and runbook**.
   - Remote deployment has **not** been executed on the local 8 GB RAM development machine and remains pending until a dedicated remote Linux cluster is provisioned.

---

## 15. Deployment Verification Checklist

- [ ] Linux host meets hardware specs (min 16 GB RAM, 4 vCPUs).
- [ ] OpenJDK 8 or 11 installed; `JAVA_HOME` configured.
- [ ] Hadoop 3.3.x extracted; `core-site.xml` configured with explicit NameNode hostname and restricted proxy users.
- [ ] `hdfs-site.xml` configured with `dfs.permissions.enabled=true`.
- [ ] NameNode formatted (initial setup only); `jps` confirms `NameNode` + `DataNode` are running.
- [ ] WebHDFS curl probe (`http://localhost:9870/webhdfs/v1/?op=LISTSTATUS`) returns HTTP 200.
- [ ] Lakehouse directory topology (`/edupredict/raw`, `/processed`, `/analytics/...`) created.
- [ ] Impala daemon active and listening on port `21050`.
- [ ] External table DDL executed (`01_create_academic_lakehouse_tables.sql`).
- [ ] Parquet files ingested and partitions recovered (`RECOVER PARTITIONS`).
- [ ] Analytical SQL queries executed successfully (`02_analytical_queries.sql`).
- [ ] UFW firewall restricts cluster RPC ports (9000) to internal network and whitelists backend server IP for WebHDFS and Impala.
- [ ] EduPredict `.env` updated with remote endpoints.
- [ ] Diagnostic scripts (`hdfs_lakehouse.py`, `impala_query_runner.py`) confirm successful connection.
