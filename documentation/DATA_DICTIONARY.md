# EduPredict – Data Dictionary & Academic Feature Specification

## 1. Dataset Origin & Licensing

- **Dataset Title**: Student Performance Data Set
- **Authors**: Paulo Cortez and Alice Silva (University of Minho, Portugal)
- **Publication**: P. Cortez and A. Silva. *Using Data Mining to Predict Secondary School Student Performance*. In A. Brito and J. Teixeira Eds., Proceedings of 5th FUture BUsiness TEChnology Conference (FUBUTEC 2008) pp. 5-12, Porto, Portugal, April, 2008, EUROSIS, ISBN 978-9077381-39-7.
- **Source Repository**: [UCI Machine Learning Repository – Student Performance](https://archive.ics.uci.edu/dataset/320/student+performance)
- **License**: Creative Commons Attribution 4.0 International (CC BY 4.0)
- **Observation Domain**: Secondary school education reports collected from two Portuguese schools (*Gabriel Pereira* and *Mousinho da Silveira*) during the 2005–2006 school year, tracking two core curriculum subjects:
  - **Mathematics** (`student-mat.csv`): 395 student enrollments
  - **Portuguese Language** (`student-por.csv`): 649 student enrollments
  - **Total Coursework Records**: 1,044 observations

---

## 2. Dataset Identity & Limitations Audit

1. **Student Code & Dual-Enrollment**:
   - The original UCI dataset does not contain institutional student IDs.
   - For system pipeline consistency, deterministic identifiers are generated per subject dataset:
     - `STU-MAT-001` through `STU-MAT-395` (Mathematics)
     - `STU-POR-001` through `STU-POR-649` (Portuguese Language)
   - **Crucial Finding**: As documented in the original study and `student-merge.R`, **382 students** enrolled in *both* Mathematics and Portuguese.
   - In EduPredict, each record represents an independent **course enrollment**, not a unique physical student.
   - For Phase 5 machine learning: pooled cross-validation must use the 13 quasi-identifiers (`school`, `sex`, `age`, `address`, `famsize`, `Pstatus`, `Medu`, `Fedu`, `Mjob`, `Fjob`, `reason`, `nursery`, `internet`) as a group clustering key (`GroupShuffleSplit` / `GroupKFold`) or train separate subject-specific models to prevent student identity leakage between train and test splits.
2. **Attendance Indicator Limitation**:
   - The original UCI dataset records solely `absences` (count of missed class periods, range $0$–$93$). It does *not* record total scheduled classes or verified institutional percentage attendance.
   - `attendance_percentage` in EduPredict is an **Estimated Attendance Proxy** calculated assuming an academic baseline ceiling of 60 lectures per semester:
     $$\text{attendance\_percentage} = \max\left(0.0, \min\left(100.0, 100.0 - \left(\frac{\min(\text{absences}, 60)}{60} \times 100.0\right)\right)\right)$$
   - **Audited Rule**: This field must never be represented as actual verified institutional attendance; it is an estimated velocity proxy.
3. **Study Hours Indicator Limitation**:
   - `study_hours_per_week` represents an approximate **category midpoint estimate** derived from the original 4-tier survey response (`studytime`):
     - $1: < 2\text{ hours/week} \rightarrow 1.5$
     - $2: 2\text{ to } 5\text{ hours/week} \rightarrow 3.5$
     - $3: 5\text{ to } 10\text{ hours/week} \rightarrow 7.5$
     - $4: > 10\text{ hours/week} \rightarrow 12.0$
   - These are proxy numeric representations for continuous scaling, not stopwatch-logged hours. The original categorical survey values ($1, 2, 3, 4$) are preserved in `studytime`.

---

## 3. Data Dictionary

| Attribute Name | Data Type | Storage Format | Description & Mapping Logic | Value Range / Allowed Values | Unit |
|---|---|---|---|---|---|
| `student_code` | String | String | Deterministic course enrollment code | `STU-MAT-001` .. `STU-POR-649` | N/A |
| `subject` | String | String | Secondary school curriculum course domain | `Mathematics`, `Portuguese Language` | Course Domain |
| `academic_year` | String | String | Academic observation period | `2025-2026` | Academic Year |
| `term` | String | String | Evaluation term cycle | `Final Term` | Semester Cycle |
| `attendance_percentage` | Float | Double | **Estimated attendance proxy** derived from absence count ($$100 - (\min(\text{absences}, 60)/60 \times 100)$$). Not verified roll-call attendance. | `0.0` – `100.0` | Percentage (%) [Estimated Proxy] |
| `study_hours_per_week` | Float | Double | **Midpoint estimate** mapped from ordinal `studytime` ($1 \rightarrow 1.5, 2 \rightarrow 3.5, 3 \rightarrow 7.5, 4 \rightarrow 12.0$). | `1.5` – `12.0` | Hours/Week [Midpoint Estimate] |
| `studytime` | Integer | Int32 | Original UCI categorical self-study frequency | `1` ($<2$h), `2` ($2-5$h), `3` ($5-10$h), `4` ($>10$h) | Ordinal Scale |
| `assignment_completion_rate`| Float | Double | Continuous coursework completion index derived from study habits and support | `40.0` – `100.0` | Percentage (%) [Synthetic Proxy] |
| `previous_exam_marks` | Float | Double | Period 1 ($G_1$) evaluation normalized from 0–20 Portuguese scale to standard percentage ($$G_1 \times 5.0$$) | `0.0` – `100.0` | Percentage (%) |
| `quiz_scores` | Float | Double | Period 2 ($G_2$) continuous evaluation score normalized from 0–20 to standard percentage ($$G_2 \times 5.0$$) | `0.0` – `100.0` | Percentage (%) |
| `final_exam_marks` | Float | Double | Final examination outcome mark ($G_3$) normalized to percentage ($$G_3 \times 5.0$$). **Target prediction variable**. | `0.0` – `100.0` | Percentage (%) [Target] |
| `academic_status` | String | String | Three-tier academic early-warning risk level derived from final mark: <br>- `High Risk`: Final mark < 50% ($G_3 < 10$)<br>- `Moderate Risk`: Final mark 50%–69.9% ($10 \le G_3 < 14$)<br>- `Low Risk / On Track`: Final mark $\ge$ 70% ($G_3 \ge 14$) | `High Risk`, `Moderate Risk`, `Low Risk / On Track` | Classification Category [Target] |
| `G1` | Integer | Int32 | Raw Period 1 examination score | `0` – `20` | Score (0–20) |
| `G2` | Integer | Int32 | Raw Period 2 continuous evaluation score | `0` – `20` | Score (0–20) |
| `G3` | Integer | Int32 | Raw Final Period 3 examination score (**Raw Target**) | `0` – `20` | Score (0–20) [Target] |
| `school` | String | String | Institutional school attended | `GP` (Gabriel Pereira), `MS` (Mousinho da Silveira) | School Code |
| `sex` | String | String | Student biological sex | `F` (Female), `M` (Male) | Biological Sex |
| `age` | Integer | Int32 | Chronological age in years | `15` – `22` | Years |
| `address` | String | String | Home residential environment | `U` (Urban), `R` (Rural) | Location Type |
| `famsize` | String | String | Immediate family size category | `LE3` ($\le 3$ members), `GT3` ($> 3$ members) | Household Size |
| `Pstatus` | String | String | Parental cohabitation status | `T` (Living together), `A` (Apart) | Cohabitation |
| `Medu` | Integer | Int32 | Mother's highest completed education level ($0$: None, $1$: Primary 4th grade, $2$: 5th–9th grade, $3$: Secondary, $4$: Higher education) | `0` – `4` | Education Level |
| `Fedu` | Integer | Int32 | Father's highest completed education level | `0` – `4` | Education Level |
| `Mjob` | String | String | Mother's occupation category | `teacher`, `health`, `services`, `at_home`, `other` | Job Category |
| `Fjob` | String | String | Father's occupation category | `teacher`, `health`, `services`, `at_home`, `other` | Job Category |
| `reason` | String | String | Factor influencing school enrollment decision | `home`, `reputation`, `course`, `other` | Decision Factor |
| `guardian` | String | String | Student primary legal guardian | `mother`, `father`, `other` | Guardian Role |
| `traveltime` | Integer | Int32 | Home-to-school travel time ($1$: $<15$ min, $2$: $15$–$30$ min, $3$: $30$ min–$1$ hr, $4$: $>1$ hr) | `1` – `4` | Commute Interval |
| `failures` | Integer | Int32 | Number of prior class failures | `0` – `4` (4 indicates $\ge 4$) | Failure Count |
| `schoolsup` | String | String | Received extra institutional educational support | `yes`, `no` | Support Flag |
| `famsup` | String | String | Received family educational support | `yes`, `no` | Support Flag |
| `paid` | String | String | Enrolled in extra paid classes in course subject | `yes`, `no` | Support Flag |
| `activities` | String | String | Participates in extracurricular activities | `yes`, `no` | Activity Flag |
| `nursery` | String | String | Attended early childhood nursery school | `yes`, `no` | Education Flag |
| `higher` | String | String | Aspirations to pursue higher tertiary education | `yes`, `no` | Goal Flag |
| `internet` | String | String | Dedicated Internet access available at home | `yes`, `no` | Technology Flag |
| `romantic` | String | String | Currently in a romantic relationship | `yes`, `no` | Relationship Flag |
| `famrel` | Integer | Int32 | Quality of family relationship ($1$: Very bad, $5$: Excellent) | `1` – `5` | Likert Scale |
| `freetime` | Integer | Int32 | Free time after school ($1$: Very low, $5$: Very high) | `1` – `5` | Likert Scale |
| `goout` | Integer | Int32 | Frequency of social outings with peers ($1$: Very low, $5$: Very high) | `1` – `5` | Likert Scale |
| `Dalc` | Integer | Int32 | Workday alcohol consumption index ($1$: Very low, $5$: Very high) | `1` – `5` | Likert Scale |
| `Walc` | Integer | Int32 | Weekend alcohol consumption index ($1$: Very low, $5$: Very high) | `1` – `5` | Likert Scale |
| `health` | Integer | Int32 | Current self-reported health status ($1$: Very bad, $5$: Very good) | `1` – `5` | Likert Scale |
| `absences` | Integer | Int32 | Semester school absence count | `0` – `93` | Class Periods |

---

## 4. Machine Learning Feature Leakage Prevention Specification

### 4.1 Target Variable Declarations
- **Primary Regression Target**: `final_exam_marks` ($G_3 \times 5.0$, scale $0$–$100\%$) or raw `G3` (scale $0$–$20$).
- **Primary Classification Target**: `academic_status` (`High Risk`, `Moderate Risk`, `Low Risk / On Track`).

### 4.2 Strictly Forbidden Input Features
The following features are derived directly from the final outcome ($G_3$) or represent administrative identifiers and **MUST NEVER** appear in the input feature matrix ($X$) during model training or inference:
- `G3` (raw final examination mark)
- `final_exam_marks` (scaled final examination mark)
- `academic_status` (risk tier classified from final mark)
- `pass_status` (binary pass/fail indicator derived from final mark)
- `student_code` (administrative enrollment identifier)
- `academic_year` (constant metadata)
- `term` (constant metadata)

### 4.3 Permitted Input Features by Milestone
1. **Milestone 0 (Start of Semester / Early Warning Model)**:
   - Permitted: Demographics (`school`, `sex`, `age`, `address`, `famsize`, `Pstatus`), parental metrics (`Medu`, `Fedu`, `Mjob`, `Fjob`), study habits (`studytime`, `study_hours_per_week`), commute (`traveltime`), prior academic history (`failures`), behavioral habits (`freetime`, `goout`, `Dalc`, `Walc`, `health`), educational support (`schoolsup`, `famsup`, `paid`, `activities`, `higher`, `internet`, `romantic`), and attendance velocity proxy (`absences`, `attendance_percentage`).
   - Zero exam marks ($G_1, G_2$) included.
2. **Milestone 1 (Term 1 Mid-Point Evaluation Model)**:
   - Permitted: All Milestone 0 features PLUS $G_1$ / `previous_exam_marks`.
3. **Milestone 2 (Term 2 Continuous Assessment Model)**:
   - Permitted: All Milestone 1 features PLUS $G_2$ / `quiz_scores`.
