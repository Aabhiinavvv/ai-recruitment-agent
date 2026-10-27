import React, { useState } from 'react';
import { X, FileText, HelpCircle, Sparkles, Download, CheckCircle2, BookOpen } from 'lucide-react';
import { recruitmentAgent } from '../services/recruitmentAgent';

interface ResumeToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentResumeText: string;
  candidateName?: string;
  roleTitle?: string;
}

export const ResumeToolsModal: React.FC<ResumeToolsModalProps> = ({
  isOpen,
  onClose,
  currentResumeText,
  candidateName = "Candidate",
  roleTitle = "Software Engineer",
}) => {
  const [tab, setTab] = useState<'qa' | 'improve' | 'employee_hr'>('qa');

  // QA state
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);

  // Improvement state
  const [improvements, setImprovements] = useState<Record<string, { description: string; specific: string[] }> | null>(null);
  const [improvedResume, setImprovedResume] = useState<string>('');

  // Employee HR policy state
  const [policyQuestion, setPolicyQuestion] = useState('How many days of annual paid leave are provided?');
  const [policyAnswer, setPolicyAnswer] = useState<{ answer: string; sources: string[]; needs_hr_follow_up: boolean } | null>(null);

  if (!isOpen) return null;

  const handleAskQuestion = () => {
    if (!question.trim()) return;
    setIsAnswering(true);
    setTimeout(() => {
      const ans = recruitmentAgent.answerResumeQuestion(currentResumeText || "General candidate resume text", question);
      setAnswer(ans);
      setIsAnswering(false);
    }, 400);
  };

  const handleGetImprovements = () => {
    const res = recruitmentAgent.generateResumeImprovements(currentResumeText, roleTitle);
    setImprovements(res);
  };

  const handleGenerateImprovedResume = () => {
    const text = recruitmentAgent.generateImprovedResume(
      currentResumeText,
      roleTitle,
      "TypeScript, React, Python, Cloud Architecture, System Design"
    );
    setImprovedResume(text);
  };

  const handleDownloadImproved = () => {
    const blob = new Blob([improvedResume], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `improved-resume-${roleTitle.toLowerCase().replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAskPolicy = () => {
    if (!policyQuestion.trim()) return;
    const res = recruitmentAgent.answerEmployeeHrQuestion(policyQuestion, "Standard Company HR Policy");
    setPolicyAnswer(res);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Resume Intelligence & HR Support</h2>
              <p className="text-xs text-slate-500">
                Grounded Q&A, actionable resume enhancements, and employee policy inquiry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setTab('qa')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              tab === 'qa'
                ? 'bg-[#f3f0ff] text-[#5b43d6] border border-[#d8ccfd]'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Resume Q&A
          </button>

          <button
            onClick={() => setTab('improve')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              tab === 'improve'
                ? 'bg-[#f3f0ff] text-[#5b43d6] border border-[#d8ccfd]'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Improvement & Generator
          </button>

          <button
            onClick={() => setTab('employee_hr')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              tab === 'employee_hr'
                ? 'bg-[#f3f0ff] text-[#5b43d6] border border-[#d8ccfd]'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Employee HR Agent
          </button>
        </div>

        {/* Tab 1: QA */}
        {tab === 'qa' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ask Questions About Candidate's Resume ({candidateName})
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. Does this candidate have production experience with MLOps or Kubernetes?"
                  className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
                  onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                />
                <button
                  onClick={handleAskQuestion}
                  disabled={isAnswering}
                  className="px-4 py-2 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isAnswering ? "Querying..." : "Ask Agent"}
                </button>
              </div>
            </div>

            {answer && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Grounded Evidence Answer:
                </div>
                <p className="text-slate-700 leading-relaxed">{answer}</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Improvements & Resume Generator */}
        {tab === 'improve' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800">
                  Target Role: <span className="text-[#6743ee]">{roleTitle}</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Generate structural feedback and an optimized professional resume draft
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleGetImprovements}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                >
                  Analyze Areas
                </button>
                <button
                  onClick={handleGenerateImprovedResume}
                  className="px-3 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Improved Resume
                </button>
              </div>
            </div>

            {improvements && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(improvements).map(([area, details]) => (
                  <div key={area} className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl space-y-2 text-xs">
                    <div className="font-bold text-purple-900">{area}</div>
                    <p className="text-[11px] text-slate-600">{details.description}</p>
                    <ul className="list-disc list-inside space-y-1 text-[11px] text-purple-950 font-medium">
                      {details.specific.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {improvedResume && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Optimized Resume Output</span>
                  <button
                    onClick={handleDownloadImproved}
                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download (.txt)
                  </button>
                </div>
                <textarea
                  readOnly
                  value={improvedResume}
                  rows={10}
                  className="w-full text-xs p-3 font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Employee HR Policy */}
        {tab === 'employee_hr' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ask Employee HR Policy Question
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={policyQuestion}
                  onChange={(e) => setPolicyQuestion(e.target.value)}
                  placeholder="e.g. What is the remote work policy or expense reimbursement timeline?"
                  className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
                />
                <button
                  onClick={handleAskPolicy}
                  className="px-4 py-2 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Ask Policy
                </button>
              </div>
            </div>

            {policyAnswer && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="font-bold text-slate-900">Policy Guidance:</div>
                <p className="text-slate-700 leading-relaxed">{policyAnswer.answer}</p>
                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                  Sources: {policyAnswer.sources.join(', ')}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
