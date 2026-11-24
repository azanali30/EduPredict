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
    <!-- Default HDFS filesystem URI -->
    <property>
        <name>fs.defaultFS</name>
        <value>hdfs://0.0.0.0:9000</value>
    </property>
    <!-- Enable WebHDFS REST API -->
    <property>
        <name>dfs.webhdfs.enabled</name>
        <value>true</value>
    </property>
    <!-- Proxy user permissions for EduPredict integration -->
    <property>
        <name>hadoop.proxyuser.edupredict.hosts</name>
        <value>*</value>
    </property>
    <property>
        <name>hadoop.proxyuser.edupredict.groups</name>
        <value>*</value>
    </property>
</configuration>
```

#### 2. `/opt/hadoop/etc/hadoop/hdfs-site.xml`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="configuration.xsl"?>
<configuration>
    <!-- Single node replication factor for dev/staging cluster -->
    <property>
        <name>dfs.replication</name>
        <value>1</value>
    </property>
    <!-- Storage directories -->
    <property>
        <name>dfs.namenode.name.dir</name>
        <value>file:///var/data/hadoop/hdfs/namenode</value>
    </property>
    <property>
        <name>dfs.datanode.data.dir</name>
        <value>file:///var/data/hadoop/hdfs/datanode</value>
    </property>
    <!-- WebHDFS HTTP Ports -->
    <property>
        <name>dfs.namenode.http-address</name>
        <value>0.0.0.0:9870</value>
    </property>
    <property>
        <name>dfs.datanode.http.address</name>
        <value>0.0.0.0:9864</value>
    </property>
    <!-- Disable pseudo-distributed permissions check for initial testing -->
    <property>
        <name>dfs.permissions.enabled</name>
        <value>false</value>
    </property>
</configuration>
```

#### Format and Start HDFS:
```bash
sudo mkdir -p /var/data/hadoop/hdfs/namenode /var/data/hadoop/hdfs/datanode
sudo chown -R hadoop:hadoop /var/data/hadoop

# Format the NameNode (Execute once only!)
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

Ensure the remote Linux firewall allows traffic on the required operational ports:

| Service | Port | Protocol | Purpose | Access Scope |
|:---|:---:|:---:|:---|:---|
| **HDFS NameNode RPC** | `9000` | TCP | Inter-daemon NameNode/DataNode communication | Cluster Internal |
| **HDFS NameNode WebHDFS** | `9870` | TCP / HTTP | REST API for status probes, MKDIRS, upload negotiation | EduPredict Backend |
| **HDFS DataNode Streaming** | `9864` | TCP / HTTP | REST API payload streaming (HTTP 307 redirect destination) | EduPredict Backend |
| **Impala HiveServer2** | `21050` | TCP / Thrift | SQL query client dispatch (`impala-shell`, Python DB-API) | EduPredict Backend |
| **Impala Web UI** | `25000` | TCP / HTTP | Cluster query profiling and metrics monitoring | Administrators |

```bash
# Linux UFW firewall rules for EduPredict server IP
sudo ufw allow from <EDUPREDICT_SERVER_IP> to any port 9870 proto tcp
sudo ufw allow from <EDUPREDICT_SERVER_IP> to any port 9864 proto tcp
sudo ufw allow from <EDUPREDICT_SERVER_IP> to any port 21050 proto tcp
sudo ufw reload
```

---

## 12. Authentication and Security Hardening

1. **Pseudo-Distributed Authentication**:
   - In development/testing, WebHDFS uses simple identity forwarding (`user.name=edupredict`).
   - The EduPredict client automatically strips all credentials and username occurrences from error diagnostics and application logs.
2. **Production Kerberos / SPNEGO (Enterprise)**:
   - For enterprise deployments, configure MIT Kerberos or Active Directory.
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
```bash
# Check filesystem health and identify missing or corrupt blocks
su - hadoop -c "hdfs fsck /edupredict -files -blocks -locations"

# If corrupt blocks are found, repair or re-export from MongoDB:
su - hadoop -c "hdfs dfs -rm -r /edupredict/analytics/subject_performance/*"
# Re-trigger EduPredict Parquet exporter
```

---

## 14. Deployment Verification Checklist

- [ ] Linux host meets hardware specs (min 16 GB RAM, 4 vCPUs).
- [ ] OpenJDK 8 or 11 installed; `JAVA_HOME` configured.
- [ ] Hadoop 3.3.x extracted and `core-site.xml` / `hdfs-site.xml` configured.
- [ ] NameNode formatted and `jps` confirms `NameNode` + `DataNode` are running.
- [ ] WebHDFS curl probe (`http://localhost:9870/webhdfs/v1/?op=LISTSTATUS`) returns HTTP 200.
- [ ] Lakehouse directory topology (`/edupredict/raw`, `/processed`, `/analytics/...`) created.
- [ ] Impala daemon active and listening on port `21050`.
- [ ] External table DDL executed (`01_create_academic_lakehouse_tables.sql`).
- [ ] Parquet files ingested and partitions recovered (`RECOVER PARTITIONS`).
- [ ] Analytical SQL queries executed successfully (`02_analytical_queries.sql`).
- [ ] Firewall rules permit backend server to reach ports `9870`, `9864`, and `21050`.
- [ ] EduPredict `.env` updated with remote endpoints.
- [ ] Diagnostic scripts (`hdfs_lakehouse.py`, `impala_query_runner.py`) confirm successful connection.
