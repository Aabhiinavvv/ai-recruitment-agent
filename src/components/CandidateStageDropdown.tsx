import React, { useState, useRef, useEffect } from 'react';
import { HiringStage } from '../types';
import { 
  ChevronDown, 
  Search, 
  FileCode, 
  Users, 
  Award, 
  XCircle, 
  Check, 
  Layers
} from 'lucide-react';

interface CandidateStageDropdownProps {
  currentStage: HiringStage;
  onStageChange: (newStage: HiringStage) => void;
  candidateName?: string;
  candidateId?: string;
  disabled?: boolean;
}

interface StageConfig {
  id: HiringStage;
  label: string;
  description: string;
  badgeClass: string;
  dotClass: string;
  activeItemClass: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const STAGES_CONFIG: StageConfig[] = [
  {
    id: 'Screening',
    label: 'Screening',
    description: 'Initial resume screening & 6-dimension evaluation',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100 hover:border-sky-400',
    dotClass: 'bg-sky-500',
    activeItemClass: 'bg-sky-50 text-sky-900 border-sky-200',
    icon: Search,
  },
  {
    id: 'Technical',
    label: 'Technical',
    description: 'Adaptive coding challenge & architecture exercise',
    badgeClass: 'bg-purple-50 text-[#5b43d6] border-purple-300 hover:bg-purple-100 hover:border-purple-400',
    dotClass: 'bg-[#6743ee]',
    activeItemClass: 'bg-purple-50 text-purple-900 border-purple-200',
    icon: FileCode,
  },
  {
    id: 'Interview',
    label: 'Interview',
    description: 'Panel interviews & technical/behavioral rounds',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 hover:border-amber-400',
    dotClass: 'bg-amber-500',
    activeItemClass: 'bg-amber-50 text-amber-900 border-amber-200',
    icon: Users,
  },
  {
    id: 'Offered',
    label: 'Offered',
    description: 'Formal employment offer extended / hired',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400',
    dotClass: 'bg-emerald-500',
    activeItemClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    icon: Award,
  },
  {
    id: 'Rejected',
    label: 'Rejected',
    description: 'Application archived / not proceeding',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100 hover:border-rose-400',
    dotClass: 'bg-rose-500',
    activeItemClass: 'bg-rose-50 text-rose-900 border-rose-200',
    icon: XCircle,
  },
];

export const CandidateStageDropdown: React.FC<CandidateStageDropdownProps> = ({
  currentStage,
  onStageChange,
  candidateName = 'Candidate',
  candidateId,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentConfig = STAGES_CONFIG.find(s => s.id === currentStage) || STAGES_CONFIG[0];
  const CurrentIcon = currentConfig.icon;

  // Handle clicking outside to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (stageId: HiringStage) => {
    if (stageId !== currentStage) {
      onStageChange(stageId);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(prev => !prev);
        }}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={`Current stage: ${currentConfig.label}. Click to update stage.`}
        className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-all shadow-2xs ${currentConfig.badgeClass} ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${currentConfig.dotClass} shrink-0 animate-pulse`} />
        <CurrentIcon className="w-3.5 h-3.5 shrink-0 opacity-80" />
        <span className="font-bold tracking-tight">
          Stage: <span className="underline decoration-dotted underline-offset-2">{currentConfig.label}</span>
        </span>
        <ChevronDown 
          className={`w-3.5 h-3.5 shrink-0 text-slate-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1.5 z-40 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-2 space-y-1 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="px-2.5 py-1.5 border-b border-slate-100 mb-1 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#6743ee]" />
                Update Hiring Stage
              </div>
              <div className="text-[10px] text-slate-500 truncate max-w-[210px]">
                {candidateName} {candidateId ? `(${candidateId})` : ''}
              </div>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-purple-50 text-[#6743ee] font-semibold border border-purple-100">
              Audit logged
            </span>
          </div>

          {/* Stages List */}
          <div className="space-y-1">
            {STAGES_CONFIG.map((stage) => {
              const isSelected = stage.id === currentStage;
              const StageIcon = stage.icon;

              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => handleSelect(stage.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-start gap-2.5 ${
                    isSelected 
                      ? `${stage.activeItemClass} border font-bold shadow-2xs` 
                      : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    <span className={`w-2 h-2 rounded-full ${stage.dotClass} inline-block mr-1.5`} />
                    <StageIcon className={`w-3.5 h-3.5 inline-block ${isSelected ? 'text-[#6743ee]' : 'text-slate-400'}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 leading-snug">
                        {stage.label}
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#6743ee] shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      {stage.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="px-2 pt-1 border-t border-slate-100 text-[10px] text-slate-400 text-center">
            Selection immediately records an entry to the Audit Log.
          </div>
        </div>
      )}
    </div>
  );
};
