# EduPredict – System Architecture & Technical Design

## 1. Architectural Philosophy
EduPredict is an AI/ML-driven Educational Performance Prediction and Analytics Platform designed using a **Decoupled Modular Architecture**. It combines a responsive modern React Single Page Application (SPA), a high-throughput operational NoSQL datastore (MongoDB 6.x), a scalable Big Data analytical lakehouse (HDFS / Impala), an enterprise BI bridge (Tableau), and an extensible machine learning inference engine.

```
                      +-------------------------------------------------------+
                      |         Presentation Tier: React 18 / TypeScript SPA  |
                      |  - Vite 6 Bundler & Dev Proxy                         |
                      |  - Centralized AuthContext (Session Restoration)      |
                      |  - Role-Partitioned Dashboards (Student, Teacher, Admin)|
                      |  - Responsive SaaS Layout & Lucide Iconography        |
                      +---------------------------+---------------------------+
                                                  |
                                            HTTP / JSON
                                  (Credentials: include, X-CSRFToken)
                                                  v
                      +-------------------------------------------------------+
                      |              Web & Application Gateway                |
                      |  - Apache HTTP Server (Reverse Proxy & Static Cache)  |
                      |  - Flask WSGI Application (Waitress / Gunicorn)       |
                      |  - Authentication & RBAC Guard (@role_required)       |
                      |  - Real-Time Event Streamer (SSE / WebSockets)        |
                      +---------------------------+---------------------------+
                                                  |
                                                  v
                      +-------------------------------------------------------+
                      |                Service Business Tier                  |
                      |  - AuthService & Role Enforcement                     |
                      |  - UserService (Profile, Passwords, Role Management)  |
                      |  - AssignmentService (Teacher-Student Links)          |
                      |  - SystemLogService (Audit Trail)                     |
                      |  - PredictionEngineService & RecommendationService    |
                      |  - ParallelBatchProcessor (Multiprocessing Engine)    |
                      |  - BigDataBridge (HDFS Adapter, Impala OLAP, Tableau) |
                      +-------------------+-------------------+---------------+
                                          |                   |
                        +-----------------+                   +-----------------+
                        v                                                       v
    +---------------------------------------+               +---------------------------------------+
    |         Operational Datastore         |               |          Big Data & ML Layer          |
    |  - MongoDB Server 6.0.29 (Native)     |               |  - HDFS Storage Lake (/user/...)      |
    |  - Collections: users, records,       |               |  - Apache Impala SQL OLAP Queries     |
    |    predictions, assignments, logs     |               |  - Serialized Scikit-Learn Models     |
    |  - Admin tools: mongosh & Compass     |               |  - Feature Scalers & Encoders         |
    +---------------------------------------+               +---------------------------------------+
```

---

## 2. Frontend Application Architecture (React + TypeScript + Vite + Tailwind CSS)

The frontend is structured as a dedicated TypeScript SPA inside `frontend/` powered by Vite 6 and Tailwind CSS v3:
```text
frontend/
├── package.json              # React 18, Tailwind CSS 3.4, PostCSS, Autoprefixer, React Router 6
├── tsconfig.json             # Strict TypeScript compiler options
├── vite.config.ts            # Local development proxy (/auth, /api -> :5000)
├── tailwind.config.js        # Design tokens: Navy (#0B192C, #1E3E62), Brand blue, Cyan, Surfaces
├── postcss.config.js         # PostCSS plugins (tailwindcss, autoprefixer)
├── index.html                # HTML5 mount point with Plus Jakarta Sans & Inter
└── src/
    ├── main.tsx              # Application bootstrap with global styles
    ├── App.tsx               # React Router layout structure & route hierarchy
    ├── types/
    │   └── index.ts          # TypeScript interfaces: User, AcademicRecord, Assignment, Log
    ├── services/
    │   └── api.ts            # Centralized API service with automated CSRF injection
    ├── context/
    │   └── AuthContext.tsx   # React Context maintaining authenticated session & user state
    ├── styles/
    │   └── global.css        # Tailwind directives (@tailwind base/components/utilities) + SaaS styles
    ├── components/
    │   ├── common/           # Navbar, Sidebar, StatCard, LoadingSkeleton, EmptyState, Modal (Tailwind)
    │   └── forms/            # Accessible InputField with show/hide password, Button with spinner (Tailwind)
    ├── layouts/
    │   ├── AuthLayout.tsx    # Branded centered container for public authentication (Tailwind)
    │   └── DashboardLayout.tsx # Sticky sidebar, header, and content workspace container (Tailwind)
    ├── routes/
    │   └── ProtectedRoute.tsx# Enforces authentication & role-based route protection
    └── pages/
        ├── auth/             # LoginPage, RegisterPage, ForgotPasswordPage (Tailwind)
        ├── student/          # StudentOverview (Tailwind), StudentProfile, StudentRecords, StudentPredictions
        ├── teacher/          # TeacherOverview (Tailwind), TeacherStudents (with inspection modal)
        ├── admin/            # AdminOverview (Tailwind), UserManagement, TeacherAssignments, SystemLogs
        └── status/           # UnauthorizedPage (403), NotFoundPage (404)
```

---

## 3. Frontend-Backend Security & Authentication Flow

1. **CSRF Protection via Session Secret**:
   - On application load or prior to mutating requests, `api.ts` invokes `GET /api/csrf-token`.
   - Flask-WTF generates a signed CSRF token bound to the active session.
   - For all `POST`, `PUT`, `DELETE` requests, `api.ts` automatically attaches the token in the `X-CSRFToken` request header.
   - If a request encounters a CSRF expiration error (400), `api.ts` automatically refreshes the token and transparently retries the mutation once.
2. **Session Cookies & Credentials**:
   - All fetch requests specify `credentials: 'include'`.
   - Flask-Login issues secure HTTP-only cookies (`session=...`).
   - Sensitive credentials (passwords, tokens) are never stored in `localStorage` or `sessionStorage`.
3. **Session Restoration**:
   - When the user refreshes their browser, `AuthContext` calls `GET /api/me`.
   - If the session cookie is valid, the user state is restored and the user remains on their dashboard.
   - If the session has expired or is invalid (401), the user is redirected to `/login`.
4. **Client-Side Role Authorization & Route Guards**:
   - `ProtectedRoute` inspects `user.role` against `allowedRoles`.
   - If an authenticated student attempts to navigate directly to `/admin` or `/teacher`, they are redirected to `/unauthorized` (403 Access Denied).
   - Server-side decorators (`@role_required`, `@admin_required`) remain the primary source of truth.

---

## 4. Backend Modular Layout & Database Schema
*(Preserved from Phase 2)*
- MongoDB 6.x running on port `27017` with collections: `users`, `academic_records`, `predictions`, `teacher_student_assignments`, `system_logs`.
- All 41 backend tests verified and passing.
