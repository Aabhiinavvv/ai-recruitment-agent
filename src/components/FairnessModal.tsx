import React, { useState } from 'react';
import { X, ShieldCheck, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { generateFairnessExperimentDemo, maskSensitiveAttributes } from '../services/fairnessEngine';

interface FairnessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FairnessModal: React.FC<FairnessModalProps> = ({ isOpen, onClose }) => {
  const [report, setReport] = useState(() => generateFairnessExperimentDemo());
  const [sampleText, setSampleText] = useState(
    "Candidate Resume:\nName: Priya Sharma\nDate of Birth: 1994-05-12\nGender: Female\nNationality: Indian\nMarital Status: Married\nExperience: 6 years building distributed Python and PyTorch ML models.\nEducation: M.Tech in Computer Science."
  );
  const [maskedOutput, setMaskedOutput] = useState<{ maskedText: string; redactedCount: number; labelsFound: string[] } | null>(null);

  if (!isOpen) return null;

  const handleTestMask = () => {
    const res = maskSensitiveAttributes(sampleText);
    setMaskedOutput(res);
  };

  const rerunExperiment = () => {
    setReport(generateFairnessExperimentDemo());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Fairness & Bias Audit Engine</h2>
              <p className="text-xs text-slate-500">
                EEOC Uniform Guidelines §60-3.4 4/5ths Rule & Demographic Parity Monitoring
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

        {/* Experiment A/B Comparison Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">
              A/B Screening Experiment: Baseline vs. Debiased Agent
            </h3>
            <button
              onClick={rerunExperiment}
              className="flex items-center gap-1.5 text-xs text-[#6743ee] font-semibold hover:underline"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Re-run audit
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Baseline Card */}
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-900 text-xs uppercase tracking-wider">
                  Baseline (Uncontrolled)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-800">
                  <AlertTriangle className="w-3 h-3" />
                  EEOC Adverse Impact
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-rose-100">
                  <span className="text-slate-600">Disparate Impact (Gender):</span>
                  <span className="font-bold text-rose-700">{report.baseline.disparate_impact_gender} (Fail &lt; 0.80)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-rose-100">
                  <span className="text-slate-600">Disparate Impact (Ethnicity):</span>
                  <span className="font-bold text-rose-700">{report.baseline.disparate_impact_ethnicity}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Demographic Parity Diff (DPD):</span>
                  <span className="font-bold text-slate-800">{report.baseline.dpd_gender}</span>
                </div>
              </div>
            </div>

            {/* Debiased Card */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-900 text-xs uppercase tracking-wider">
                  Debiased (AttributeMasker + Policy)
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  EEOC Compliant (≥ 0.80)
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-emerald-100">
                  <span className="text-slate-600">Disparate Impact (Gender):</span>
                  <span className="font-bold text-emerald-700">{report.debiased.disparate_impact_gender} (Pass)</span>
                </div>
                <div className="flex justify-between py-1 border-b border-emerald-100">
                  <span className="text-slate-600">Disparate Impact (Ethnicity):</span>
                  <span className="font-bold text-emerald-700">{report.debiased.disparate_impact_ethnicity}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-600">Demographic Parity Diff (DPD):</span>
                  <span className="font-bold text-slate-800">{report.debiased.dpd_gender}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
            <strong>Audit Summary:</strong> {report.summary}
          </div>
        </div>

        {/* AttributeMasker Interactive Sandbox */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <h3 className="text-sm font-bold text-slate-800">
            AttributeMasker Sandbox (Demographic Token Redaction)
          </h3>
          <p className="text-xs text-slate-500">
            Paste any text containing sensitive labels (Name, DOB, Gender, Nationality, Marital status, Religion) to test the redaction filter:
          </p>

          <textarea
            value={sampleText}
            onChange={(e) => setSampleText(e.target.value)}
            rows={4}
            className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
          />

          <button
            onClick={handleTestMask}
            className="px-4 py-2 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Run AttributeMasker
          </button>

          {maskedOutput && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs space-y-2 mt-2">
              <div className="flex items-center justify-between text-purple-900 font-bold">
                <span>Redacted Tokens: {maskedOutput.redactedCount}</span>
                <span>Labels: {maskedOutput.labelsFound.join(', ') || 'None'}</span>
              </div>
              <pre className="text-[11px] whitespace-pre-wrap font-mono text-purple-950 bg-white p-2.5 rounded-lg border border-purple-200">
                {maskedOutput.maskedText}
              </pre>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
