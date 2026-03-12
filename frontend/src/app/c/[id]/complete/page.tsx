'use client';

import { use } from 'react';

export default function InterviewCompletePage({ params }: { params: Promise<{ id: string }> }) {
  use(params);

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center">
      <div className="max-w-md mx-auto px-6 text-center">
        <div className="glass-card rounded-3xl p-10">
          {/* Success icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/8 ring-1 ring-emerald-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-white mb-3 tracking-tight">面试已结束</h1>
          <p className="text-gray-400 text-base mb-2">感谢你的参与！</p>
          <p className="text-gray-600 text-sm mb-8">
            面试报告将由招聘方审阅，如有后续安排我们会通过邮件联系你。
          </p>

          <div className="glass-card rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-300 font-medium">温馨提示</p>
                <p className="text-xs text-gray-600">你可以安全地关闭此页面。</p>
              </div>
            </div>
          </div>

          <p className="text-gray-700 text-xs tracking-wider">
            Powered by AI Voice Interview System
          </p>
        </div>
      </div>
    </div>
  );
}
