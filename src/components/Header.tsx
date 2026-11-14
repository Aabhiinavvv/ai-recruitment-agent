import React from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { HiringBrief } from '../types';

interface HeaderProps {
  brief?: HiringBrief | null;
  candidateCount?: number;
  onLoadSamples?: () => void;
  userEmail?: string | null;
  userName?: string | null;
  isSigningIn?: boolean;
  onSignIn?: () => void;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  brief,
  candidateCount = 0,
  onLoadSamples,
  userEmail,
  userName,
  isSigningIn = false,
  onSignIn,
  onSignOut,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 px-6 h-14 flex items-center sticky top-0 z-30">
      <div className="max-w-7xl w-full mx-auto flex items-center justify-between gap-6">
        {/* Zone 1: Single-line Breadcrumb / Workspace Title */}
        <div className="flex items-center gap-2 text-sm whitespace-nowrap shrink-0">
          <span className="font-bold tracking-tight text-slate-900">TalentFlow</span>
          {brief && (
            <>
              <span className="text-slate-300" aria-hidden="true">/</span>
              <span className="text-slate-600 font-medium truncate max-w-[220px] sm:max-w-md">
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

        {/* Zone 3: Utility & Account Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {onLoadSamples && (
            <button
              type="button"
              onClick={onLoadSamples}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Reset Demo Data
            </button>
          )}

          {userEmail ? (
            <div className="flex items-center gap-2">
              <span
                className="hidden sm:inline text-xs font-medium text-slate-700 max-w-[160px] truncate"
                title={userEmail}
              >
                {userName || userEmail}
              </span>
              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-500" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          ) : (
            onSignIn && (
              <button
                type="button"
                onClick={onSignIn}
                disabled={isSigningIn}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#6743ee] hover:bg-[#5637d2] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isSigningIn ? 'Signing in...' : 'Sign in'}</span>
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
};

