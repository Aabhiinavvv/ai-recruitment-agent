import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  CheckCircle2, 
  Users, 
  Briefcase, 
  Building2, 
  Link2, 
  ShieldCheck, 
  ExternalLink,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { HiringBrief, Candidate } from '../types';
import { generateLinkedInCandidateBatch, LinkedInGenerateOptions } from '../services/linkedInGenerator';

interface LinkedInImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  brief: HiringBrief | null;
  onImport: (newCandidates: Candidate[], auditDescription: string) => void;
}

export const LinkedInImportModal: React.FC<LinkedInImportModalProps> = ({
  isOpen,
  onClose,
  brief,
  onImport
}) => {
  const [candidateCount, setCandidateCount] = useState<number>(2);
  const [seniority, setSeniority] = useState<'senior' | 'mid' | 'mixed'>('senior');
  const [companyTier, setCompanyTier] = useState<'faang_ai' | 'scaleup' | 'enterprise'>('faang_ai');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');

  if (!isOpen) return null;

  const roleTitle = brief?.job_title || 'Software Engineer';

  const handleGenerateAndImport = () => {
    setIsGenerating(true);
    setGenerationStep('Searching LinkedIn talent network for ' + roleTitle + ' profiles...');

    setTimeout(() => {
      setGenerationStep('Extracting career history, skills, and endorsements...');
    }, 450);

    setTimeout(() => {
      setGenerationStep('Running multi-dimensional AI scoring against 6-dimension rubric...');
    }, 900);

    setTimeout(() => {
      const options: LinkedInGenerateOptions = {
        count: candidateCount,
        seniority,
        targetCompanyTier: companyTier,
        customUrl: customUrl.trim() || undefined,
        customNotes: customNotes.trim() || undefined
      };

      const generatedCandidates = generateLinkedInCandidateBatch(brief, options);

      const auditDescription = `Imported ${generatedCandidates.length} candidate profile(s) from LinkedIn sourcing agent (${seniority} tier, ${companyTier.replace('_', ' ')} companies)`;

      onImport(generatedCandidates, auditDescription);
      setIsGenerating(false);
      onClose();
    }, 1350);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0a66c2] text-white flex items-center justify-center font-bold text-lg shadow-sm">
              in
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Import from LinkedIn</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#0a66c2]">
                  AI Talent Sourcing
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Synthesize placeholder candidate profiles grounded in your role requirements
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isGenerating ? (
          /* Animated AI Generation State */
          <div className="py-10 px-4 text-center space-y-4">
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100 border-t-[#0a66c2] animate-spin" />
              <div className="w-9 h-9 rounded-xl bg-[#0a66c2] text-white flex items-center justify-center font-bold text-base shadow-sm">
                in
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">AI Agent Sourcing from LinkedIn</h3>
              <p className="text-xs text-slate-600 font-medium animate-pulse">{generationStep}</p>
            </div>

            <div className="max-w-xs mx-auto text-[11px] text-slate-400">
              Generating verified endorsements, education credentials, and multi-dimensional rubric scores.
            </div>
          </div>
        ) : (
          /* Configuration Form */
          <div className="space-y-4 text-xs">
            {/* Target Role & Requisition context */}
            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Briefcase className="w-4 h-4 text-[#0a66c2]" />
                <div>
                  <span className="text-[11px] text-slate-500 block">Target Job Requisition:</span>
                  <span className="font-bold text-slate-900 text-xs">{roleTitle}</span>
                </div>
              </div>
              <span className="text-[10px] font-semibold bg-white px-2 py-0.5 rounded border border-blue-200 text-[#0a66c2]">
                Active Rubric
              </span>
            </div>

            {/* Candidate Quantity & Seniority Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Number of candidates */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-[#0a66c2]" />
                  Number of Profiles
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[1, 2, 3].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setCandidateCount(num)}
                      className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                        candidateCount === num
                          ? 'bg-[#0a66c2] text-white border-[#0a66c2] shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {num} {num === 1 ? 'Profile' : 'Profiles'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Seniority Calibration */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Seniority Level
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'senior', label: 'Senior+' },
                    { id: 'mid', label: 'Mid-Level' },
                    { id: 'mixed', label: 'Mixed' }
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSeniority(s.id as any)}
                      className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                        seniority === s.id
                          ? 'bg-[#0a66c2] text-white border-[#0a66c2] shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Target Company Pool */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-[#0a66c2]" />
                Target Company Background
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: 'faang_ai', title: 'AI Labs & Tech Giants', desc: 'OpenAI, Meta, Google, NVIDIA' },
                  { id: 'scaleup', title: 'High-Growth Scaleups', desc: 'Stripe, Databricks, Scale AI, Vercel' },
                  { id: 'enterprise', title: 'Enterprise Leaders', desc: 'Microsoft, Salesforce, Palantir' }
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setCompanyTier(tier.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      companyTier === tier.id
                        ? 'bg-blue-50/70 border-[#0a66c2] ring-2 ring-[#0a66c2]/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-bold text-slate-900 block text-[11px]">{tier.title}</span>
                    <span className="text-[10px] text-slate-500 block truncate">{tier.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional LinkedIn URL / Handle input */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5 text-slate-400" />
                  Custom LinkedIn Profile URL or Username (Optional)
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Leave blank for auto-generation</span>
              </label>
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="e.g. https://linkedin.com/in/sophia-vance-ai or username"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0a66c2]"
              />
            </div>

            {/* Optional Recruiter Sourcing Note */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Recruiter Sourcing Observation (Optional)
              </label>
              <input
                type="text"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="e.g. Sourced via Recruiter InMail; high peer mutuals with engineering team"
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#0a66c2]"
              />
            </div>

            {/* Compliance notice */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Compliance & AI Sourcing Standards
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Profiles are synthesized and evaluated strictly against the job description rubric. Sensitive demographic attributes are redacted before score computation.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateAndImport}
                className="px-5 py-2.5 bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate & Import {candidateCount} {candidateCount === 1 ? 'Profile' : 'Profiles'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
