import React, { useState } from 'react';
import {
  Compass,
  Mic,
  Layers,
  ShieldCheck,
  FileText,
  ChevronDown,
  ChevronRight,
  Sliders,
} from 'lucide-react';

interface SidebarProps {
  activeTab: 'workflow' | 'interview' | 'architecture';
  setActiveTab: (tab: 'workflow' | 'interview' | 'architecture') => void;
  provider: 'Groq' | 'Gemini';
  setProvider: (p: 'Groq' | 'Gemini') => void;
  apiKey: string;
  setApiKey: (k: string) => void;
  model: string;
  setModel: (m: string) => void;
  cutoffScore: number;
  setCutoffScore: (s: number) => void;
  onLoadSamples: () => void;
  onOpenFairness: () => void;
  onOpenResumeTools: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  provider,
  setProvider,
  apiKey,
  setApiKey,
  model,
  setModel,
  cutoffScore,
  setCutoffScore,
  onOpenFairness,
  onOpenResumeTools,
}) => {
  const [showModelSettings, setShowModelSettings] = useState<boolean>(false);

  return (
    <aside className="w-full lg:w-64 bg-white border-r border-slate-200 p-5 shrink-0 flex flex-col justify-between">
      <div className="space-y-6">
        {/* Primary Navigation */}
        <div>
          <div className="text-[11px] font-semibold text-slate-400 px-3 mb-2">
            Workspace
          </div>
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab('workflow')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left whitespace-nowrap cursor-pointer ${
                activeTab === 'workflow'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
            >
              <Compass className="w-4 h-4 shrink-0" />
              <span>Hiring Pipeline</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('interview')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left whitespace-nowrap cursor-pointer ${
                activeTab === 'interview'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
            >
              <Mic className="w-4 h-4 shrink-0" />
              <span>AI Online Interview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('architecture')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left whitespace-nowrap cursor-pointer ${
                activeTab === 'architecture'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>Workflow Overview</span>
            </button>
          </nav>
        </div>

        {/* High-Scoring Cutoff Threshold */}
        <div className="pt-5 border-t border-slate-100 px-1">
          <div className="flex justify-between items-center mb-1.5">
            <label
              htmlFor="cutoff-score-slider"
              className="text-xs font-semibold text-slate-700"
            >
              High-Scoring Cutoff
            </label>
            <span className="text-xs font-mono font-bold text-indigo-600 tabular-nums">
              {cutoffScore}%
            </span>
          </div>
          <input
            id="cutoff-score-slider"
            type="range"
            min="50"
            max="90"
            value={cutoffScore}
            onChange={(e) => setCutoffScore(Number(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer"
          />
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            Defines the high-scoring cohort for candidate shortlisting and Team Skills Gap Analysis.
          </p>
        </div>

        {/* Compliance & Helper Agents */}
        <div className="pt-5 border-t border-slate-100">
          <div className="text-[11px] font-semibold text-slate-400 px-3 mb-2">
            Compliance & Tools
          </div>
          <div className="space-y-1">
            <button
              type="button"
              onClick={onOpenFairness}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left whitespace-nowrap cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Fairness & Bias Audit</span>
            </button>

            <button
              type="button"
              onClick={onOpenResumeTools}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left whitespace-nowrap cursor-pointer"
            >
              <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Resume Q&A & HR Policy</span>
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Advanced AI Model Settings */}
      <div className="pt-4 border-t border-slate-100 mt-6">
        <button
          type="button"
          onClick={() => setShowModelSettings((prev) => !prev)}
          className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-lg transition-colors cursor-pointer"
          aria-expanded={showModelSettings}
        >
          <span className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5" />
            <span>Model Settings ({provider})</span>
          </span>
          {showModelSettings ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {showModelSettings && (
          <div className="mt-3 px-2 space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 font-medium mb-1">Provider</label>
              <select
                value={provider}
                onChange={(e) => {
                  const p = e.target.value as 'Groq' | 'Gemini';
                  setProvider(p);
                  setModel(p === 'Groq' ? 'llama-3.3-70b-versatile' : 'gemini-3.8-flash');
                }}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                <option value="Gemini">Gemini</option>
                <option value="Groq">Groq</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                {provider === 'Groq' ? (
                  <>
                    <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                    <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                  </>
                ) : (
                  <option value="gemini-3.8-flash">gemini-3.8-flash</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">
                API Key <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Uses built-in agent if blank"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
