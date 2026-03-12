'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { positionNames, difficultyNames } from '@/lib/constants';

interface InterviewInfo {
  id: string;
  position: string;
  difficulty: string;
  duration: number;
  status: string;
}

export default function CandidateEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [interview, setInterview] = useState<InterviewInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchInterview() {
      try {
        const res = await fetch(`/api/interviews/${id}`);
        if (!res.ok) {
          setError('面试链接无效或已过期');
          setLoading(false);
          return;
        }
        const data = await res.json();
        const iv = data.interview;
        if (iv.status === 'completed') {
          setError('该面试已完成');
          return;
        } else if (iv.status === 'in_progress') {
          setError('该面试正在进行中');
          return;
        }
        setInterview(iv);
      } catch {
        setError('无法加载面试信息');
      } finally {
        setLoading(false);
      }
    }
    fetchInterview();
  }, [id]);

  const handleJoin = async () => {
    if (!name || !email || !interview) return;
    setIsJoining(true);

    const params = new URLSearchParams({
      interviewId: id,
      name,
      email,
    });

    router.push(`/c/${id}/interview?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <LoadingSpinner className="w-8 h-8 text-primary" />
      </div>
    );
  }

  if (error && !interview) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="glass-card rounded-3xl p-10 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-red-500/8 ring-1 ring-red-500/15 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="text-gray-300 text-xl font-semibold mb-2">{error}</div>
          <p className="text-gray-600 text-sm">请联系招聘方获取有效的面试链接。</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="glass-card rounded-3xl p-10 max-w-md text-center">
          <div className="text-gray-300 text-xl font-semibold mb-2">{error}</div>
          <p className="text-gray-600 text-sm">如有疑问请联系招聘方。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg relative overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] opacity-30">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-[120px]" />
          <div className="absolute top-40 right-20 w-64 h-64 bg-accent/15 rounded-full blur-[100px]" />
        </div>
      </div>

      <div className="w-full max-w-md mx-auto px-6 py-12 relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-primary via-primary-light to-accent flex items-center justify-center shadow-glow-md">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>

          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-xs px-3 py-1 rounded-full bg-surface-2 ring-1 ring-white/[0.06] text-gray-500">
              通话时长 {interview?.duration || 30} 分钟
            </span>
            <span className="text-xs px-3 py-1 rounded-full bg-surface-2 ring-1 ring-white/[0.06] text-gray-500">
              中文
            </span>
          </div>

          <h1 className="text-2xl font-bold mb-2 text-white tracking-tight">
            {positionNames[interview?.position || 'frontend']} 面试
          </h1>
          <p className="text-gray-500 text-sm">
            {difficultyNames[interview?.difficulty || 'mid']} · AI 语音面试
          </p>
          <p className="text-gray-600 text-xs mt-2">
            请填写你的信息以加入面试
          </p>
        </div>

        {/* Form Card */}
        <div className="relative">
          <div className="absolute -inset-px bg-gradient-to-b from-primary/15 via-transparent to-transparent rounded-3xl" />
          <div className="relative glass-card rounded-3xl overflow-hidden">
            <div className="h-[2px] bg-gradient-to-r from-primary via-accent to-primary-light" />

            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2.5">姓名</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="请输入你的姓名"
                  className="w-full px-4 py-3 rounded-xl bg-surface-1 ring-1 ring-white/[0.06] text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2.5">邮箱</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入你的邮箱"
                  className="w-full px-4 py-3 rounded-xl bg-surface-1 ring-1 ring-white/[0.06] text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                />
              </div>

              {/* Join Button */}
              <button
                onClick={handleJoin}
                disabled={!name || !email || isJoining}
                className={`w-full py-3.5 rounded-2xl text-base font-semibold transition-all duration-300 ${
                  name && email && !isJoining
                    ? 'btn-gradient text-white hover:shadow-glow-lg active:scale-[0.99]'
                    : 'bg-surface-2 text-gray-600 cursor-not-allowed ring-1 ring-white/[0.04]'
                }`}
              >
                {isJoining ? (
                  <span className="relative flex items-center justify-center gap-2">
                    <LoadingSpinner className="w-4 h-4" />
                    正在加入...
                  </span>
                ) : (
                  <span className="relative flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    加入面试
                  </span>
                )}
              </button>
            </div>

            <div className="h-[2px] bg-gradient-to-r from-emerald-500 via-primary to-accent" />
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-700 text-xs mt-6">
          面试过程中请确保麦克风正常工作
        </p>
      </div>
    </div>
  );
}
