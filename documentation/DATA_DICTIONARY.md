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

## 2. Dataset Limitations & Ethical Safeguards

1. **Regional Context**: Observations originate from Portuguese secondary schools; socio-cultural indicators (such as parental education categories and commute travel time) reflect regional educational structures.
2. **Deterministic Anonymization**: Student records do not contain personally identifying information (PII) such as national IDs, home addresses, phone numbers, or real student names. For pipeline continuity in EduPredict, deterministic identifiers (`STU-MAT-001` .. `STU-POR-649`) are generated.
3. **No Fabricated Real-World Validation**: Under strict project rules, these records represent benchmark secondary school observations. They are used for training predictive models and testing data pipelines, not presented as real-time local institutional data.

---

## 3. Data Dictionary

| Attribute Name | Data Type | Storage Format | Description & Mapping Logic | Value Range / Allowed Values | Unit |
|---|---|---|---|---|---|
| `student_code` | String | String | Deterministic enrollment code for data tracking | `STU-MAT-001` .. `STU-POR-649` | N/A |
| `subject` | String | String | Secondary school curriculum course domain | `Mathematics`, `Portuguese Language` | Course Domain |
| `academic_year` | String | String | Academic observation period | `2025-2026` | Academic Year |
| `term` | String | String | Evaluation term cycle | `Final Term` | Semester Cycle |
| `attendance_percentage` | Float | Double | Class presence rate derived from total absences ($$100 - (\text{absences}/60 \times 100)$$) | `0.0` – `100.0` | Percentage (%) |
| `study_hours_per_week` | Float | Double | Average weekly self-study hours mapped from discrete `studytime` categories ($1 \rightarrow 1.5, 2 \rightarrow 3.5, 3 \rightarrow 7.5, 4 \rightarrow 12.0$) | `1.5` – `12.0` | Hours/Week |
| `assignment_completion_rate`| Float | Double | Percentage of continuous coursework/assignments submitted, derived from study regularity and support | `40.0` – `100.0` | Percentage (%) |
| `previous_exam_marks` | Float | Double | First period evaluation (G1) normalized from 0–20 Portuguese scale to standard percentage ($$G1 \times 5.0$$) | `0.0` – `100.0` | Percentage (%) |
| `quiz_scores` | Float | Double | Second period continuous evaluation (G2) normalized from 0–20 to standard percentage ($$G2 \times 5.0$$) | `0.0` – `100.0` | Percentage (%) |
| `final_exam_marks` | Float | Double | Final examination outcome mark (G3) normalized to percentage ($$G3 \times 5.0$$). Target prediction variable. | `0.0` – `100.0` | Percentage (%) |
| `academic_status` | String | String | Three-tier academic early-warning risk level: <br>- `High Risk`: Final mark < 50% ($G3 < 10$)<br>- `Moderate Risk`: Final mark 50%–69.9% ($10 \le G3 < 14$)<br>- `Low Risk / On Track`: Final mark $\ge$ 70% ($G3 \ge 14$) | `High Risk`, `Moderate Risk`, `Low Risk / On Track` | Classification Category |
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
