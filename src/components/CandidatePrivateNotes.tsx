import React, { useState, useEffect } from 'react';
import { Candidate } from '../types';
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
  AlertCircle
} from 'lucide-react';

interface CandidatePrivateNotesProps {
  candidate: Candidate;
  onSaveNotes: (candidateId: string, notes: string) => void;
}

const QUICK_TAGS = [
  "Culture fit positive",
  "Comp expectation: $175k-$195k",
  "Notice period: 2 weeks",
  "Strong system design depth",
  "Follow-up on MLOps experience",
  "Reference checks verified"
];

export const CandidatePrivateNotes: React.FC<CandidatePrivateNotesProps> = ({
  candidate,
  onSaveNotes
}) => {
  const [noteText, setNoteText] = useState<string>(candidate.private_notes || '');
  const [showSavedFeedback, setShowSavedFeedback] = useState<boolean>(false);
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

  return (
    <div className="p-4 bg-slate-50/90 rounded-xl border border-slate-200/90 shadow-2xs space-y-3.5 transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-100/80 text-[#6743ee] rounded-lg">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Private Recruiter Notes
              </h4>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200/80 text-slate-700">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Confidential • Internal Only
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Jot private interview impressions, salary requirements, referral sources, or follow-ups for {candidate.name}.
            </p>
          </div>
        </div>

        {/* Status indicator badges */}
        <div className="flex items-center gap-2 text-[11px]">
          {showSavedFeedback ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              Notes Saved
            </span>
          ) : isDirty ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              <AlertCircle className="w-3 h-3 text-amber-600" />
              Unsaved changes
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
        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          <Sparkles className="w-3 h-3 text-[#6743ee]" />
          <span>Quick Note Templates & Tags</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleInsertQuickTag(tag)}
              className="px-2 py-0.5 bg-white hover:bg-purple-50 text-slate-700 hover:text-[#6743ee] border border-slate-200 hover:border-purple-200 rounded-md text-[11px] transition-colors cursor-pointer shadow-2xs"
              title={`Append "${tag}" to notes`}
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
          placeholder={`Enter confidential notes for ${candidate.name} (e.g. "Candidate highlighted strong hands-on PyTorch experience, target salary is $180k, ready to start next month...")`}
          rows={4}
          className="w-full text-xs p-3 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6743ee]/30 focus:border-[#6743ee] transition-all resize-y leading-relaxed font-sans"
        />
        {isDirty && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-[9px] font-bold text-amber-700 pointer-events-none">
            Drafting
          </div>
        )}
      </div>

      {/* Footer toolbar: counters and action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
        <div className="text-[11px] text-slate-500 flex items-center gap-3">
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
                <span>Saved!</span>
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
    </div>
  );
};
