import React from 'react';
import { LogOut } from 'lucide-react';
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
                className="px-3.5 py-1.5 text-xs font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 shadow-2xs"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>{isSigningIn ? 'Signing in...' : 'Sign in with Google'}</span>
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
};

