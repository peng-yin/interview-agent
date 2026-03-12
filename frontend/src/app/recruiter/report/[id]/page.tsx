'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { positionNames, difficultyMap } from '@/lib/constants';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface InterviewReport {
  overallComment: string;
  technicalScore: number;
  communicationScore: number;
  experienceScore: number;
  problemSolvingScore: number;
  highlights: string[];
  improvements: string[];
  recommendation: string;
  detailedFeedback: string;
}

interface Interview {
  id: string;
  position: string;
  difficulty: string;
  duration: number;
  candidate_name: string | null;
  candidate_email: string | null;
  status: string;
  report: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

const recommendationConfig: Record<string, { color: string; bg: string; icon: string }> = {
  '强烈推荐': { color: 'from-emerald-400 to-green-500', bg: 'bg-emerald-500/8 ring-1 ring-emerald-500/15', icon: '🌟' },
  '推荐': { color: 'from-blue-400 to-cyan-500', bg: 'bg-blue-500/8 ring-1 ring-blue-500/15', icon: '👍' },
  '待定': { color: 'from-amber-400 to-yellow-500', bg: 'bg-amber-500/8 ring-1 ring-amber-500/15', icon: '🤔' },
  '不推荐': { color: 'from-red-400 to-pink-500', bg: 'bg-red-500/8 ring-1 ring-red-500/15', icon: '⚠️' },
};

function ScoreBar({ label, score, delay = 0 }: { label: string; score: number; delay?: number }) {
  const [animated, setAnimated] = useState(false);
  const percentage = (score / 10) * 100;

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const getColor = (s: number) => {
    if (s >= 8) return 'bg-gradient-to-r from-emerald-400 to-green-500';
    if (s >= 6) return 'bg-gradient-to-r from-blue-400 to-cyan-500';
    if (s >= 4) return 'bg-gradient-to-r from-amber-400 to-yellow-500';
    return 'bg-gradient-to-r from-red-400 to-pink-500';
  };

  const getScoreColor = (s: number) => {
    if (s >= 8) return 'text-emerald-400';
    if (s >= 6) return 'text-blue-400';
    if (s >= 4) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="mb-5">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-400 font-medium">{label}</span>
        <span className={`text-sm font-bold tabular-nums ${getScoreColor(score)}`}>{score}/10</span>
      </div>
      <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${getColor(score)}`}
          style={{ width: animated ? `${percentage}%` : '0%' }}
        />
      </div>
    </div>
  );
}

export default function RecruiterReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [interview, setInterview] = useState<Interview | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/interviews/${id}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        setInterview(data.interview);
        if (data.interview.report) {
          try {
            setReport(JSON.parse(data.interview.report));
          } catch {
            console.error('Failed to parse report');
          }
        }
      } catch (err) {
        console.error('Failed to fetch interview:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  const exportAsText = useCallback(() => {
    if (!report || !interview) return;
    const avgScore = (
      (report.technicalScore + report.communicationScore + report.experienceScore + report.problemSolvingScore) / 4
    ).toFixed(1);

    const text = `
面试评估报告
==========================================
岗位: ${positionNames[interview.position] || '工程师'}
难度: ${difficultyMap[interview.difficulty] || interview.difficulty}
候选人: ${interview.candidate_name || '未知'}
邮箱: ${interview.candidate_email || '未提供'}
面试时间: ${interview.started_at ? new Date(interview.started_at).toLocaleString('zh-CN') : '未知'}
推荐等级: ${report.recommendation}
综合评分: ${avgScore}/10

各项评分:
- 技术能力: ${report.technicalScore}/10
- 沟通表达: ${report.communicationScore}/10
- 项目经验: ${report.experienceScore}/10
- 问题解决: ${report.problemSolvingScore}/10

总体评价:
${report.overallComment}

亮点:
${report.highlights.map((h, i) => `${i + 1}. ${h}`).join('\n')}

待提高:
${report.improvements.map((h, i) => `${i + 1}. ${h}`).join('\n')}

详细反馈:
${report.detailedFeedback}
==========================================
`.trim();

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `面试报告_${interview.candidate_name || '候选人'}_${positionNames[interview.position] || '工程师'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [report, interview]);

  const copyReport = useCallback(() => {
    if (!report || !interview) return;
    const avgScore = (
      (report.technicalScore + report.communicationScore + report.experienceScore + report.problemSolvingScore) / 4
    ).toFixed(1);

    const text = `【面试评估报告】${positionNames[interview.position] || '工程师'}\n候选人: ${interview.candidate_name || '未知'}\n综合评分: ${avgScore}/10 | 推荐: ${report.recommendation}\n\n技术: ${report.technicalScore}/10 | 沟通: ${report.communicationScore}/10 | 经验: ${report.experienceScore}/10 | 解题: ${report.problemSolvingScore}/10\n\n${report.overallComment}\n\n亮点: ${report.highlights.join('、')}\n待提高: ${report.improvements.join('、')}`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [report, interview]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <LoadingSpinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  if (!interview || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="glass-card rounded-3xl p-10 max-w-md text-center">
          <div className="text-gray-300 text-xl font-semibold mb-2">报告不可用</div>
          <p className="text-gray-600 mb-6">面试报告尚未生成或面试不存在。</p>
          <button
            onClick={() => router.push('/recruiter')}
            className="px-6 py-3 rounded-xl btn-gradient text-white font-medium transition-all"
          >
            <span className="relative">返回管理面板</span>
          </button>
        </div>
      </div>
    );
  }

  const avgScore = (
    (report.technicalScore + report.communicationScore + report.experienceScore + report.problemSolvingScore) / 4
  ).toFixed(1);

  const recConfig = recommendationConfig[report.recommendation] || {
    color: 'from-gray-400 to-gray-500',
    bg: 'bg-gray-500/8 ring-1 ring-gray-500/15',
    icon: '📋',
  };

  return (
    <div className="min-h-screen gradient-bg">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.push('/recruiter')}
            className="p-2 rounded-lg bg-surface-2 ring-1 ring-white/[0.06] text-gray-500 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">面试报告</h1>
            <p className="text-gray-600 text-sm">
              {positionNames[interview.position]} · {interview.candidate_name || '候选人'}
              {interview.candidate_email && ` · ${interview.candidate_email}`}
            </p>
          </div>
        </div>

        {/* Score + Recommendation Hero */}
        <div className="glass-card rounded-3xl p-8 mb-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 opacity-[0.06]">
            <div className={`w-full h-full rounded-full bg-gradient-to-br ${recConfig.color} blur-3xl`} />
          </div>

          <div className="flex items-start justify-between mb-6 relative">
            <div>
              <div className="text-gray-500 text-sm mb-2">综合评分</div>
              <div className="flex items-baseline gap-1">
                <span className="text-6xl font-bold text-gradient tabular-nums">
                  {avgScore}
                </span>
                <span className="text-xl text-gray-600">/10</span>
              </div>
            </div>
            <div className={`px-5 py-3 rounded-2xl ${recConfig.bg} flex items-center gap-2`}>
              <span className="text-xl">{recConfig.icon}</span>
              <span className={`font-bold text-lg bg-gradient-to-r ${recConfig.color} bg-clip-text text-transparent`}>
                {report.recommendation}
              </span>
            </div>
          </div>

          <p className="text-gray-400 text-base leading-relaxed relative">{report.overallComment}</p>

          {/* Candidate info */}
          <div className="mt-5 pt-5 border-t border-white/[0.04] flex flex-wrap gap-4 text-xs text-gray-600">
            <span>候选人: {interview.candidate_name}</span>
            {interview.candidate_email && <span>邮箱: {interview.candidate_email}</span>}
            <span>难度: {difficultyMap[interview.difficulty] || interview.difficulty}</span>
            {interview.completed_at && <span>完成时间: {new Date(interview.completed_at).toLocaleString('zh-CN')}</span>}
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="glass-card rounded-3xl p-6 mb-5">
          <h2 className="text-lg font-semibold mb-6 text-white flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            能力评分
          </h2>
          <ScoreBar label="技术能力" score={report.technicalScore} delay={100} />
          <ScoreBar label="沟通表达" score={report.communicationScore} delay={200} />
          <ScoreBar label="项目经验" score={report.experienceScore} delay={300} />
          <ScoreBar label="问题解决" score={report.problemSolvingScore} delay={400} />
        </div>

        {/* Highlights & Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-white">亮点</h2>
            </div>
            <ul className="space-y-3">
              {report.highlights.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span className="text-gray-400 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-white">待提高</h2>
            </div>
            <ul className="space-y-3">
              {report.improvements.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <span className="text-gray-400 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Detailed Feedback */}
        <div className="glass-card rounded-3xl p-6 mb-8">
          <h2 className="text-base font-semibold mb-4 text-white flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            详细反馈
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap">{report.detailedFeedback}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => router.push('/recruiter')}
            className="px-8 py-3 rounded-2xl btn-gradient text-white font-medium transition-all active:scale-95"
          >
            <span className="relative">返回管理面板</span>
          </button>

          <button
            onClick={exportAsText}
            className="px-6 py-3 rounded-2xl bg-surface-2 ring-1 ring-white/[0.06] text-gray-400 font-medium hover:text-white hover:ring-white/[0.1] transition-all active:scale-95"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              导出报告
            </span>
          </button>

          <button
            onClick={copyReport}
            className={`px-6 py-3 rounded-2xl ring-1 font-medium transition-all active:scale-95 ${
              copied
                ? 'bg-emerald-500/8 ring-emerald-500/20 text-emerald-400'
                : 'bg-surface-2 ring-white/[0.06] text-gray-400 hover:text-white hover:ring-white/[0.1]'
            }`}
          >
            <span className="flex items-center gap-2">
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  已复制
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  复制摘要
                </>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
