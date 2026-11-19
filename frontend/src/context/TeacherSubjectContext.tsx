import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { SubjectItem } from '../types';
import { useAuth } from './AuthContext';
import { BookOpen, AlertCircle, ChevronDown, Check } from 'lucide-react';

interface TeacherSubjectContextType {
  subjects: SubjectItem[];
  assignedSubjects: SubjectItem[];
  selectedSubject: SubjectItem | null;
  selectedSubjectId: string | null;
  setSelectedSubjectId: (id: string) => void;
  loading: boolean;
  error: string | null;
  refreshSubjects: () => Promise<void>;
  hasNoAssignments: boolean;
}

const TeacherSubjectContext = createContext<TeacherSubjectContextType | undefined>(undefined);

export const TeacherSubjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubjectId, setSelectedSubjectIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubjects = useCallback(async () => {
    if (!user || user.role !== 'teacher') {
      setSubjects([]);
      setSelectedSubjectIdState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.getTeacherSubjects();
      const list = res?.subjects || [];
      setSubjects(list);

      // Validate or reset selected subject
      setSelectedSubjectIdState((prevId) => {
        if (list.length === 0) return null;
        if (prevId && list.some((s) => s.id === prevId)) return prevId;
        return list[0].id;
      });
    } catch (err: any) {
      console.error('Failed to load teacher assigned subjects:', err);
      setError(err?.message || 'Failed to fetch authorized academic subjects.');
      setSubjects([]);
      setSelectedSubjectIdState(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const setSelectedSubjectId = (id: string) => {
    if (subjects.some((s) => s.id === id)) {
      setSelectedSubjectIdState(id);
    }
  };

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId) || null;
  const hasNoAssignments = !loading && subjects.length === 0;

  return (
    <TeacherSubjectContext.Provider
      value={{
        subjects,
        assignedSubjects: subjects,
        selectedSubject,
        selectedSubjectId,
        setSelectedSubjectId,
        loading,
        error,
        refreshSubjects: fetchSubjects,
        hasNoAssignments,
      }}
    >
      {children}
    </TeacherSubjectContext.Provider>
  );
};

export const useTeacherSubject = (): TeacherSubjectContextType => {
  const context = useContext(TeacherSubjectContext);
  if (!context) {
    throw new Error('useTeacherSubject must be used within a TeacherSubjectProvider');
  }
  return context;
};

interface TeacherSubjectSelectorProps {
  className?: string;
  showLabel?: boolean;
}

export const TeacherSubjectSelector: React.FC<TeacherSubjectSelectorProps> = ({
  className = '',
  showLabel = true,
}) => {
  const { subjects, selectedSubject, selectedSubjectId, setSelectedSubjectId, loading, hasNoAssignments } =
    useTeacherSubject();
  const [isOpen, setIsOpen] = useState(false);

  if (loading) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 animate-pulse text-xs text-slate-400 ${className}`}>
        <BookOpen size={14} className="text-slate-400" />
        <span>Loading subjects...</span>
      </div>
    );
  }

  if (hasNoAssignments) {
    return (
      <div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold ${className}`}
        title="No active subject assignments. Please contact an administrator."
      >
        <AlertCircle size={14} className="text-amber-600 shrink-0" />
        <span>No Assigned Subjects</span>
      </div>
    );
  }

  if (subjects.length === 1) {
    const s = subjects[0];
    return (
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-50/70 border border-brand-200/80 text-brand-900 text-xs font-bold shadow-sm ${className}`}
      >
        <BookOpen size={14} className="text-brand-600 shrink-0" />
        <span>{s.name}</span>
        {s.code && (
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-brand-100 text-brand-700">
            {s.code}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`relative inline-block text-left ${className}`}>
      {showLabel && (
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
          Active Academic Subject
        </span>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:border-brand-300 text-navy-900 text-xs font-bold shadow-sm hover:shadow transition-all cursor-pointer min-w-[200px]"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 truncate">
          <BookOpen size={15} className="text-brand-600 shrink-0" />
          <span className="truncate">{selectedSubject ? selectedSubject.name : 'Select Subject'}</span>
          {selectedSubject?.code && (
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
              {selectedSubject.code}
            </span>
          )}
        </div>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-1.5 w-60 rounded-xl bg-white border border-slate-200 shadow-xl z-40 py-1 overflow-hidden animate-in fade-in duration-150">
            <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Assigned Subjects ({subjects.length})
              </span>
            </div>
            <div className="max-h-60 overflow-y-auto py-1">
              {subjects.map((subj) => {
                const isSelected = subj.id === selectedSubjectId;
                return (
                  <button
                    key={subj.id}
                    type="button"
                    onClick={() => {
                      setSelectedSubjectId(subj.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-brand-50 text-brand-900 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-navy-900 font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">{subj.name}</span>
                      {subj.code && (
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          {subj.code}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check size={14} className="text-brand-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
