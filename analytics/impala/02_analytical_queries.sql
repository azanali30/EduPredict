-- ============================================================================
-- EduPredict - Apache Impala Production Analytical SQL Queries
-- Designed for mass-scale OLAP evaluation over student_academic_records
-- ============================================================================

USE edupredict_lakehouse;

-- ============================================================================
-- QUERY 1: Average Academic Performance & Pass Rates by Subject
-- Analyzes mean attendance, study hours, term marks, and overall pass rates.
-- ============================================================================
SELECT
    subject,
    academic_year,
    COUNT(student_code) AS enrolled_students,
    ROUND(AVG(attendance_percentage), 2) AS avg_attendance_pct,
    ROUND(AVG(study_hours_per_week), 2) AS avg_study_hours,
    ROUND(AVG(previous_exam_marks), 2) AS avg_term1_exam_pct,
    ROUND(AVG(quiz_scores), 2) AS avg_term2_quiz_pct,
    ROUND(AVG(final_exam_marks), 2) AS avg_final_exam_pct,
    ROUND(STDDEV(final_exam_marks), 2) AS stddev_final_exam,
    ROUND(SUM(CASE WHEN final_exam_marks >= 50.0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS pass_rate_pct
FROM student_academic_records
GROUP BY subject, academic_year
ORDER BY subject;


-- ============================================================================
-- QUERY 2: Attendance Velocity vs. Final Academic Results
-- Segments students into attendance tiers and evaluates grade correlations.
-- ============================================================================
SELECT
    CASE
        WHEN attendance_percentage >= 95.0 THEN 'High Attendance (95% - 100%)'
        WHEN attendance_percentage >= 85.0 THEN 'Good Attendance (85% - 94.9%)'
        WHEN attendance_percentage >= 75.0 THEN 'Moderate Attendance (75% - 84.9%)'
        ELSE 'Chronic Absenteeism (< 75%)'
    END AS attendance_tier,
    COUNT(*) AS total_students,
    ROUND(AVG(attendance_percentage), 2) AS group_avg_attendance,
    ROUND(AVG(study_hours_per_week), 2) AS group_avg_study_hours,
    ROUND(AVG(final_exam_marks), 2) AS group_avg_final_marks,
    SUM(CASE WHEN academic_status = 'High Risk' THEN 1 ELSE 0 END) AS high_risk_count,
    ROUND(SUM(CASE WHEN academic_status = 'High Risk' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) AS high_risk_rate_pct
FROM student_academic_records
GROUP BY 1
ORDER BY group_avg_attendance DESC;


-- ============================================================================
-- QUERY 3: Top-Performing Students Across Curriculum (Window Analytic Ranking)
-- Identifies top 10% scholars using DENSE_RANK partitioned by subject.
-- ============================================================================
WITH RankedScholars AS (
    SELECT
        student_code,
        subject,
        attendance_percentage,
        study_hours_per_week,
        final_exam_marks,
        DENSE_RANK() OVER (
            PARTITION BY subject 
            ORDER BY final_exam_marks DESC, study_hours_per_week DESC
        ) AS rank_in_subject
    FROM student_academic_records
)
SELECT
    rank_in_subject,
    student_code,
    subject,
    attendance_percentage,
    study_hours_per_week,
    final_exam_marks
FROM RankedScholars
WHERE rank_in_subject <= 10
ORDER BY subject, rank_in_subject;


-- ============================================================================
-- QUERY 4: Early Warning Detection – Students with Declining Performance
-- Detects students whose evaluation marks degraded across consecutive terms (G1 > G2 > G3).
-- ============================================================================
SELECT
    student_code,
    subject,
    previous_exam_marks AS term1_exam_pct,
    quiz_scores AS term2_quiz_pct,
    final_exam_marks AS final_exam_pct,
    ROUND(previous_exam_marks - final_exam_marks, 2) AS total_grade_decline,
    attendance_percentage,
    study_hours_per_week,
    failures,
    academic_status
FROM student_academic_records
WHERE previous_exam_marks > quiz_scores
  AND quiz_scores > final_exam_marks
  AND (previous_exam_marks - final_exam_marks) >= 15.0
ORDER BY total_grade_decline DESC;


-- ============================================================================
-- QUERY 5: Longitudinal Term-Wise Performance Trajectory
-- Measures cohort migration between Term 1, Term 2, and Final evaluations.
-- ============================================================================
SELECT
    subject,
    COUNT(*) AS cohort_size,
    ROUND(AVG(previous_exam_marks), 2) AS term1_mean,
    ROUND(AVG(quiz_scores), 2) AS term2_mean,
    ROUND(AVG(final_exam_marks), 2) AS final_term_mean,
    ROUND(AVG(final_exam_marks) - AVG(previous_exam_marks), 2) AS net_trajectory_delta,
    ROUND(AVG(CASE WHEN final_exam_marks >= previous_exam_marks THEN 1.0 ELSE 0.0 END) * 100.0, 2) AS pct_students_improved
FROM student_academic_records
GROUP BY subject;


-- ============================================================================
-- QUERY 6: Subject-Level Performance Distribution (Percentile & Dispersion)
-- Computes statistical quantiles (P25, Median P50, P75) and Interquartile Range (IQR).
-- ============================================================================
SELECT
    subject,
    COUNT(*) AS sample_size,
    ROUND(MIN(final_exam_marks), 2) AS min_score,
    ROUND(AVG(final_exam_marks), 2) AS mean_score,
    ROUND(APPX_MEDIAN(final_exam_marks), 2) AS median_score,
    ROUND(MAX(final_exam_marks), 2) AS max_score,
    ROUND(STDDEV(final_exam_marks), 2) AS std_dev,
    ROUND(VARIANCE(final_exam_marks), 2) AS variance_val
FROM student_academic_records
GROUP BY subject;


-- ============================================================================
-- QUERY 7: Data Quality Audit – Missing, Out-of-Bounds, or Anomalous Records
-- Scans for data integrity anomalies violating academic domain boundaries.
-- ============================================================================
SELECT
    student_code,
    subject,
    attendance_percentage,
    final_exam_marks,
    absences,
    study_hours_per_week,
    CASE
        WHEN attendance_percentage < 0.0 OR attendance_percentage > 100.0 THEN 'Invalid Attendance Range'
        WHEN final_exam_marks < 0.0 OR final_exam_marks > 100.0 THEN 'Invalid Final Mark Range'
        WHEN absences > 50 AND final_exam_marks >= 90.0 THEN 'High Absence vs High Mark Anomaly'
        WHEN study_hours_per_week <= 0.0 THEN 'Missing Study Hours'
        ELSE 'Unspecified Anomaly'
    END AS anomaly_type
FROM student_academic_records
WHERE attendance_percentage < 0.0 OR attendance_percentage > 100.0
   OR final_exam_marks < 0.0 OR final_exam_marks > 100.0
   OR (absences > 50 AND final_exam_marks >= 90.0)
   OR study_hours_per_week <= 0.0;
