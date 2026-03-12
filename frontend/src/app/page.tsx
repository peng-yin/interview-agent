'use client';

import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen gradient-bg relative overflow-hidden flex items-center justify-center">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[600px] opacity-40">
          <div className="absolute top-0 left-1/4 w-80 h-80 bg-primary/20 rounded-full blur-[120px]" />
          <div className="absolute top-20 right-1/4 w-72 h-72 bg-accent/15 rounded-full blur-[100px]" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 relative z-10">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-primary/8 border border-primary/15 mb-8 backdrop-blur-md">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-primary animate-ping opacity-75" />
            </div>
            <span className="text-sm text-brand-400 font-medium tracking-wide">AI-Powered Voice Interview</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-5 text-gradient leading-tight tracking-tight">
            AI 技术面试官
          </h1>
          <p className="text-gray-400 text-lg max-w-lg mx-auto leading-relaxed">
            智能语音面试系统，为技术招聘赋能
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
          {/* Recruiter Entry */}
          <button
            onClick={() => router.push('/recruiter')}
            className="group relative glass-card-hover rounded-3xl p-8 text-left"
          >
            <div className="absolute top-0 right-0 w-40 h-40 opacity-0 group-hover:opacity-10 pointer-events-none transition-opacity duration-500">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-primary to-accent blur-3xl" />
            </div>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center mb-6 shadow-glow-sm group-hover:shadow-glow-md transition-shadow duration-300">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-white mb-2 group-hover:text-brand-400 transition-colors duration-300">
              招聘者入口
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-5">
              创建面试、分享链接给候选人、查看面试报告与评估结果
            </p>

            <div className="flex items-center gap-2 text-brand-400 text-sm font-medium">
              <span>进入管理面板</span>
              <svg className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </button>

          {/* Quick Interview Entry */}
          <button
            onClick={() => router.push('/quick')}
            className="group relative glass-card-hover rounded-3xl p-8 text-left"
          >
            <div className="absolute top-0 right-0 w-40 h-40 opacity-0 group-hover:opacity-10 pointer-events-none transition-opacity duration-500">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 blur-3xl" />
            </div>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-400 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/30 transition-shadow duration-300">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors duration-300">
              快速体验
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-5">
              无需链接，自由选择岗位和难度，快速开始一场 AI 模拟面试
            </p>

            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <span>开始面试</span>
              <svg className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="text-center space-y-3">
          <p className="text-gray-500 text-sm flex items-center justify-center gap-2">
            <svg className="w-4 h-4 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            面试过程中请确保麦克风正常工作，AI 面试官会通过语音与你交流
          </p>
          <p className="text-gray-600 text-xs tracking-wider">
            Powered by LiveKit · DeepSeek · SiliconFlow
          </p>
        </div>
      </div>
    </div>
  );
}
