import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TeacherAttendance } from '../pages/teacher/TeacherAttendance';
import { StudentAttendance } from '../pages/student/StudentAttendance';
import { TeacherAcademicRecords } from '../pages/teacher/TeacherAcademicRecords';
import { StudentOverview } from '../pages/student/StudentOverview';
import { StudentProgress } from '../pages/student/StudentProgress';
import { StudentRecommendations } from '../pages/student/StudentRecommendations';
import { AnalystTrends } from '../pages/analyst/AnalystTrends';
import { AdminReports } from '../pages/admin/AdminReports';
import { api, attendanceApi, academicRecordsApi, dropoutApi, tableauApi } from '../services/api';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'stu-1',
      email: 'student@edupredict.com',
      full_name: 'Alice Student',
      role: 'student',
      is_active: true,
    },
  }),
}));

const MOCK_SUBJECT_CTX = {
  selectedSubject: {
    id: 'subj-math',
    name: 'Mathematics',
    code: 'MATH-101',
    academic_term: '2026-T1',
    is_active: true,
    grading_scale: '0-20',
  },
  selectedSubjectId: 'subj-math',
  hasNoAssignments: false,
  loading: false,
  subjects: [],
  setSelectedSubjectId: vi.fn(),
};

vi.mock('../context/TeacherSubjectContext', () => ({
  useTeacherSubject: () => MOCK_SUBJECT_CTX,
}));

describe('Phase 13 Workstream A Frontend Truthfulness & Registers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('TeacherAttendance renders empty sessions honestly without fake 95.0 proxy and creates roll-call session', async () => {
    vi.spyOn(api, 'getTeacherStudents').mockResolvedValue({
      students: [{ id: 'stu-1', full_name: 'Alice Student', email: 'alice@edupredict.com', role: 'student', is_active: true, created_at: '2026-11-28T00:00:00Z', updated_at: '2026-11-28T00:00:00Z' }],
      count: 1,
      status_code: 200,
    });
    vi.spyOn(attendanceApi, 'listSessions').mockResolvedValue({
      status_code: 200,
      sessions: [],
      total_count: 0,
      page: 1,
      limit: 50,
      disclosure: 'Separate disclosure',
    });
    vi.spyOn(attendanceApi, 'getSummary').mockResolvedValue({
      status_code: 200,
      subject_summaries: [],
      overall: {
        total_sessions: 0,
        total_marked_entries: 0,
        present_count: 0,
        absent_count: 0,
        late_count: 0,
        excused_count: 0,
        attendance_percentage: null,
        has_records: false,
      },
      formula: 'Attended / Non-Excused',
      disclosure: 'Disclosure',
    });
    vi.spyOn(api, 'listPredictions').mockResolvedValue({ predictions: [], total_count: 0, limit: 100, skip: 0, status_code: 200 });
    const createSpy = vi.spyOn(attendanceApi, 'createSession').mockResolvedValue({
      status_code: 201,
      session: {
        id: 'sess-1',
        subject_id: 'subj-math',
        subject_name: 'Mathematics',
        subject_code: 'MATH-101',
        teacher_id: 't-1',
        teacher_name: 'Teacher',
        academic_term: '2026-T1',
        session_date: '2026-11-28',
        session_title: '',
        status: 'recorded',
        total_students: 1,
        present_count: 1,
        absent_count: 0,
        late_count: 0,
        excused_count: 0,
        attendance_source: 'verified_institutional_register',
      },
      records: [],
      disclosure: 'Disclosure',
    });

    render(
      <MemoryRouter>
        <TeacherAttendance />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No attendance sessions recorded/i)).toBeTruthy();
    });
    expect(screen.queryByText(/95\.0%/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Save Roll-Call Session/i }));
    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('StudentAttendance displays Verified Institutional Attendance separately from Estimated ML Proxy', async () => {
    vi.spyOn(attendanceApi, 'getMyAttendance').mockResolvedValue({
      status_code: 200,
      student_id: 'stu-1',
      verified_institutional_attendance: {
        label: 'Verified Institutional Attendance',
        overall_attendance_percentage: 75.0,
        total_sessions: 4,
        effective_sessions: 4,
        present_count: 2,
        absent_count: 1,
        late_count: 1,
        excused_count: 0,
        has_records: true,
        formula: 'Present + Late / Effective',
        subject_summaries: [
          {
            subject_id: 'subj-math',
            subject_name: 'Mathematics',
            subject_code: 'MATH-101',
            academic_term: '2026-T1',
            total_sessions: 4,
            present_count: 2,
            absent_count: 1,
            late_count: 1,
            excused_count: 0,
            effective_sessions: 4,
            attendance_percentage: 75.0,
            has_records: true,
          },
        ],
      },
      estimated_ml_proxy: {
        label: 'Estimated ML Attendance Proxy',
        absences: 12,
        assumed_sessions: 60,
        estimated_attendance_percentage: 80.0,
        subject: 'Mathematics',
        academic_term: '2026-T1',
        formula: 'max(0, 100 - (absences / 60) * 100)',
        is_verified_roll_call: false,
      },
      records: [],
      total_count: 0,
      page: 1,
      limit: 50,
      disclosure: 'Strictly separated.',
    });

    render(
      <MemoryRouter>
        <StudentAttendance />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('75.0%').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText('80.0%')).toBeTruthy();
    expect(screen.getAllByText(/Estimated ML Attendance Proxy/i).length).toBeGreaterThanOrEqual(1);
  });

  it('TeacherAcademicRecords imports CSV text and displays summary counters', async () => {
    vi.spyOn(api, 'getTeacherStudents').mockResolvedValue({
      students: [{ id: 'stu-1', full_name: 'Alice Student', email: 'alice@edupredict.com', role: 'student', is_active: true, created_at: '2026-11-28T00:00:00Z', updated_at: '2026-11-28T00:00:00Z' }],
      count: 1,
      status_code: 200,
    });
    vi.spyOn(academicRecordsApi, 'list').mockResolvedValue({
      status_code: 200,
      records: [],
      total_count: 0,
      page: 1,
      limit: 100,
    });
    const csvSpy = vi.spyOn(academicRecordsApi, 'importCsvText').mockResolvedValue({
      status_code: 200,
      summary: {
        total_rows: 3,
        successful: 1,
        duplicate: 1,
        rejected: 1,
        created_record_ids: ['rec-1'],
        errors: [{ row: 4, status: 'rejected', reason: 'g1 out of range' }],
      },
    });

    render(
      <MemoryRouter>
        <TeacherAcademicRecords />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/student_email,subject,term/i)).toBeTruthy();
    });
    fireEvent.change(screen.getByPlaceholderText(/student_email,subject,term/i), {
      target: { value: 'student_email,subject,term,g1\nalice@edupredict.com,Mathematics,2026-T1,14' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Validate & Import CSV/i }));

    await waitFor(() => {
      expect(csvSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/g1 out of range/i)).toBeTruthy();
    });
  });

  it('Dashboard views never render removed hardcoded metrics or fake benchmarks when empty', async () => {
    vi.spyOn(api, 'getStudentSubjects').mockResolvedValue({ subjects: [], count: 0, status_code: 200 });
    vi.spyOn(api, 'listPredictions').mockResolvedValue({ predictions: [], total_count: 0, limit: 20, skip: 0, status_code: 200 });
    vi.spyOn(attendanceApi, 'getMyAttendance').mockResolvedValue({
      status_code: 200,
      student_id: 'stu-1',
      verified_institutional_attendance: {
        label: 'Verified Institutional Attendance',
        overall_attendance_percentage: null,
        total_sessions: 0,
        effective_sessions: 0,
        present_count: 0,
        absent_count: 0,
        late_count: 0,
        excused_count: 0,
        has_records: false,
        formula: 'Present + Late / Effective',
        subject_summaries: [],
      },
      estimated_ml_proxy: null,
      records: [],
      total_count: 0,
      page: 1,
      limit: 50,
      disclosure: 'Disclosure',
    });
    vi.spyOn(academicRecordsApi, 'list').mockResolvedValue({ status_code: 200, records: [], total_count: 0, page: 1, limit: 20 });
    vi.spyOn(dropoutApi, 'getStudentDropoutRisk').mockResolvedValue({ status_code: 404 } as any);
    vi.spyOn(api, 'getAnalystTrends').mockResolvedValue({
      status_code: 200,
      term_trends: [],
      monitored_terms_count: 0,
      unsuppressed_terms_count: 0,
      institutional_avg_raw20: null,
      institutional_avg_percentage: null,
      institutional_suppressed: true,
      growth_delta_raw20: null,
      trend_available: false,
      trend_message: 'Not enough data to calculate a trend',
      sdc_threshold: 5,
    });

    const rOverview = render(
      <MemoryRouter>
        <StudentOverview />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/Insufficient historical data/i)).toBeTruthy();
    });
    expect(screen.queryByText(/Phase 4/i)).toBeNull();
    rOverview.unmount();

    const rProg = render(
      <MemoryRouter>
        <StudentProgress />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/Insufficient historical data/i)).toBeTruthy();
    });
    expect(screen.queryByText(/\+1\.2 pts/i)).toBeNull();
    rProg.unmount();

    const rRec = render(
      <MemoryRouter>
        <StudentRecommendations />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getAllByText(/Prediction unavailable/i).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText(/\+2\.5 pts/i)).toBeNull();
    expect(screen.queryByText(/3\.5 hrs\/week/i)).toBeNull();
    rRec.unmount();

    const rTrends = render(
      <MemoryRouter>
        <AnalystTrends />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getAllByText(/Not enough data to calculate a trend/i).length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText(/5 Cycles/i)).toBeNull();
    expect(screen.queryByText(/\+0\.5 pts \/ year/i)).toBeNull();
    expect(screen.queryByText(/12\.7/)).toBeNull();
    rTrends.unmount();

    vi.spyOn(tableauApi, 'listDatasets').mockResolvedValue({
      status_code: 200,
      count: 1,
      datasets: [
        {
          dataset: 'academic_performance',
          title: 'Academic Performance & Risk Summary',
          description: 'Aggregated performance summary',
          columns: ['subject', 'academic_term'],
          source_collections: ['predictions', 'academic_records'],
          source_document_counts: { predictions: 0, academic_records: 0 },
        },
      ],
    });
    const csvDlSpy = vi.spyOn(tableauApi, 'downloadCsv').mockResolvedValue();

    const rAdminRep = render(
      <MemoryRouter>
        <AdminReports />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/Admin Scoped/i)).toBeTruthy();
      expect(screen.getByText(/Export for Tableau BI Analytics/i)).toBeTruthy();
    });
    expect(screen.queryByText(/100% SDC Verified/i)).toBeNull();
    expect(screen.queryByText('2026-T1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Export Tableau CSV/i }));
    await waitFor(() => {
      expect(csvDlSpy).toHaveBeenCalledWith('academic_performance', true);
    });
    rAdminRep.unmount();
  });
});
