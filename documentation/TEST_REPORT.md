# EduPredict – Test Report

## Phase 0: Verification & Baseline Diagnostics
- **Date**: 2026-11-17
- **Target**: Environment, Interpreter, Database & Version Control

### Diagnostic Results

| Check / Test Case | Target / Command | Expected | Actual Result | Status |
|---|---|---|---|---|
| **Python Version** | `.\.venv\Scripts\python.exe --version` | Python 3.12.x | Python 3.12.16 | **PASS** |
| **Virtual Environment** | Path checking `.\.venv` | Active directory with scripts | Found, functional | **PASS** |
| **MongoDB Service** | `Get-Service MongoDB` | Running | Running | **PASS** |
| **MongoDB Version** | `mongod.exe --version` | MongoDB 6.x | v6.0.29 | **PASS** |
| **MongoDB Port 27017** | `Test-NetConnection -Port 27017` | TcpTestSucceeded: True | TcpTestSucceeded: True | **PASS** |
| **Git Installed** | `git --version` | Git 2.x | 2.55.0.windows.5 | **PASS** |
| **Git Configured User** | `git config user.name / email` | User identity present | Azan Ali <azanali3005@gmail.com> | **PASS** |
| **Git Ignore Safeguards**| Verify `.venv/` and `.conda/` ignored | Not in `git status` | Clean untracked list (no venv/conda) | **PASS** |

### Summary
All environmental pre-flight checks passed successfully. Automated unit tests will be configured in Phase 1 and executed starting in Phase 2.
