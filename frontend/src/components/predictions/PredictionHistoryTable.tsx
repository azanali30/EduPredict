import React, { useState } from 'react';
import { PredictionRecord } from '../../types';
import { EmptyState } from '../common/EmptyState';
import { Button } from '../forms/Button';
import { PredictionDetailModal } from './PredictionDetailModal';
import {
  History,
  Filter,
  Eye,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface PredictionHistoryTableProps {
  predictions: PredictionRecord[];
  loading?: boolean;
  onRefresh?: () => void;
  showStudentColumn?: boolean;
}

export const PredictionHistoryTable: React.FC<PredictionHistoryTableProps> = ({
  predictions,
  onRefresh,
  showStudentColumn = false,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedMilestone, setSelectedMilestone] = useState<string>('ALL');
  const [selectedRisk, setSelectedRisk] = useState<string>('ALL');
  const [inspectRecord, setInspectRecord] = useState<PredictionRecord | null>(null);

  const filtered = predictions.filter((p) => {
    if (selectedSubject !== 'ALL' && p.subject !== selectedSubject) return false;
    if (selectedMilestone !== 'ALL' && p.milestone.toString() !== selectedMilestone) return false;
    if (selectedRisk !== 'ALL' && p.predicted_status !== selectedRisk) return false;
    return true;
  });

  const getRiskBadge = (status: string) => {
    switch (status) {
      case 'High Risk':
        return (
          <span className="badge bg-rose-100 text-rose-800 border-rose-200 text-[10px] font-bold flex items-center gap-1">
            <AlertTriangle size={12} className="text-rose-600" />
            High Risk
          </span>
        );
      case 'Moderate Risk':
        return (
          <span className="badge bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-bold flex items-center gap-1">
            <AlertCircle size={12} className="text-amber-600" />
            Moderate Risk
          </span>
        );
      case 'Low Risk / On Track':
      default:
        return (
          <span className="badge bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-600" />
            Low Risk
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Table Filters */}
      <div className="card p-4 border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Subject Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-400 font-semibold">Subject:</span>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-brand-500"
            >
              <option value="ALL">All Subjects</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Portuguese Language">Portuguese Language</option>
            </select>
          </div>

          {/* Milestone Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-400 font-semibold">Milestone:</span>
            <select
              value={selectedMilestone}
              onChange={(e) => setSelectedMilestone(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-brand-500"
            >
              <option value="ALL">All Milestones</option>
              <option value="0">Milestone 0 (Early Warning)</option>
              <option value="1">Milestone 1 (Mid-Term)</option>
              <option value="2">Milestone 2 (Pre-Final)</option>
            </select>
          </div>

          {/* Risk Level Filter */}
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-400 font-semibold">Risk:</span>
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-brand-500"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="High Risk">High Risk</option>
              <option value="Moderate Risk">Moderate Risk</option>
              <option value="Low Risk / On Track">Low Risk / On Track</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-semibold">
            {filtered.length} of {predictions.length} records
          </span>
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Table Content */}
      {predictions.length === 0 ? (
        <div className="card p-8 border-slate-200">
          <EmptyState
            icon={<History size={36} className="text-slate-400" />}
            title="No Prediction Records Found"
            description="Generated predictions will be securely archived here with timestamped indicators and model provenance."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 border-slate-200">
          <EmptyState
            icon={<Filter size={36} className="text-slate-400" />}
            title="No Records Match Active Filters"
            description="Try adjusting your subject or milestone filter settings above."
          />
        </div>
      ) : (
        <div className="data-table-container shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                {showStudentColumn && <th>Student ID</th>}
                <th>Subject</th>
                <th>Milestone</th>
                <th>Projected Mark</th>
                <th>Risk Category</th>
                <th>Top Confidence</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) => (
                <tr key={record.id}>
                  <td className="text-xs text-slate-600 whitespace-nowrap">
                    {new Date(record.created_at).toLocaleString(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  {showStudentColumn && (
                    <td className="font-mono text-xs text-slate-500">
                      {record.student_id ? record.student_id.slice(-8) : 'N/A'}
                    </td>
                  )}
                  <td>
                    <span className="font-semibold text-navy-900 text-xs">
                      {record.subject}
                    </span>
                  </td>
                  <td>
                    <span className="badge bg-slate-100 text-slate-700 text-[10px] font-semibold">
                      M{record.milestone}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-navy-950 text-xs">
                        {record.predicted_marks.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-slate-400">/ 100</span>
                    </div>
                  </td>
                  <td>{getRiskBadge(record.predicted_status)}</td>
                  <td>
                    <div className="font-mono text-xs text-slate-700 font-medium">
                      {(record.top_confidence * 100).toFixed(1)}%
                    </div>
                  </td>
                  <td>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setInspectRecord(record)}
                      leftIcon={<Eye size={13} />}
                    >
                      Audit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Details Modal */}
      <PredictionDetailModal
        prediction={inspectRecord}
        isOpen={!!inspectRecord}
        onClose={() => setInspectRecord(null)}
      />
    </div>
  );
};
