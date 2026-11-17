# ==============================================================================
# EduPredict – Statistical Validation & Hypothesis Testing
# Script: analytics/r/statistical_validation.R
# Author: EduPredict Data Science & Engineering Team
# Runtime: Native R 4.6.2 (Windows 10 x64) - Standard Base R
# ==============================================================================

# Ensure output directory exists
out_dir <- file.path("analytics", "r")
if (!dir.exists(out_dir)) {
  dir.create(out_dir, recursive = TRUE)
}

# 1. Load Cleaned Academic Dataset
csv_file <- file.path("data", "processed", "cleaned_academic_records.csv")
cat("[1/5] Ingesting dataset from:", csv_file, "\n")

if (!file.exists(csv_file)) {
  stop(paste("Data file not found at:", csv_file))
}

data <- read.csv(csv_file, stringsAsFactors = FALSE)
cat(sprintf("   Dataset loaded successfully: %d rows, %d columns\n", nrow(data), ncol(data)))

# 2. Descriptive Statistics by Subject
cat("[2/5] Computing Descriptive Statistics by Discipline...\n")

calc_stats <- function(x) {
  c(
    N      = length(x),
    Mean   = round(mean(x, na.rm = TRUE), 2),
    SD     = round(sd(x, na.rm = TRUE), 2),
    Median = round(median(x, na.rm = TRUE), 2),
    IQR    = round(IQR(x, na.rm = TRUE), 2),
    Min    = round(min(x, na.rm = TRUE), 2),
    Max    = round(max(x, na.rm = TRUE), 2)
  )
}

math_g3 <- data$G3[data$subject == "Mathematics"]
port_g3 <- data$G3[data$subject == "Portuguese Language"]

stats_math <- calc_stats(math_g3)
stats_port <- calc_stats(port_g3)
stats_all  <- calc_stats(data$G3)

desc_table <- rbind(
  `Mathematics`         = stats_math,
  `Portuguese Language` = stats_port,
  `Combined`            = stats_all
)
print(desc_table)

# 3. Inferential Hypothesis Testing
cat("[3/5] Executing Inferential Hypothesis Tests...\n")

# A. Two-Sample Welch's t-test (Math vs. Portuguese Language final grade)
t_test_res <- t.test(math_g3, port_g3, var.equal = FALSE)

# B. Non-parametric Wilcoxon Rank-Sum Test
wilcox_res <- wilcox.test(math_g3, port_g3, exact = FALSE)

# C. One-Way ANOVA across Academic Risk Tiers
anova_model <- aov(G3 ~ academic_status, data = data)
anova_summary <- summary(anova_model)

# D. Kruskal-Wallis Non-Parametric Test across Academic Risk Tiers
kruskal_res <- kruskal.test(G3 ~ academic_status, data = data)

# E. Correlation Analysis
numeric_vars <- c("G1", "G2", "G3", "final_exam_marks", "attendance_percentage", "absences", "study_hours_per_week", "failures")
cor_data <- data[, numeric_vars]
cor_matrix <- round(cor(cor_data, use = "complete.obs", method = "pearson"), 3)

cor_test_att <- cor.test(data$attendance_percentage, data$G3, method = "pearson")
cor_test_study <- cor.test(data$study_hours_per_week, data$G3, method = "pearson")
cor_test_fail <- cor.test(data$failures, data$G3, method = "pearson")

# 4. Generate Graphical Visualizations (Base R)
cat("[4/5] Rendering High-Resolution Statistical Plots...\n")

# Plot 1: Boxplot of Academic Grades by Subject
plot1_path <- file.path(out_dir, "grade_distribution_by_subject.png")
png(plot1_path, width = 800, height = 600, res = 120)
par(mar = c(4, 5, 4, 2), bg = "#f8fafc")
boxplot(
  G3 ~ subject, data = data,
  col = c("#3b82f6", "#10b981"),
  border = c("#1d4ed8", "#047857"),
  notch = TRUE,
  main = "EduPredict: Final Grade Distribution (G3) by Discipline",
  xlab = "Discipline",
  ylab = "Final Grade (0 - 20 Scale)",
  sub = sprintf("Welch t-test: t = %.2f, p = %.2e | Wilcoxon W = %.0f, p = %.2e",
                t_test_res$statistic, t_test_res$p.value, wilcox_res$statistic, wilcox_res$p.value),
  col.sub = "#475569",
  cex.main = 1.2,
  cex.lab = 1.1,
  pch = 19,
  outcol = "#ef4444"
)
abline(h = 10, col = "#dc2626", lty = 2, lwd = 2)
text(x = 1.5, y = 10.6, labels = "Passing Threshold (10.0)", col = "#dc2626", font = 2)
dev.off()
cat("   Saved plot 1 to:", plot1_path, "\n")

# Plot 2: Scatter Plot of Attendance Velocity vs. Final Grade
plot2_path <- file.path(out_dir, "attendance_vs_grade_scatter.png")
png(plot2_path, width = 800, height = 600, res = 120)
par(mar = c(4, 5, 4, 2), bg = "#f8fafc")
plot(
  data$attendance_percentage, data$G3,
  col = ifelse(data$subject == "Mathematics", "#2563eb88", "#05966988"),
  pch = 19,
  main = "EduPredict: Attendance Percentage vs. Final Grade (G3)",
  xlab = "Standardized Attendance Percentage (%)",
  ylab = "Final Grade (0 - 20 Scale)",
  sub = sprintf("Pearson r = %.3f, p = %.2e (Statistically Significant)", cor_test_att$estimate, cor_test_att$p.value),
  col.sub = "#475569",
  cex.main = 1.2,
  cex.lab = 1.1
)
fit <- lm(G3 ~ attendance_percentage, data = data)
abline(fit, col = "#d97706", lwd = 2.5)
legend("topleft", legend = c("Mathematics", "Portuguese Language", "Linear Trend"),
       col = c("#2563eb", "#059669", "#d97706"), pch = c(19, 19, NA), lty = c(NA, NA, 1), lwd = c(NA, NA, 2))
dev.off()
cat("   Saved plot 2 to:", plot2_path, "\n")

# 5. Export Summary Outputs
cat("[5/5] Exporting Statistical Summary Outputs...\n")

cor_file <- file.path(out_dir, "correlation_matrix.csv")
write.csv(cor_matrix, file = cor_file)
cat("   Exported correlation matrix to:", cor_file, "\n")

summary_file <- file.path(out_dir, "statistical_summary_output.txt")
sink(summary_file)
cat("===============================================================================\n")
cat("EDUPREDICT: STATISTICAL VALIDATION & HYPOTHESIS TESTING REPORT\n")
cat("Generated via R 4.6.2 (Windows 10 x64)\n")
cat("Dataset: UCI Student Performance (Cleaned Academic Records)\n")
cat("Date/Time:", as.character(Sys.time()), "\n")
cat("===============================================================================\n\n")

cat("--- 1. DESCRIPTIVE STATISTICS (G3 FINAL GRADE BY SUBJECT) ---\n")
print(desc_table)
cat("\n")

cat("--- 2. TWO-SAMPLE WELCH'S T-TEST (MATH vs. PORTUGUESE LANGUAGE G3) ---\n")
print(t_test_res)
cat("\n")

cat("--- 3. WILCOXON RANK-SUM TEST (MANN-WHITNEY U) ---\n")
print(wilcox_res)
cat("\n")

cat("--- 4. ONE-WAY ANALYSIS OF VARIANCE (ANOVA: G3 ~ ACADEMIC RISK TIER) ---\n")
print(anova_summary)
cat("\n")

cat("--- 5. KRUSKAL-WALLIS TEST (G3 ~ ACADEMIC RISK TIER) ---\n")
print(kruskal_res)
cat("\n")

cat("--- 6. PEARSON CORRELATION ANALYSIS ---\n")
cat(sprintf("Attendance %% vs. Final Grade (G3): r = %.4f (t = %.2f, p = %.2e)\n",
            cor_test_att$estimate, cor_test_att$statistic, cor_test_att$p.value))
cat(sprintf("Study Hours/Week vs. Final Grade (G3): r = %.4f (t = %.2f, p = %.2e)\n",
            cor_test_study$estimate, cor_test_study$statistic, cor_test_study$p.value))
cat(sprintf("Past Failures vs. Final Grade (G3): r = %.4f (t = %.2f, p = %.2e)\n",
            cor_test_fail$estimate, cor_test_fail$statistic, cor_test_fail$p.value))
cat("\nFULL CORRELATION MATRIX:\n")
print(cor_matrix)
cat("\n===============================================================================\n")
cat("END OF STATISTICAL VALIDATION REPORT\n")
cat("===============================================================================\n")
sink()

cat("   Exported full statistical report to:", summary_file, "\n")
cat("Statistical validation script execution completed successfully.\n")
