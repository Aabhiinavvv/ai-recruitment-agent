import React, { useEffect } from 'react';
import { Candidate, CandidatePersona } from '../types';
import { CandidatePersonaCard } from './CandidatePersonaCard';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface CandidatePersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  candidatesList: Candidate[];
  onSelectCandidate: (candidate: Candidate) => void;
  onRegeneratePersona: (candidateId: string) => void;
  isRegenerating?: boolean;
}

export const CandidatePersonaModal: React.FC<CandidatePersonaModalProps> = ({
  isOpen,
  onClose,
  candidate,
  candidatesList,
  onSelectCandidate,
  onRegeneratePersona,
  isRegenerating = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !candidate || !candidate.persona) return null;

  const currentIndex = candidatesList.findIndex(c => c.candidate_id === candidate.candidate_id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < candidatesList.length - 1;

  const handlePrev = () => {
    if (hasPrev) {
      onSelectCandidate(candidatesList[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      onSelectCandidate(candidatesList[currentIndex + 1]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header Nav */}
        <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-[#6743ee] to-indigo-600 rounded-xl text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  AI Candidate Persona & Highlight Reel
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-[#5b43d6] font-bold">
                  {currentIndex + 1} of {candidatesList.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Executive distillation for hiring loops, interview panels, and calibrated decision-making.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Candidate Nav Steppers */}
            <button
              type="button"
              disabled={!hasPrev}
              onClick={handlePrev}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Previous candidate persona"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={!hasNext}
              onClick={handleNext}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Next candidate persona"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors ml-2"
              title="Close persona card (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          <CandidatePersonaCard
            candidate={candidate}
            persona={candidate.persona}
            onRegenerate={onRegeneratePersona}
            isRegenerating={isRegenerating}
            onClose={onClose}
            isModal={true}
          />
        </div>
      </div>
    </div>
  );
};
