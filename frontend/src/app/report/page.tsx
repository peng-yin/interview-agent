'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { positionNames } from '@/lib/constants';
import { PageLoading } from '@/components/LoadingSpinner';

interface InterviewReport {
  type: string;
  position: string;
  difficulty: string;
  timestamp: string;
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

const recommendationColors: Record<string, string> = {
  '强烈推荐': 'from-green-500 to-emerald-500',
  '推荐': 'from-blue-500 to-cyan-500',
  '待定': 'from-yellow-500 to-amber-500',
  '不推荐': 'from-red-500 to-pink-500',
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const percentage = (score / 10) * 100;
  const getColor = (s: number) => {
    if (s >= 8) return 'bg-green-500';
    if (s >= 6) return 'bg-blue-500';
    if (s >= 4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="text-sm font-semibold text-white">{score}/10</span>
      </div>
      <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${getColor(score)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function ReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [report, setReport] = useState<InterviewReport | null>(null);

  useEffect(() => {
    const reportData = searchParams.get('data');
    if (reportData) {
      try {
        const parsed = JSON.parse(decodeURIComponent(reportData));
        setReport(parsed);
      } catch {
        // try sessionStorage fallback
        try {
          const stored = sessionStorage.getItem('interview-report');
          if (stored) {
            setReport(JSON.parse(stored));
            sessionStorage.removeItem('interview-report');
          }
        } catch {
          console.error('Failed to parse report from sessionStorage');
        }
      }
    } else {
      try {
        const stored = sessionStorage.getItem('interview-report');
        if (stored) {
          setReport(JSON.parse(stored));
          sessionStorage.removeItem('interview-report');
        }
      } catch {
        console.error('Failed to parse report from sessionStorage');
      }
    }
  }, [searchParams]);

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center">
          <div className="text-gray-400 text-xl mb-4">暂无面试报告</div>
          <p className="text-gray-500 mb-6">未找到面试报告数据，请先完成一场面试。</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const avgScore = (
    (report.technicalScore + report.communicationScore + report.experienceScore + report.problemSolvingScore) / 4
  ).toFixed(1);

  const recColor = recommendationColors[report.recommendation] || 'from-gray-500 to-gray-600';

  return (
    <div className="min-h-screen gradient-bg">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-4">
            <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm text-indigo-400">面试评估报告</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">{positionNames[report.position] || '工程师'} 面试报告</h1>
          <p className="text-gray-400 text-sm">
            {new Date(report.timestamp).toLocaleString('zh-CN')} | 难度: {report.difficulty}
          </p>
        </div>

        {/* Recommendation Badge + Overall Score */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-gray-400 text-sm mb-1">综合评分</div>
              <div className="text-4xl font-bold text-white">{avgScore}<span className="text-lg text-gray-400">/10</span></div>
            </div>
            <div className={`px-5 py-2.5 rounded-full bg-gradient-to-r ${recColor} text-white font-semibold text-lg`}>
              {report.recommendation}
            </div>
          </div>
          <p className="text-gray-300 text-lg leading-relaxed">{report.overallComment}</p>
        </div>

        {/* Score Breakdown */}
        <div className="glass-card rounded-2xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-5 text-white">能力评分</h2>
          <ScoreBar label="技术能力" score={report.technicalScore} />
          <ScoreBar label="沟通表达" score={report.communicationScore} />
          <ScoreBar label="项目经验" score={report.experienceScore} />
          <ScoreBar label="问题解决" score={report.problemSolvingScore} />
        </div>

        {/* Highlights & Improvements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">亮点</h2>
            </div>
            <ul className="space-y-3">
              {report.highlights.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  <span className="text-gray-300 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">待提高</h2>
            </div>
            <ul className="space-y-3">
              {report.improvements.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <span className="text-gray-300 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Detailed Feedback */}
        <div className="glass-card rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-3 text-white">详细反馈</h2>
          <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">{report.detailedFeedback}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:shadow-lg hover:shadow-indigo-500/30 transition-all"
          >
            再来一场面试
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ReportContent />
    </Suspense>
  );
}
