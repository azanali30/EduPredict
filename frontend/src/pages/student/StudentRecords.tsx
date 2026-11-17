import React from 'react';
import { EmptyState } from '../../components/common/EmptyState';
import { BookOpen } from 'lucide-react';

export const StudentRecords: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Academic Records</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          View logged term coursework metrics, historical exam scores, and subject marks
        </p>
      </div>

      <div className="card">
        <EmptyState
          icon={<BookOpen size={32} color="var(--brand-blue)" />}
          title="No Academic Records Found"
          description="Academic records will be populated as terms conclude or when imported during the dataset integration phase."
        />
      </div>
    </div>
  );
};
