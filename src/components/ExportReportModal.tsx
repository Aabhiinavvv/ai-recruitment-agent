import React, { useState } from 'react';
import { Candidate, AuditEvent, HiringBrief, OutreachDraft } from '../types';
import {
  exportFormattedPDFReport,
  exportCandidateEvaluationCSV,
  exportAuditLogsCSV,
  exportCombinedHRReportCSV,
} from '../services/reportExportService';
import {
  FileText,
  FileSpreadsheet,
  Download,
  X,
  CheckCircle2,
  SlidersHorizontal,
  Calendar,
  Layers,
  Sparkles,
  Check,
  ShieldCheck,
  Archive,
} from 'lucide-react';

interface ExportReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  brief: HiringBrief | null;
  candidates: Candidate[];
  auditEvents: AuditEvent[];
  outreachQueue?: OutreachDraft[];
  cutoffScore?: number;
  appendAudit?: (actor: string, action: string, subject: string) => void;
}

type ExportFormat = 'pdf' | 'csv_candidates' | 'csv_audit' | 'csv_combined';

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  isOpen,
  onClose,
  brief,
  candidates,
  auditEvents,
  outreachQueue = [],
  cutoffScore = 75,
  appendAudit,
}) => {
  if (!isOpen) return null;

  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [reportTitle, setReportTitle] = useState<string>(
    `${brief?.job_title || 'AI/ML Engineer'} — Candidate Evaluation & Workflow Audit Report`
  );
  const [reportNotes, setReportNotes] = useState<string>(
    'Official Talent Acquisition record compiled for executive review, hiring decisions, and regulatory compliance.'
  );
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [onlyAboveCutoff, setOnlyAboveCutoff] = useState<boolean>(false);
  const [includeAuditLogs, setIncludeAuditLogs] = useState<boolean>(true);
  const [includeOutreachStatus, setIncludeOutreachStatus] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Compute preview count of candidates meeting scope
  const targetCandidates = candidates.filter((c) => {
    if (onlyAboveCutoff && c.overall_score < cutoffScore) return false;
    if (stageFilter !== 'all' && (c.stage || 'Screening') !== stageFilter) return false;
    return true;
  });

  const handleExecuteExport = () => {
    setIsExporting(true);
    setDownloadSuccess(null);

    setTimeout(() => {
      try {
        const options = {
          brief,
          candidates,
          auditEvents,
          outreachQueue,
          cutoffScore,
          reportTitle,
          reportNotes,
          includeAuditLogs,
          includeOutreachStatus,
          stageFilter,
          onlyAboveCutoff,
        };

        if (format === 'pdf') {
          exportFormattedPDFReport(options);
          setDownloadSuccess('Executive PDF report downloaded successfully');
          appendAudit?.(
            'Recruiter',
            `Exported formatted PDF HR report (${targetCandidates.length} candidates, ${auditEvents.length} audit logs)`,
            brief?.job_title || 'Role'
          );
        } else if (format === 'csv_candidates') {
          exportCandidateEvaluationCSV(options);
          setDownloadSuccess('Candidate evaluation CSV downloaded');
          appendAudit?.(
            'Recruiter',
            `Exported candidate evaluation summary CSV (${targetCandidates.length} candidates)`,
            brief?.job_title || 'Role'
          );
        } else if (format === 'csv_audit') {
          exportAuditLogsCSV(options);
          setDownloadSuccess('Workflow audit logs CSV downloaded');
          appendAudit?.(
            'Recruiter',
            `Exported recruitment workflow audit trail CSV (${auditEvents.length} events)`,
            brief?.job_title || 'Role'
          );
        } else if (format === 'csv_combined') {
          exportCombinedHRReportCSV(options);
          setDownloadSuccess('Complete HR records CSV package downloaded');
          appendAudit?.(
            'Recruiter',
            `Exported combined HR records package CSV (${targetCandidates.length} candidates, ${auditEvents.length} logs)`,
            brief?.job_title || 'Role'
          );
        }
      } catch (err) {
        console.error('Export error:', err);
      } finally {
        setIsExporting(false);
      }
    }, 250);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-100 text-[#6743ee] flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 id="export-modal-title" className="text-sm font-bold text-slate-900">
                Export Candidate Evaluation & Audit Report
              </h2>
              <p className="text-xs text-slate-500">
                Generate formatted PDF or CSV reports for HR records, hiring manager reviews, and compliance.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg cursor-pointer"
            aria-label="Close export modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs">
          {downloadSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{downloadSuccess}</span>
            </div>
          )}

          {/* Format Selector Cards */}
          <div className="space-y-2">
            <label className="block font-semibold text-slate-800">
              Select Export Format *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: 'pdf' as const,
                  title: 'Formatted Executive PDF Report',
                  badge: 'Recommended',
                  badgeColor: 'bg-purple-100 text-[#6743ee]',
                  desc: 'Multi-page formal report with KPI metrics, 6-dimension evaluation table, compliance audit trail, and page numbering.',
                  icon: FileText,
                  iconColor: 'text-[#6743ee]',
                },
                {
                  id: 'csv_combined' as const,
                  title: 'Combined HR Records Package (.csv)',
                  badge: 'Complete Package',
                  badgeColor: 'bg-emerald-100 text-emerald-800',
                  desc: 'Comprehensive multi-section CSV with brief metadata, candidate evaluations, audit logs, and outreach reminder status.',
                  icon: Archive,
                  iconColor: 'text-emerald-600',
                },
                {
                  id: 'csv_candidates' as const,
                  title: 'Candidate Evaluation Summary (.csv)',
                  desc: 'Raw spreadsheet data of candidate scores, 6 rubric dimensions, verified strengths, and decision statuses.',
                  icon: FileSpreadsheet,
                  iconColor: 'text-blue-600',
                },
                {
                  id: 'csv_audit' as const,
                  title: 'Workflow Audit Logs (.csv)',
                  desc: 'Chronological compliance trail of recruiter actions, screening events, and automated reminder alerts.',
                  icon: ShieldCheck,
                  iconColor: 'text-amber-600',
                },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = format === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setFormat(item.id)}
                    className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'border-[#6743ee] bg-purple-50/40 ring-1 ring-[#6743ee]/30'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 shrink-0 ${item.iconColor}`} />
                        <span className="font-bold text-slate-900 text-xs">{item.title}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${item.badgeColor}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Report Customization Inputs */}
          <div className="space-y-3 pt-1 border-t border-slate-100">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Report Document Title
              </label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#6743ee]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                HR Audit Memo / Executive Sign-Off (Optional)
              </label>
              <input
                type="text"
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="e.g. Approved for hiring committee distribution by HR Director..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#6743ee]"
              />
            </div>
          </div>

          {/* Scope Filters & Options */}
          <div className="space-y-3 pt-1 border-t border-slate-100">
            <div className="font-semibold text-slate-800">Export Scope & Filters</div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-1 text-[11px]">
                  Filter Candidates by Stage:
                </label>
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#6743ee]"
                >
                  <option value="all">All Stages ({candidates.length} candidates)</option>
                  <option value="Screening">Stage: Screening</option>
                  <option value="Technical">Stage: Technical</option>
                  <option value="Interview">Stage: Interview</option>
                  <option value="Offered">Stage: Offered</option>
                  <option value="Rejected">Stage: Rejected</option>
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 py-1.5">
                  <input
                    type="checkbox"
                    checked={onlyAboveCutoff}
                    onChange={(e) => setOnlyAboveCutoff(e.target.checked)}
                    className="accent-[#6743ee] rounded"
                  />
                  <span>Only include candidates &ge; cutoff ({cutoffScore}%)</span>
                </label>
              </div>
            </div>

            {format === 'pdf' && (
              <div className="flex flex-wrap items-center gap-4 pt-1 text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAuditLogs}
                    onChange={(e) => setIncludeAuditLogs(e.target.checked)}
                    className="accent-[#6743ee] rounded"
                  />
                  <span>Include Section 2: Recruitment Workflow Audit Logs</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeOutreachStatus}
                    onChange={(e) => setIncludeOutreachStatus(e.target.checked)}
                    className="accent-[#6743ee] rounded"
                  />
                  <span>Include Section 3: Outreach & Follow-Up Reminder Queue</span>
                </label>
              </div>
            )}
          </div>

          {/* Scope Live Preview Strip */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-slate-600">
            <div className="space-y-0.5">
              <span className="font-semibold text-slate-900 block">Export Scope Summary:</span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                <span>
                  Candidates: <strong className="text-slate-900">{targetCandidates.length}</strong> of {candidates.length}
                </span>
                <span>·</span>
                <span>
                  Audit Events: <strong className="text-slate-900">{auditEvents.length}</strong>
                </span>
                <span>·</span>
                <span>
                  Outreach Records: <strong className="text-slate-900">{outreachQueue.length}</strong>
                </span>
              </div>
            </div>
            <span className="font-mono text-[11px] text-[#6743ee] font-semibold">
              Format: {format === 'pdf' ? 'Executive PDF' : 'RFC-4180 CSV'}
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleExecuteExport}
            disabled={isExporting}
            className="px-4 py-2 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {isExporting
                ? 'Generating Report...'
                : format === 'pdf'
                ? 'Download Formatted PDF Report'
                : 'Download CSV Report'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
