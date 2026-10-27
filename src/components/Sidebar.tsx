import React from 'react';
import { 
  Compass, 
  Mic, 
  Layers, 
  Cpu, 
  Key, 
  Sliders, 
  ShieldCheck, 
  FileText, 
  RefreshCw,
  FolderCheck
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
  onLoadSamples,
  onOpenFairness,
  onOpenResumeTools
}) => {
  return (
    <aside className="w-full lg:w-72 bg-white border-r border-slate-200 p-5 shrink-0 flex flex-col justify-between">
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
            <span className="text-[#6743ee]">◉</span> Recruitment Workspace
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Recruitment workflow platform</p>
        </div>

        {/* Navigation Menu */}
        <div>
          <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2">
            Main Menu
          </div>
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('workflow')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                activeTab === 'workflow'
                  ? 'bg-[#f3f0ff] text-[#5b43d6] font-semibold border border-[#d8ccfd]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Compass className="w-4 h-4 shrink-0 text-[#6743ee]" />
              <span>Hiring Workflow</span>
            </button>

            <button
              onClick={() => setActiveTab('interview')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                activeTab === 'interview'
                  ? 'bg-[#f3f0ff] text-[#5b43d6] font-semibold border border-[#d8ccfd]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Mic className="w-4 h-4 shrink-0 text-[#6743ee]" />
              <span>AI Online Interview</span>
            </button>

            <button
              onClick={() => setActiveTab('architecture')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                activeTab === 'architecture'
                  ? 'bg-[#f3f0ff] text-[#5b43d6] font-semibold border border-[#d8ccfd]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0 text-[#6743ee]" />
              <span>Agent Architecture</span>
            </button>
          </nav>
        </div>

        {/* Specialized Tools */}
        <div>
          <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2">
            Specialist Agents & Auditing
          </div>
          <div className="space-y-1.5">
            <button
              onClick={onOpenFairness}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors border border-emerald-200 text-left"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Fairness & Bias Audit (EEOC)</span>
            </button>

            <button
              onClick={onOpenResumeTools}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-50 text-blue-800 hover:bg-blue-100 transition-colors border border-blue-200 text-left"
            >
              <FileText className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Resume Q&A & Policy Agent</span>
            </button>
          </div>
        </div>

        {/* AI Brain Configuration */}
        <div className="pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-3">
            <Cpu className="w-3.5 h-3.5 text-[#6743ee]" />
            AI Brain Settings
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">LLM Provider</label>
              <select
                value={provider}
                onChange={(e) => {
                  const p = e.target.value as 'Groq' | 'Gemini';
                  setProvider(p);
                  setModel(p === 'Groq' ? 'llama-3.3-70b-versatile' : 'gemini-3.8-flash');
                }}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
              >
                <option value="Gemini">Gemini</option>
                <option value="Groq">Groq</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1 flex items-center justify-between">
                <span>{provider} API Key</span>
                <span className="text-[10px] text-slate-400 font-normal">Optional</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={`Leave blank to use internal mock/env`}
                  className="w-full pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
                />
                <Key className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
              >
                {provider === 'Groq' ? (
                  <>
                    <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile</option>
                    <option value="llama-3.1-8b-instant">llama-3.1-8b-instant</option>
                  </>
                ) : (
                  <>
                    <option value="gemini-3.8-flash">gemini-3.8-flash</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-slate-700 font-medium">Cutoff Score</label>
                <span className="font-semibold text-[#5b43d6]">{cutoffScore}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="90"
                value={cutoffScore}
                onChange={(e) => setCutoffScore(Number(e.target.value))}
                className="w-full accent-[#6743ee] cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">Score threshold for candidate auto-advance recommendation</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Sample Action */}
      <div className="pt-4 border-t border-slate-100 mt-6">
        <button
          onClick={onLoadSamples}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
        >
          <FolderCheck className="w-3.5 h-3.5 text-[#6743ee]" />
          <span>Load Realistic Demo Candidates</span>
        </button>
      </div>
    </aside>
  );
};
