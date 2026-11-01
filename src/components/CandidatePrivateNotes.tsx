import React, { useState, useEffect } from 'react';
import { Candidate, AuditEvent } from '../types';
import { 
  FileText, 
  Lock, 
  Save, 
  Check, 
  RotateCcw, 
  Trash2, 
  Clock, 
  ShieldCheck, 
  Sparkles,
  AlertCircle,
  History,
  ShieldAlert
} from 'lucide-react';

interface CandidatePrivateNotesProps {
  candidate: Candidate;
  onSaveNotes: (candidateId: string, notes: string) => void;
  auditHistory?: AuditEvent[];
}

const QUICK_TAGS = [
  "Culture fit positive",
  "Comp expectation: $175k-$195k",
  "Notice period: 2 weeks",
  "Strong system design depth",
  "Follow-up on MLOps experience",
  "Reference checks verified",
  "Recommended for leadership track"
];

export const CandidatePrivateNotes: React.FC<CandidatePrivateNotesProps> = ({
  candidate,
  onSaveNotes,
  auditHistory = []
}) => {
  const [noteText, setNoteText] = useState<string>(candidate.private_notes || '');
  const [showSavedFeedback, setShowSavedFeedback] = useState<boolean>(false);
  const [showAuditTrail, setShowAuditTrail] = useState<boolean>(false);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string | undefined>(
    candidate.notes_updated_at
  );

  // Synchronize when the active candidate or their saved notes change
  useEffect(() => {
    setNoteText(candidate.private_notes || '');
    setLastSavedTimestamp(candidate.notes_updated_at);
  }, [candidate.candidate_id, candidate.private_notes, candidate.notes_updated_at]);

  const originalNotes = candidate.private_notes || '';
  const isDirty = noteText !== originalNotes;

  const handleSave = () => {
    onSaveNotes(candidate.candidate_id, noteText);
    const nowFormatted = new Date().toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    setLastSavedTimestamp(`Today at ${nowFormatted}`);
    setShowSavedFeedback(true);
    setTimeout(() => {
      setShowSavedFeedback(false);
    }, 2800);
  };

  const handleReset = () => {
    setNoteText(originalNotes);
  };

  const handleClear = () => {
    if (noteText.trim().length > 0) {
      setNoteText('');
    }
  };

  const handleInsertQuickTag = (tag: string) => {
    setNoteText(prev => {
      const trimmed = prev.trim();
      if (!trimmed) return `• ${tag}`;
      return `${trimmed}\n• ${tag}`;
    });
  };

  const characterCount = noteText.length;
  const wordCount = noteText.trim() ? noteText.trim().split(/\s+/).length : 0;

  // Filter audit history relevant to this candidate's notes or observations
  const relevantNotesAudits = auditHistory.filter(evt => 
    evt.subject.includes(candidate.candidate_id) && 
    (evt.action.toLowerCase().includes('note') || evt.action.toLowerCase().includes('observation'))
  );

  return (
    <div 
      id={`candidate-notes-${candidate.candidate_id}`}
      className="p-4 bg-slate-50/95 rounded-xl border border-slate-200/90 shadow-2xs space-y-3.5 transition-all"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-purple-100 text-[#6743ee] rounded-xl shadow-2xs">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#6743ee]" />
                <span>Notes & Private Observations</span>
              </h4>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100/80 text-emerald-800 border border-emerald-200">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Tracked in System Audit Logs
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Add private recruiter observations, interview impressions, comp expectations, or reference checks for {candidate.name}.
            </p>
          </div>
        </div>

        {/* Status indicator badges */}
        <div className="flex items-center gap-2 text-[11px]">
          {showSavedFeedback ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              Note Saved & Audited
            </span>
          ) : isDirty ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              <AlertCircle className="w-3 h-3 text-amber-600" />
              Unsaved observation
            </span>
          ) : lastSavedTimestamp ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-medium">
              <Clock className="w-3 h-3 text-slate-400" />
              Last updated: {lastSavedTimestamp}
            </span>
          ) : null}
        </div>
      </div>

      {/* Quick Insert Suggestions */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <div className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#6743ee]" />
            <span>Quick Observation Templates</span>
          </div>
          <span className="text-slate-400 font-normal">Click to append to observations</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleInsertQuickTag(tag)}
              className="px-2 py-0.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-[#6743ee] border border-slate-200 hover:border-purple-300 rounded-md text-[11px] font-medium transition-colors cursor-pointer shadow-2xs"
              title={`Append "${tag}" to observations`}
            >
              + {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Notes Textarea */}
      <div className="relative">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder={`Enter confidential notes or interview impressions for ${candidate.name} (e.g. "Candidate demonstrated strong systems architecture and concurrency expertise during technical discussion. Target compensation is $180,000 base. Ready for final partner alignment...")`}
          rows={4}
          className="w-full text-xs p-3 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6743ee]/30 focus:border-[#6743ee] transition-all resize-y leading-relaxed font-sans"
        />
        {isDirty && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700 pointer-events-none shadow-2xs">
            Unsaved Changes
          </div>
        )}
      </div>

      {/* Footer toolbar: counters and action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
        <div className="text-[11px] text-slate-500 flex items-center gap-2.5">
          <span>
            <strong className="font-semibold text-slate-700">{characterCount}</strong> chars
          </span>
          <span>•</span>
          <span>
            <strong className="font-semibold text-slate-700">{wordCount}</strong> {wordCount === 1 ? 'word' : 'words'}
          </span>
          {originalNotes && (
            <>
              <span>•</span>
              <span className="text-emerald-700 font-medium">Persisted in local state</span>
            </>
          )}
          {relevantNotesAudits.length > 0 && (
            <>
              <span>•</span>
              <button
                type="button"
                onClick={() => setShowAuditTrail(prev => !prev)}
                className="text-[#6743ee] hover:underline font-semibold flex items-center gap-1"
              >
                <History className="w-3 h-3" />
                <span>{relevantNotesAudits.length} Audit {relevantNotesAudits.length === 1 ? 'Log' : 'Logs'}</span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {noteText.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="px-2.5 py-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
              title="Clear text area"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}

          {isDirty && (
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200 border border-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
              title="Discard unsaved edits and restore last saved note"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Revert</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty && !showSavedFeedback && originalNotes === noteText}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all ${
              showSavedFeedback
                ? 'bg-emerald-600 text-white cursor-default'
                : isDirty
                ? 'bg-[#6743ee] hover:bg-[#5637d2] text-white hover:shadow-xs cursor-pointer ring-2 ring-purple-400/20'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {showSavedFeedback ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved to Audit Log!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Note</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Audit Log Observation History Trail */}
      {relevantNotesAudits.length > 0 && showAuditTrail && (
        <div className="p-3 bg-white rounded-lg border border-purple-200 space-y-1.5 animate-in fade-in text-[11px]">
          <div className="font-bold text-slate-800 flex items-center gap-1.5 pb-1 border-b border-slate-100">
            <History className="w-3.5 h-3.5 text-[#6743ee]" />
            <span>Audit Trail for {candidate.name}'s Notes:</span>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {[...relevantNotesAudits].reverse().map((audit, idx) => (
              <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-50 text-slate-600">
                <span>
                  <strong className="text-slate-800">{audit.actor}</strong>: {audit.action}
                </span>
                <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">{audit.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
