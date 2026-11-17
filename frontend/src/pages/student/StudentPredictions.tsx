import React from 'react';
import { BrainCircuit, Sparkles, AlertTriangle, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/forms/Button';

export const StudentPredictions: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 text-[11px] font-bold uppercase tracking-wider mb-2 border border-sky-200">
          <BrainCircuit size={14} className="text-sky-600" />
          <span>Predictive Intelligence Engine</span>
        </div>
        <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
          AI Performance Predictions & Risk Model
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Expected final marks estimation, academic risk classification, and early warning interventions
        </p>
      </div>

      {/* Main Status Hero Card */}
      <div className="card p-8 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-850 text-white relative overflow-hidden shadow-soft">
        <div className="max-w-2xl relative z-10 space-y-4">
          <span className="badge bg-amber-400/20 text-amber-300 border-amber-400/30 font-semibold text-[11px]">
            Model Pipeline Status: Awaiting Phase 4 Training
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Supervised Machine Learning Inference Hub
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            The EduPredict machine learning system trains regression models to forecast numeric exam marks and classification algorithms to identify student risk levels. In accordance with the project architecture roadmap, model training occurs in Phase 4 and inference endpoints deploy in Phase 5.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link to="/student/records">
              <Button variant="primary" leftIcon={<Layers size={16} />}>
                Review Required Indicators
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Predictive Models Architecture Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card p-6 border-slate-200">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-navy-900">Projected Marks Regressor</h3>
                <span className="text-xs text-slate-400">Continuous Output: 0.0% – 100.0%</span>
              </div>
            </div>
            <span className="badge badge-warning text-[10px]">Phase 4 Model</span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            Employs Scikit-learn regressors (Linear Regression, Ridge, and Random Forest) to evaluate historical coursework variables—attendance rate, study rhythm, and quiz marks—to output expected percentage marks with confidence intervals.
          </p>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Model Algorithm</span>
              <span className="font-semibold text-slate-800">Scikit-learn Ensemble Regressor</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Primary Input Features</span>
              <span className="font-semibold text-slate-800">Attendance, Study Hours, Quizzes</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Status</span>
              <span className="badge badge-info text-[9px] py-0 px-2">Ready for Weights</span>
            </div>
          </div>
        </div>

        <div className="card p-6 border-slate-200">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-navy-900">Academic Risk Classifier</h3>
                <span className="text-xs text-slate-400">Discrete Classes: Low, Moderate, High</span>
              </div>
            </div>
            <span className="badge badge-warning text-[10px]">Phase 4 Model</span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed mb-4">
            Multi-class classification pipeline designed to flag students who fall below threshold performance metrics, activating early warning notifications for instructors and teachers before final exam assessments.
          </p>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Model Algorithm</span>
              <span className="font-semibold text-slate-800">Random Forest / Logistic Classifier</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Output Tiers</span>
              <span className="font-semibold text-slate-800">High Risk • Moderate • On Track</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Status</span>
              <span className="badge badge-info text-[9px] py-0 px-2">Ready for Weights</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
