import React, { useState } from 'react';
import { 
  Candidate, 
  HiringStage, 
  HiringBrief, 
  AuditEvent, 
  EmailDraftType 
} from '../types';
import { getCandidateStage } from './HiringWorkflowTab';
import { 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  Mail, 
  FileText, 
  Eye, 
  MoreVertical, 
  UserCheck, 
  XCircle, 
  Layers, 
  Award, 
  Tag, 
  Search, 
  MoveRight,
  Filter,
  SlidersHorizontal,
  ChevronRight,
  Calendar,
  Briefcase,
  Scale
} from 'lucide-react';

interface CandidateKanbanBoardProps {
  candidates: Candidate[];
  brief: HiringBrief | null;
  cutoffScore?: number;
  onStageChange: (candidateId: string, newStage: HiringStage) => void;
  onOpenEmailModal: (candidate: Candidate, type?: EmailDraftType) => void;
  onInspectCandidate: (candidateId: string) => void;
  onSaveNotes: (candidateId: string, notes: string) => void;
  auditEvents: AuditEvent[];
  onOpenLinkedInImport?: () => void;
  onOpenPersona?: (candidate: Candidate) => void;
  onLaunchCompare?: (candidateAId?: string, candidateBId?: string) => void;
  onOpenScheduler?: (candidate: Candidate) => void;
}

const STAGES: { stage: HiringStage; label: string; desc: string; color: string; badgeColor: string; headerBg: string }[] = [
  {
    stage: 'Screening',
    label: 'Screening',
    desc: 'Resume parsing & 6-dimension evaluation',
    color: 'border-blue-300 bg-blue-50/40 text-blue-900',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    headerBg: 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
  },
  {
    stage: 'Technical',
    label: 'Technical Round',
    desc: 'Adaptive coding challenge & system design',
    color: 'border-purple-300 bg-purple-50/40 text-purple-900',
    badgeColor: 'bg-purple-100 text-[#5b43d6] border-purple-200',
    headerBg: 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200'
  },
  {
    stage: 'Interview',
    label: 'Interview',
    desc: 'Engineering leadership & HR culture assessment',
    color: 'border-amber-300 bg-amber-50/40 text-amber-900',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    headerBg: 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
  },
  {
    stage: 'Offered',
    label: 'Offered / Hired',
    desc: 'Formal offer extended & onboarding prep',
    color: 'border-emerald-300 bg-emerald-50/40 text-emerald-900',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    headerBg: 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200'
  },
  {
    stage: 'Rejected',
    label: 'Rejected / Archived',
    desc: 'Not proceeding; archived to talent community',
    color: 'border-slate-300 bg-slate-50/60 text-slate-800',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    headerBg: 'bg-gradient-to-r from-slate-100 to-rose-50 border-slate-200'
  }
];

export const CandidateKanbanBoard: React.FC<CandidateKanbanBoardProps> = ({
  candidates,
  brief,
  cutoffScore = 75,
  onStageChange,
  onOpenEmailModal,
  onInspectCandidate,
  onSaveNotes,
  auditEvents,
  onOpenLinkedInImport,
  onOpenPersona,
  onLaunchCompare,
  onOpenScheduler,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [draggedCandidateId, setDraggedCandidateId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<HiringStage | null>(null);
  const [hideRejectedColumn, setHideRejectedColumn] = useState<boolean>(false);
  const [selectedQuickSkill, setSelectedQuickSkill] = useState<string | null>(null);

  // Filter candidates by search term and selected skill
  const filteredCandidates = candidates.filter(cand => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || 
      cand.name.toLowerCase().includes(q) || 
      cand.email.toLowerCase().includes(q) || 
      cand.candidate_id.toLowerCase().includes(q) ||
      Object.keys(cand.skill_scores || {}).some(s => s.toLowerCase().includes(q));

    const matchesSkill = !selectedQuickSkill ||
      Object.keys(cand.skill_scores || {}).some(s => s.toLowerCase() === selectedQuickSkill.toLowerCase());

    return matchesSearch && matchesSkill;
  });

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, candidateId: string) => {
    e.dataTransfer.setData('text/plain', candidateId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedCandidateId(candidateId);
  };

  const handleDragOver = (e: React.DragEvent, stage: HiringStage) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stage) {
      setDragOverStage(stage);
    }
  };

  const handleDragLeave = (e: React.DragEvent, stage: HiringStage) => {
    e.preventDefault();
    if (dragOverStage === stage) {
      setDragOverStage(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStage: HiringStage) => {
    e.preventDefault();
    const candidateId = e.dataTransfer.getData('text/plain') || draggedCandidateId;
    setDragOverStage(null);
    setDraggedCandidateId(null);

    if (!candidateId) return;
    const cand = candidates.find(c => c.candidate_id === candidateId);
    if (!cand) return;

    const currentStage = getCandidateStage(cand);
    if (currentStage !== targetStage) {
      onStageChange(candidateId, targetStage);
    }
  };

  const visibleStages = STAGES.filter(s => !hideRejectedColumn || s.stage !== 'Rejected');

  // Step candidate one stage forward or backward
  const handleStepStage = (cand: Candidate, direction: 'forward' | 'backward') => {
    const current = getCandidateStage(cand);
    const order: HiringStage[] = ['Screening', 'Technical', 'Interview', 'Offered'];
    const currentIndex = order.indexOf(current);

    if (direction === 'forward') {
      if (currentIndex >= 0 && currentIndex < order.length - 1) {
        onStageChange(cand.candidate_id, order[currentIndex + 1]);
      } else if (current === 'Rejected') {
        onStageChange(cand.candidate_id, 'Screening');
      }
    } else {
      if (currentIndex > 0) {
        onStageChange(cand.candidate_id, order[currentIndex - 1]);
      } else if (current === 'Screening') {
        onStageChange(cand.candidate_id, 'Rejected');
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Board Controls: Search & Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        {/* Search in Kanban */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter kanban cards by candidate name, skill, or ID..."
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
          />
        </div>

        {/* Column & View options */}
        <div className="flex flex-wrap items-center gap-3">
          {onLaunchCompare && candidates.length >= 2 && (
            <button
              type="button"
              onClick={() => onLaunchCompare()}
              className="px-2.5 py-1 bg-gradient-to-r from-[#6743ee] to-teal-600 hover:from-[#5637d2] hover:to-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all hover:shadow-xs active:scale-95"
              title="Launch head-to-head split-screen comparison for candidates"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>⚡ Split-Screen Compare</span>
            </button>
          )}

          {onOpenLinkedInImport && (
            <button
              type="button"
              onClick={onOpenLinkedInImport}
              className="px-2.5 py-1 bg-[#0a66c2] hover:bg-[#004182] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all hover:shadow-xs active:scale-95"
              title="Import and generate candidates from LinkedIn with AI agent"
            >
              <span className="w-3.5 h-3.5 rounded bg-white text-[#0a66c2] font-black text-[9px] flex items-center justify-center leading-none">
                in
              </span>
              <span>Import from LinkedIn</span>
            </button>
          )}

          <label className="flex items-center gap-1.5 text-slate-600 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={hideRejectedColumn}
              onChange={(e) => setHideRejectedColumn(e.target.checked)}
              className="accent-[#6743ee] rounded"
            />
            <span>Hide Rejected Column</span>
          </label>

          <span className="text-slate-300">|</span>

          <span className="text-slate-500 font-medium">
            Showing <strong className="text-slate-900">{filteredCandidates.length}</strong> of {candidates.length} candidates
          </span>
        </div>
      </div>

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 items-start overflow-x-auto pb-4">
        {visibleStages.map(({ stage, label, desc, color, badgeColor, headerBg }) => {
          const stageCandidates = filteredCandidates.filter(c => getCandidateStage(c) === stage);
          const isOver = dragOverStage === stage;
          const avgScore = stageCandidates.length > 0 
            ? Math.round(stageCandidates.reduce((acc, c) => acc + c.overall_score, 0) / stageCandidates.length)
            : 0;

          return (
            <div
              key={stage}
              onDragOver={(e) => handleDragOver(e, stage)}
              onDragLeave={(e) => handleDragLeave(e, stage)}
              onDrop={(e) => handleDrop(e, stage)}
              className={`rounded-2xl border transition-all flex flex-col min-h-[480px] ${
                isOver 
                  ? 'border-2 border-dashed border-[#6743ee] bg-purple-50/70 ring-2 ring-[#6743ee]/20' 
                  : 'border-slate-200/90 bg-slate-50/70'
              }`}
            >
              {/* Column Header */}
              <div className={`p-3.5 rounded-t-2xl border-b ${headerBg} space-y-1`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs ${badgeColor}`}>
                      {stageCandidates.length}
                    </span>
                  </div>
                  {avgScore > 0 && (
                    <span className="text-[10px] font-semibold text-slate-500" title="Average AI score in this stage">
                      Avg: <strong className="text-slate-800">{avgScore}%</strong>
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 truncate" title={desc}>
                  {desc}
                </p>
              </div>

              {/* Column Dropzone / Cards List */}
              <div className="p-2.5 flex-1 space-y-2.5 overflow-y-auto max-h-[640px]">
                {stageCandidates.length === 0 ? (
                  <div className={`h-32 rounded-xl border border-dashed flex flex-col items-center justify-center text-center p-3 transition-colors ${
                    isOver ? 'border-[#6743ee] bg-purple-100/30 text-[#6743ee]' : 'border-slate-200 text-slate-400'
                  }`}>
                    <Layers className="w-5 h-5 mb-1 opacity-50" />
                    <span className="text-[11px] font-medium">
                      {isOver ? 'Drop candidate here' : 'No candidates in this stage'}
                    </span>
                    <span className="text-[9px] text-slate-400 mt-0.5">Drag cards to update stage</span>
                  </div>
                ) : (
                  stageCandidates.map((cand) => {
                    const isTopScore = cand.overall_score >= cutoffScore;
                    const isDragging = draggedCandidateId === cand.candidate_id;
                    const stageOrder = ['Screening', 'Technical', 'Interview', 'Offered'];
                    const currentIdx = stageOrder.indexOf(stage);

                    return (
                      <div
                        key={cand.candidate_id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, cand.candidate_id)}
                        className={`bg-white rounded-xl border p-3 shadow-2xs hover:shadow-md transition-all space-y-2.5 cursor-grab active:cursor-grabbing group ${
                          isDragging ? 'opacity-40 scale-95 border-[#6743ee]' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {/* Card Header: Score, Name & Quick ID */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-xs text-slate-900 block truncate group-hover:text-[#6743ee] transition-colors">
                              {cand.name}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                              <span className="font-mono">{cand.candidate_id}</span>
                              <span>•</span>
                              <span className="truncate">{cand.role}</span>
                            </div>
                            {cand.persona && (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenPersona?.(cand);
                                }}
                                className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-[#5b43d6] border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
                                title={`Archetype: ${cand.persona.archetype}. Click to open full persona summary.`}
                              >
                                <Sparkles className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                <span className="truncate max-w-[130px]">{cand.persona.archetype}</span>
                              </div>
                            )}
                            {cand.digital_profile_sources?.some(s => s.source_type === 'LinkedIn') && (
                              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-50 text-[#0a66c2] border border-blue-200 ml-1">
                                <span className="w-2.5 h-2.5 rounded bg-[#0a66c2] text-white font-black text-[7px] flex items-center justify-center leading-none">
                                  in
                                </span>
                                <span>LinkedIn</span>
                              </span>
                            )}
                          </div>

                          {/* Score Badge */}
                          <div className={`shrink-0 px-2 py-0.5 rounded-lg text-xs font-black border shadow-2xs ${
                            isTopScore 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                              : cand.overall_score >= 60
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {cand.overall_score}%
                          </div>
                        </div>

                        {/* Top Verified Skill Tags */}
                        {cand.skill_scores && Object.keys(cand.skill_scores).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(cand.skill_scores).slice(0, 3).map(([sk, sc]) => (
                              <span 
                                key={sk}
                                className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-700 border border-slate-200 font-medium"
                              >
                                {sk} <strong className="text-slate-900">{sc}/10</strong>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Recruiter Private Notes Snippet if present */}
                        {cand.private_notes && (
                          <div 
                            onClick={() => onInspectCandidate(cand.candidate_id)}
                            className="p-1.5 bg-purple-50/70 border border-purple-200/80 rounded-md text-[10px] text-[#5b43d6] flex items-center gap-1.5 cursor-pointer hover:bg-purple-100/70 transition-colors"
                            title={`Note: ${cand.private_notes}`}
                          >
                            <FileText className="w-3 h-3 shrink-0" />
                            <span className="truncate italic">
                              "{cand.private_notes.replace(/\n/g, ' ')}"
                            </span>
                          </div>
                        )}

                        {/* Stage Stepper & Card Quick Actions */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]">
                          {/* Left: Quick Stage Navigation */}
                          <div className="flex items-center gap-1">
                            {stage !== 'Screening' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStepStage(cand, 'backward');
                                }}
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                                title="Move to previous stage"
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </button>
                            )}

                            {stage !== 'Offered' && stage !== 'Rejected' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStepStage(cand, 'forward');
                                }}
                                className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                title="Advance to next stage"
                              >
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}

                            <select
                              value={stage}
                              onChange={(e) => onStageChange(cand.candidate_id, e.target.value as HiringStage)}
                              className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 font-semibold focus:outline-none"
                              title="Select stage directly"
                            >
                              <option value="Screening">Screening</option>
                              <option value="Technical">Technical</option>
                              <option value="Interview">Interview</option>
                              <option value="Offered">Offered</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </div>

                          {/* Right: Action Buttons (Persona, Email & Inspect) */}
                          <div className="flex items-center gap-1">
                            {onOpenPersona && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenPersona(cand);
                                }}
                                className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                title={cand.persona ? `View ${cand.name}'s AI Persona Reel (${cand.persona.archetype})` : `Generate AI Candidate Persona summary reel for ${cand.name}`}
                              >
                                <Sparkles className={`w-3 h-3 ${cand.persona ? 'text-amber-500 fill-amber-400/20' : 'text-slate-400'}`} />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onOpenEmailModal(cand, stage === 'Rejected' ? 'rejection' : 'progress')}
                              className="p-1 text-slate-400 hover:text-[#6743ee] hover:bg-purple-50 rounded transition-colors"
                              title="Draft follow-up email with AI"
                            >
                              <Mail className="w-3 h-3 text-[#6743ee]" />
                            </button>

                            {onOpenScheduler && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenScheduler(cand);
                                }}
                                className="p-1 text-slate-400 hover:text-[#6743ee] hover:bg-purple-50 rounded transition-colors"
                                title={`Schedule interview with ${cand.name} using AI calendar availability`}
                              >
                                <Calendar className="w-3 h-3 text-[#6743ee]" />
                              </button>
                            )}

                            {onLaunchCompare && candidates.length >= 2 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onLaunchCompare(cand.candidate_id);
                                }}
                                className="p-1 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors"
                                title={`Compare ${cand.name} side-by-side with another candidate`}
                              >
                                <Scale className="w-3 h-3 text-[#0d9488]" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => onInspectCandidate(cand.candidate_id)}
                              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                              title="Inspect full candidate evaluation details & radar"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>

              {/* Column Footer Summary */}
              <div className="p-2 border-t border-slate-200/80 text-[10px] text-slate-400 flex items-center justify-between bg-white/40 rounded-b-2xl">
                <span>{stageCandidates.length} in {label}</span>
                <span className="font-mono">
                  {candidates.length > 0 ? `${Math.round((stageCandidates.length / candidates.length) * 100)}%` : '0%'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
