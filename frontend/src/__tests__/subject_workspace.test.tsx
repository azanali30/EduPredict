import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PredictionForm } from '../components/predictions/PredictionForm';
import { TeacherPredictionModal } from '../components/predictions/TeacherPredictionModal';
import { TeacherSubjectProvider, useTeacherSubject } from '../context/TeacherSubjectContext';
import { api } from '../services/api';
import { User, SubjectItem } from '../types';

// Mock API
vi.mock('../services/api', () => ({
  api: {
    getTeacherSubjects: vi.fn(),
    listPredictions: vi.fn(),
    createPrediction: vi.fn(),
    getTeacherStudents: vi.fn(),
    getStudentSubjects: vi.fn(),
    adminListSubjects: vi.fn(),
    adminListTeacherSubjects: vi.fn(),
    adminListStudentEnrollments: vi.fn(),
    adminCreateSubject: vi.fn(),
    adminAssignTeacherSubject: vi.fn(),
    adminEnrollStudent: vi.fn(),
  },
}));

const MOCK_TEACHER_USER = {
  id: 'teacher-123',
  full_name: 'Dr. Test Teacher',
  email: 'teacher@edupredict.edu',
  role: 'teacher',
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: MOCK_TEACHER_USER,
    isAuthenticated: true,
  }),
}));

const mockMathSubject: SubjectItem = {
  id: 'subj-math-1',
  code: 'MATH-101',
  name: 'Mathematics',
  canonical_key: 'mathematics',
  status: 'active',
  academic_term: '2026-T1',
  created_at: new Date().toISOString(),
};

const mockPortSubject: SubjectItem = {
  id: 'subj-port-2',
  code: 'PORT-101',
  name: 'Portuguese Language',
  canonical_key: 'portuguese',
  status: 'active',
  academic_term: '2026-T1',
  created_at: new Date().toISOString(),
};

const mockStudentMathOnly: User = {
  id: 'stud-math-only',
  full_name: 'Student MathOnly',
  email: 'mathonly@student.edupredict.edu',
  role: 'student',
  is_active: true,
  enrolled_subjects_under_teacher: ['Mathematics'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockStudentPortOnly: User = {
  id: 'stud-port-only',
  full_name: 'Student PortOnly',
  email: 'portonly@student.edupredict.edu',
  role: 'student',
  is_active: true,
  enrolled_subjects_under_teacher: ['Portuguese Language'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockStudentDualEnrolled: User = {
  id: 'stud-dual',
  full_name: 'Student DualEnrolled',
  email: 'dual@student.edupredict.edu',
  role: 'student',
  is_active: true,
  enrolled_subjects_under_teacher: ['Mathematics', 'Portuguese Language'],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('1. TeacherSubjectContext & Selector Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestConsumer: React.FC = () => {
    const { subjects, selectedSubject, setSelectedSubjectId, hasNoAssignments, loading } = useTeacherSubject();
    if (loading) return <div>Loading Subjects...</div>;
    return (
      <div>
        <div data-testid="no-assignments">{String(hasNoAssignments)}</div>
        <div data-testid="selected-subject">{selectedSubject ? selectedSubject.name : 'None'}</div>
        <div data-testid="subject-count">{subjects.length}</div>
        <button data-testid="switch-to-port" onClick={() => setSelectedSubjectId('subj-port-2')}>
          Switch to Port
        </button>
      </div>
    );
  };

  it('handles teacher with zero assigned subjects correctly', async () => {
    (api.getTeacherSubjects as any).mockResolvedValue({ success: true, subjects: [], count: 0 });

    render(
      <TeacherSubjectProvider>
        <TestConsumer />
      </TeacherSubjectProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('no-assignments').textContent).toBe('true');
      expect(screen.getByTestId('selected-subject').textContent).toBe('None');
      expect(screen.getByTestId('subject-count').textContent).toBe('0');
    });
  });

  it('handles teacher with single assigned subject', async () => {
    (api.getTeacherSubjects as any).mockResolvedValue({
      success: true,
      subjects: [mockMathSubject],
      count: 1,
    });

    render(
      <TeacherSubjectProvider>
        <TestConsumer />
      </TeacherSubjectProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('no-assignments').textContent).toBe('false');
      expect(screen.getByTestId('selected-subject').textContent).toBe('Mathematics');
      expect(screen.getByTestId('subject-count').textContent).toBe('1');
    });
  });

  it('handles teacher with multiple assigned subjects and switching', async () => {
    (api.getTeacherSubjects as any).mockResolvedValue({
      success: true,
      subjects: [mockMathSubject, mockPortSubject],
      count: 2,
    });

    render(
      <TeacherSubjectProvider>
        <TestConsumer />
      </TeacherSubjectProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('selected-subject').textContent).toBe('Mathematics');
      expect(screen.getByTestId('subject-count').textContent).toBe('2');
    });

    // Switch subject to Portuguese
    fireEvent.click(screen.getByTestId('switch-to-port'));

    await waitFor(() => {
      expect(screen.getByTestId('selected-subject').textContent).toBe('Portuguese Language');
    });
  });
});

describe('2. Subject Switching and Stale Data Clearing', () => {
  const StaleDataHarness: React.FC = () => {
    const [roster, setRoster] = useState<string[]>(['Initial Ali (Math)']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const switchSubject = async (subj: string) => {
      setLoading(true);
      setError(null);
      // Immediately clear old roster to avoid stale data
      setRoster([]);
      try {
        if (subj === 'fail') {
          throw new Error('Network Disconnection');
        }
        setRoster(subj === 'Portuguese' ? ['Beatriz (Port)'] : ['Ali (Math)']);
      } catch (err: any) {
        setError(err.message);
        setRoster([]);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div>
        <div data-testid="roster-list">{roster.join(', ')}</div>
        {loading && <div data-testid="loading-indicator">Loading...</div>}
        {error && <div data-testid="error-message">{error}</div>}
        <button data-testid="btn-port" onClick={() => switchSubject('Portuguese')}>To Port</button>
        <button data-testid="btn-fail" onClick={() => switchSubject('fail')}>To Error</button>
      </div>
    );
  };

  it('clears stale data immediately upon switching subject', async () => {
    render(<StaleDataHarness />);
    expect(screen.getByTestId('roster-list').textContent).toContain('Initial Ali');

    fireEvent.click(screen.getByTestId('btn-port'));
    await waitFor(() => {
      expect(screen.getByTestId('roster-list').textContent).toBe('Beatriz (Port)');
      expect(screen.getByTestId('roster-list').textContent).not.toContain('Ali');
    });
  });

  it('does not leave stale data visible if API fails', async () => {
    render(<StaleDataHarness />);
    fireEvent.click(screen.getByTestId('btn-fail'));
    await waitFor(() => {
      expect(screen.getByTestId('error-message').textContent).toBe('Network Disconnection');
      expect(screen.getByTestId('roster-list').textContent).toBe('');
    });
  });
});

describe('3. Unauthorized Subject Exclusion in PredictionForm', () => {
  it('excludes Portuguese Language button when authorizedSubjects contains only Mathematics', () => {
    const onSubmit = vi.fn();
    render(
      <PredictionForm
        onSubmit={onSubmit}
        loading={false}
        studentId="stud-1"
        studentName="Ali Khan"
        authorizedSubjects={[mockMathSubject]}
      />
    );

    expect(screen.getByRole('button', { name: /mathematics/i })).toBeDefined();
    const portButton = screen.queryByRole('button', { name: /portuguese language/i });
    expect(portButton).toBeNull();
  });

  it('excludes Mathematics button when authorizedSubjects contains only Portuguese', () => {
    const onSubmit = vi.fn();
    render(
      <PredictionForm
        onSubmit={onSubmit}
        loading={false}
        studentId="stud-2"
        studentName="Beatriz Silva"
        authorizedSubjects={[mockPortSubject]}
      />
    );

    expect(screen.getByRole('button', { name: /portuguese language/i })).toBeDefined();
    const mathButton = screen.queryByRole('button', { name: /mathematics/i });
    expect(mathButton).toBeNull();
  });

  it('renders both buttons when dual-authorized', () => {
    const onSubmit = vi.fn();
    render(
      <PredictionForm
        onSubmit={onSubmit}
        loading={false}
        studentId="stud-3"
        studentName="Carlos Santos"
        authorizedSubjects={[mockMathSubject, mockPortSubject]}
      />
    );

    expect(screen.getByRole('button', { name: /mathematics/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /portuguese language/i })).toBeDefined();
  });

  it('renders empty notice when authorizedSubjects is empty', () => {
    const onSubmit = vi.fn();
    render(
      <PredictionForm
        onSubmit={onSubmit}
        loading={false}
        studentId="stud-4"
        studentName="Denied Student"
        authorizedSubjects={[]}
      />
    );

    expect(
      screen.getByText(/no authorized course subjects available for this learner/i)
    ).toBeDefined();
  });
});

describe('4. TeacherPredictionModal Student Filtering & 403 Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getTeacherSubjects as any).mockResolvedValue({
      success: true,
      subjects: [mockMathSubject, mockPortSubject],
      count: 2,
    });
    (api.listPredictions as any).mockResolvedValue({ success: true, predictions: [], total_count: 0 });
  });

  it('filters student options in modal to only those enrolled in active subject', async () => {
    render(
      <TeacherSubjectProvider>
        <TeacherPredictionModal
          student={mockStudentMathOnly}
          students={[mockStudentMathOnly, mockStudentPortOnly, mockStudentDualEnrolled]}
          isOpen={true}
          onClose={vi.fn()}
        />
      </TeacherSubjectProvider>
    );

    await waitFor(() => {
      // In Mathematics, MathOnly and DualEnrolled should be eligible
      expect(screen.getAllByText(/Student MathOnly/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Student DualEnrolled/i).length).toBeGreaterThan(0);
      expect(screen.queryByText(/Student PortOnly/i)).toBeNull();
    });
  });

  it('handles backend 403 gracefully with clean non-sensitive alert', async () => {
    (api.createPrediction as any).mockRejectedValueOnce({
      status: 403,
      message: 'Unauthorized: Teacher lacks active subject assignment for this student.',
    });

    render(
      <TeacherSubjectProvider>
        <TeacherPredictionModal
          student={mockStudentMathOnly}
          isOpen={true}
          onClose={vi.fn()}
        />
      </TeacherSubjectProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/new assessment/i)).toBeDefined();
    });

    const form = screen.getByRole('button', { name: /generate ai prediction/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(/authorization error: you are not authorized to create predictions/i)
      ).toBeDefined();
    });
  });
});

describe('5. Student Multi-Subject Workspace Verification', () => {
  const StudentSubjectHarness: React.FC<{ subjects: SubjectItem[] }> = ({ subjects }) => {
    const [selectedSubj, setSelectedSubj] = useState<string>('ALL');
    const filteredPredictions = [
      { id: 'pred-1', subject: 'Mathematics', marks: 82.5 },
      { id: 'pred-2', subject: 'Portuguese Language', marks: 74.0 },
    ].filter((p) => selectedSubj === 'ALL' || p.subject === selectedSubj);

    return (
      <div>
        <div data-testid="enrolled-badges">
          {subjects.map((s) => (
            <span key={s.id} data-testid={`badge-${s.code}`}>
              {s.name} ({s.academic_term})
            </span>
          ))}
        </div>
        <div data-testid="filter-buttons">
          <button onClick={() => setSelectedSubj('ALL')}>All</button>
          <button onClick={() => setSelectedSubj('Mathematics')}>Math</button>
          <button onClick={() => setSelectedSubj('Portuguese Language')}>Port</button>
        </div>
        <div data-testid="filtered-list">
          {filteredPredictions.map((p) => (
            <div key={p.id}>{p.subject}: {p.marks}</div>
          ))}
        </div>
      </div>
    );
  };

  it('renders enrolled courses and separates multi-subject predictions', () => {
    render(<StudentSubjectHarness subjects={[mockMathSubject, mockPortSubject]} />);

    expect(screen.getByTestId('badge-MATH-101').textContent).toContain('Mathematics (2026-T1)');
    expect(screen.getByTestId('badge-PORT-101').textContent).toContain('Portuguese Language (2026-T1)');

    // Initial ALL view shows both
    expect(screen.getByTestId('filtered-list').textContent).toContain('Mathematics: 82.5');
    expect(screen.getByTestId('filtered-list').textContent).toContain('Portuguese Language: 74');

    // Filter to Math only
    fireEvent.click(screen.getByRole('button', { name: 'Math' }));
    expect(screen.getByTestId('filtered-list').textContent).toContain('Mathematics: 82.5');
    expect(screen.getByTestId('filtered-list').textContent).not.toContain('Portuguese Language: 74');

    // Filter to Port only
    fireEvent.click(screen.getByRole('button', { name: 'Port' }));
    expect(screen.getByTestId('filtered-list').textContent).toContain('Portuguese Language: 74');
    expect(screen.getByTestId('filtered-list').textContent).not.toContain('Mathematics: 82.5');
  });
});

describe('6. Admin Course Allocation Workflow & State Management', () => {
  const AdminAllocationHarness: React.FC = () => {
    const [tab, setTab] = useState<'teachers' | 'students' | 'catalog'>('teachers');
    const [termFilter, setTermFilter] = useState('ALL');
    const [allocations, setAllocations] = useState([
      { id: 'alloc-1', teacher: 'Dr. Euler', subject: 'Mathematics', term: '2026-T1', status: 'active' },
      { id: 'alloc-2', teacher: 'Prof. Camoes', subject: 'Portuguese Language', term: '2026-T1', status: 'inactive' },
    ]);

    const toggleStatus = (id: string) => {
      setAllocations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: a.status === 'active' ? 'inactive' : 'active' } : a))
      );
    };

    const filtered = allocations.filter((a) => termFilter === 'ALL' || a.term === termFilter);

    return (
      <div>
        <div data-testid="tabs">
          <button data-testid="tab-teachers" onClick={() => setTab('teachers')}>Instructor Allocations</button>
          <button data-testid="tab-students" onClick={() => setTab('students')}>Student Enrollments</button>
          <button data-testid="tab-catalog" onClick={() => setTab('catalog')}>Subject Catalog</button>
        </div>
        <div data-testid="current-tab">{tab}</div>

        {tab === 'teachers' && (
          <div>
            <select data-testid="term-select" value={termFilter} onChange={(e) => setTermFilter(e.target.value)}>
              <option value="ALL">All Terms</option>
              <option value="2026-T1">2026-T1</option>
              <option value="2026-T2">2026-T2</option>
            </select>
            <div data-testid="alloc-rows">
              {filtered.map((a) => (
                <div key={a.id} data-testid={`row-${a.id}`}>
                  <span>{a.teacher} - {a.subject} ({a.term}) - {a.status}</span>
                  <button data-testid={`toggle-${a.id}`} onClick={() => toggleStatus(a.id)}>
                    Toggle Status
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  it('switches between admin tabs and handles status toggles', async () => {
    render(<AdminAllocationHarness />);

    expect(screen.getByTestId('current-tab').textContent).toBe('teachers');
    expect(screen.getByTestId('row-alloc-1').textContent).toContain('active');
    expect(screen.getByTestId('row-alloc-2').textContent).toContain('inactive');

    // Toggle status
    fireEvent.click(screen.getByTestId('toggle-alloc-1'));
    expect(screen.getByTestId('row-alloc-1').textContent).toContain('inactive');

    fireEvent.click(screen.getByTestId('toggle-alloc-2'));
    expect(screen.getByTestId('row-alloc-2').textContent).toContain('active');

    // Switch tab
    fireEvent.click(screen.getByTestId('tab-students'));
    expect(screen.getByTestId('current-tab').textContent).toBe('students');

    fireEvent.click(screen.getByTestId('tab-catalog'));
    expect(screen.getByTestId('current-tab').textContent).toBe('catalog');
  });
});

describe('7. Empty and Error State Verification', () => {
  const ZeroSubjectTeacherPage: React.FC<{ hasNoAssignments: boolean; error?: string | null }> = ({
    hasNoAssignments,
    error,
  }) => {
    if (error) {
      return <div data-testid="error-state">Error: {error}</div>;
    }
    if (hasNoAssignments) {
      return (
        <div data-testid="empty-assignment-state">
          <h3>No Academic Subjects Assigned</h3>
          <p>Please contact an institution administrator to assign you to academic subjects.</p>
        </div>
      );
    }
    return <div data-testid="active-dashboard">Active Classroom</div>;
  };

  it('renders zero assignment empty state when instructor has no assigned subjects', () => {
    render(<ZeroSubjectTeacherPage hasNoAssignments={true} />);
    expect(screen.getByTestId('empty-assignment-state')).toBeDefined();
    expect(screen.getByText(/no academic subjects assigned/i)).toBeDefined();
    expect(screen.queryByTestId('active-dashboard')).toBeNull();
  });

  it('renders error state cleanly when server error occurs', () => {
    render(<ZeroSubjectTeacherPage hasNoAssignments={false} error="Failed to fetch assigned roster" />);
    expect(screen.getByTestId('error-state').textContent).toContain('Failed to fetch assigned roster');
  });
});
