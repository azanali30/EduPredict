import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { SubjectItem } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/forms/Button';
import { InputField } from '../../components/forms/InputField';
import { Modal } from '../../components/common/Modal';
import {
  BookOpen,
  Plus,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export const AdminCurriculum: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [canonicalKey, setCanonicalKey] = useState('');
  const [department, setDepartment] = useState('General');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSubjects = async () => {
    try {
      const res = await api.adminListSubjects();
      setSubjects(res.subjects || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load curriculum catalog.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name || !canonicalKey) {
      setError('Subject Code, Name, and Canonical Key are required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.adminCreateSubject({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        canonical_key: canonicalKey.trim().toLowerCase(),
        department: department.trim(),
        description: description.trim(),
      });
      setIsModalOpen(false);
      setCode('');
      setName('');
      setCanonicalKey('');
      setDescription('');
      fetchSubjects();
    } catch (err: any) {
      setError(err?.message || 'Failed to create subject.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (subject: SubjectItem) => {
    const currentActive = subject.is_active !== false;
    try {
      await api.adminUpdateSubjectStatus(subject.id, !currentActive);
      fetchSubjects();
    } catch (err: any) {
      setError(err?.message || 'Failed to update subject status.');
    }
  };

  if (loading) {
    return <LoadingState title="Loading Subject & Curriculum Catalog..." description="Retrieving canonical course definitions." />;
  }

  const activeSubjects = subjects.filter((s) => s.is_active !== false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Subject & Curriculum Catalog"
          subtitle="Define canonical academic disciplines, manage curriculum catalogs, and govern course active statuses."
          icon={<BookOpen size={24} className="text-brand-royal" />}
        />
        <Button
          variant="primary"
          leftIcon={<Plus size={16} />}
          onClick={() => setIsModalOpen(true)}
          className="shadow-glow shrink-0"
        >
          Add New Subject
        </Button>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Canonical Subjects"
          value={subjects.length}
          subtitle="Curriculum disciplines defined"
          icon={<BookOpen size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Active Course Offerings"
          value={activeSubjects.length}
          subtitle="Available for allocation & enrollment"
          icon={<CheckCircle2 size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Archived Subjects"
          value={subjects.length - activeSubjects.length}
          subtitle="Deactivated curriculum offerings"
          icon={<XCircle size={20} className="text-slate-400" />}
        />
      </div>

      {/* Subject Catalog Table */}
      <SectionCard
        title="Curriculum Catalog Directory"
        subtitle="Browse academic disciplines, target evaluation scales, and canonical system keys."
      >
        {subjects.length === 0 ? (
          <EmptyState
            title="No Subjects Defined"
            description="The curriculum catalog is empty. Click 'Add New Subject' to create the first offering."
            icon={<BookOpen size={32} />}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Discipline Name</th>
                  <th>Canonical Key</th>
                  <th>Department</th>
                  <th>Target Scale</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => {
                  const isActive = s.is_active !== false;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="font-mono font-bold text-xs text-brand-royal">{s.code}</td>
                      <td className="font-bold text-navy-900">{s.name}</td>
                      <td className="font-mono text-xs text-slate-500">{s.canonical_key}</td>
                      <td>
                        <span className="badge bg-slate-100 text-slate-700 text-xs">
                          {s.department || 'General'}
                        </span>
                      </td>
                      <td className="text-xs text-slate-600 font-medium">
                        {s.target_scale || '0–20 (Portuguese Standard)'}
                      </td>
                      <td>
                        <StatusBadge
                          status={isActive ? 'Active' : 'Inactive'}
                          type={isActive ? 'success' : 'neutral'}
                        />
                      </td>
                      <td className="text-right">
                        <Button
                          variant={isActive ? 'outline' : 'secondary'}
                          size="sm"
                          onClick={() => handleToggleStatus(s)}
                          className="text-xs py-1 px-2.5"
                        >
                          {isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Add Subject Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Academic Subject"
      >
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <InputField
            label="Subject Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. MATH-101, PORT-102"
            required
          />
          <InputField
            label="Subject Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mathematics, Portuguese Language"
            required
          />
          <InputField
            label="Canonical Key (Unique System Identifier)"
            value={canonicalKey}
            onChange={(e) => setCanonicalKey(e.target.value)}
            placeholder="e.g. mathematics, portuguese"
            required
          />
          <InputField
            label="Academic Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="e.g. Mathematics & Sciences, Languages"
          />
          <div>
            <label className="label">Description / Syllabus Overview</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of learning outcomes..."
              className="input h-20 text-xs sm:text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Create Subject
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
