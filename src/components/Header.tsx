import React from 'react';
import { HiringBrief } from '../types';

interface HeaderProps {
  brief?: HiringBrief | null;
  candidateCount?: number;
  onLoadSamples?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  brief,
  candidateCount = 0,
  onLoadSamples,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center sticky top-0 z-30">
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Breadcrumb / Workspace Title */}
        <div className="flex items-center gap-2 text-sm whitespace-nowrap shrink-0">
          <span className="font-bold tracking-tight text-slate-900">TalentFlow</span>
          {brief && (
            <>
              <span className="text-slate-300" aria-hidden="true">/</span>
              <span className="text-slate-600 font-medium truncate max-w-[260px] sm:max-w-md">
                {brief.job_title} · {brief.company_name}
              </span>
            </>
          )}
        </div>

        {/* Zone 2: Quiet Workspace Metadata */}
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 tabular-nums whitespace-nowrap shrink-0">
          <span>{candidateCount} candidates in pipeline</span>
          {brief && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {brief.status.includes('Approved') ? 'Brief approved' : 'Brief draft'}
              </span>
            </>
          )}
        </div>

        {/* Zone 3: Single Primary Utility Action */}
        <div className="flex items-center gap-3 shrink-0">
          {onLoadSamples && (
            <button
              type="button"
              onClick={onLoadSamples}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Reset Demo Data
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
