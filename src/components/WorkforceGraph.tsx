import React from 'react';
import { Candidate, HiringBrief } from '../types';
import { Network, Users, Database, Layers, CheckCircle2, Award } from 'lucide-react';

interface WorkforceGraphProps {
  job: HiringBrief | null;
  candidates: Candidate[];
}

export const WorkforceGraph: React.FC<WorkforceGraphProps> = ({ job, candidates }) => {
  // Aggregate nodes
  const peopleCount = candidates.length;
  const skillsSet = new Set<string>();
  candidates.forEach(c => {
    Object.keys(c.skill_scores || {}).forEach(s => skillsSet.add(s));
  });
  const entityCount = 1 + (job ? 1 : 0) + peopleCount + skillsSet.size;
  const relationshipCount = peopleCount * 3 + skillsSet.size;

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
      <div>
        <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
          <Network className="w-5 h-5 text-[#6743ee]" />
          <span>Workforce & Talent Relationship Graph</span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          A descriptive relationship map connecting this role, consented candidate history, validated skill evidence, and round outcomes.
          It is an organizational view, not an automated scoring input.
        </p>
      </div>

      {/* Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
            <Users className="w-4 h-4 text-[#6743ee]" />
            People / Candidates
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{peopleCount}</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
            <Database className="w-4 h-4 text-emerald-600" />
            Entities in Scope
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">{entityCount}</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
            <Layers className="w-4 h-4 text-indigo-600" />
            Mapped Relationships
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-1">{relationshipCount}</div>
        </div>
      </div>

      {/* Interactive Entity View */}
      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Active Workforce Network
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          {/* Company & Role Root */}
          <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 shrink-0 min-w-[200px]">
            <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-600 block">Root Node</span>
            <div className="font-bold text-slate-900 text-sm mt-0.5">{job?.job_title || "Target Role"}</div>
            <div className="text-xs text-indigo-700">{job?.company_name || "Company"}</div>
          </div>

          <div className="hidden md:flex items-center text-slate-300 font-bold">➔</div>

          {/* Candidate nodes */}
          <div className="flex-1 space-y-2">
            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 block">Candidate Nodes</span>
            {candidates.length === 0 ? (
              <div className="text-xs text-slate-500 italic">No candidates screened yet. Upload a resume to populate.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {candidates.map((c) => (
                  <div key={c.candidate_id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">{c.name}</div>
                      <div className="text-[10px] text-slate-500">{c.candidate_id} · Score: {c.overall_score}%</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      c.decision_status.includes('Advanced') || c.decision_status.includes('Hired')
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {c.decision_status.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="hidden md:flex items-center text-slate-300 font-bold">➔</div>

          {/* Core Competencies Pool */}
          <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 shrink-0 min-w-[200px]">
            <span className="text-[10px] font-bold tracking-wider uppercase text-purple-600 block">Linked Skills & Evidence</span>
            <div className="flex flex-wrap gap-1 mt-1.5 max-w-[220px]">
              {Array.from(skillsSet).slice(0, 6).map((skill) => (
                <span key={skill} className="px-2 py-0.5 bg-white text-purple-800 border border-purple-200 rounded text-[10px] font-medium">
                  {skill}
                </span>
              ))}
              {skillsSet.size > 6 && (
                <span className="px-1.5 py-0.5 text-[10px] text-purple-600">+{skillsSet.size - 6} more</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
