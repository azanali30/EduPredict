-- ============================================================================
-- EduPredict - Apache Impala Lakehouse DDL Specification
-- Maps external tables over HDFS data lake directories (/edupredict/...)
-- Compatible with Apache Impala 3.x / 4.x & Cloudera CDH / CDP
-- ============================================================================

CREATE DATABASE IF NOT EXISTS edupredict_lakehouse
COMMENT 'EduPredict Educational Performance Analytical Lakehouse'
LOCATION '/edupredict/analytics';

USE edupredict_lakehouse;

-- ----------------------------------------------------------------------------
-- Table 1: Raw Staging Table (CSV External Table over Bronze Layer)
-- ----------------------------------------------------------------------------
CREATE EXTERNAL TABLE IF NOT EXISTS raw_student_academic_staging (
    student_code                STRING,
    subject                     STRING,
    academic_year               STRING,
    term                        STRING,
    school                      STRING,
    sex                         STRING,
    age                         INT,
    address                     STRING,
    famsize                     STRING,
    Pstatus                     STRING,
    Medu                        INT,
    Fedu                        INT,
    study_hours_per_week        DOUBLE,
    failures                    INT,
    schoolsup                   STRING,
    famsup                      STRING,
    paid                        STRING,
    activities                  STRING,
    higher                      STRING,
    internet                    STRING,
    romantic                    STRING,
    famrel                      INT,
    freetime                    INT,
    goout                       INT,
    health                      INT,
    absences                    INT,
    attendance_percentage       DOUBLE,
    assignment_completion_rate  DOUBLE,
    previous_exam_marks         DOUBLE,
    quiz_scores                 DOUBLE,
    final_exam_marks            DOUBLE,
    academic_status             STRING
)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION '/edupredict/processed/academic'
TBLPROPERTIES ('skip.header.line.count'='1');

-- ----------------------------------------------------------------------------
-- Table 2: Production Analytical Parquet Table (Silver/Gold Optimized Table)
-- Partitioned by subject and academic_year with Snappy compression
-- ----------------------------------------------------------------------------
CREATE EXTERNAL TABLE IF NOT EXISTS student_academic_records (
    student_code                STRING,
    term                        STRING,
    school                      STRING,
    sex                         STRING,
    age                         INT,
    address                     STRING,
    famsize                     STRING,
    p_status                    STRING,
    mother_education            INT,
    father_education            INT,
    study_hours_per_week        DOUBLE,
    failures                    INT,
    school_support              STRING,
    family_support              STRING,
    extra_paid_classes          STRING,
    activities                  STRING,
    higher_education            STRING,
    internet                    STRING,
    romantic                    STRING,
    family_relationship         INT,
    free_time                   INT,
    go_out                      INT,
    health                      INT,
    absences                    INT,
    attendance_percentage       DOUBLE,
    assignment_completion_rate  DOUBLE,
    previous_exam_marks         DOUBLE,
    quiz_scores                 DOUBLE,
    final_exam_marks            DOUBLE,
    academic_status             STRING
)
PARTITIONED BY (
    subject                     STRING,
    academic_year               STRING
)
STORED AS PARQUET
LOCATION '/edupredict/analytics/subject_performance'
TBLPROPERTIES ('parquet.compression'='SNAPPY');
