'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import InterviewRoom from '@/components/InterviewRoom';
import { LoadingSpinner, PageLoading } from '@/components/LoadingSpinner';

function InterviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState('');
  const [isConnecting, setIsConnecting] = useState(true);

  const position = searchParams.get('position') || 'frontend';
  const difficulty = searchParams.get('difficulty') || 'mid';
  const userName = searchParams.get('name') || 'Candidate';
  const hasResume = searchParams.get('hasResume') === 'true';

  useEffect(() => {
    let cancelled = false;

    async function getToken() {
      try {
        // 从 sessionStorage 读取简历（避免 URL 过长）
        // 注意：不立即删除，等 token 请求成功后再清理，防止 StrictMode 或请求失败时丢失数据
        let resume = '';
        if (hasResume) {
          resume = sessionStorage.getItem('interview-resume') || '';
        }

        const response = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participant_name: userName,
            participant_identity: `user-${Date.now()}`,
            position,
            difficulty,
            resume,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get token');
        }

        const data = await response.json();
        if (!cancelled) {
          // Token 获取成功后清理 sessionStorage 中的简历数据
          sessionStorage.removeItem('interview-resume');
          setToken(data.participantToken);
          setServerUrl(data.serverUrl);
          setIsConnecting(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('连接面试服务器失败，请重试');
          setIsConnecting(false);
        }
      }
    }

    getToken();
    return () => { cancelled = true; };
  }, [position, difficulty, userName, hasResume]);

  const handleDisconnected = () => {
    // 如果已经有报告数据，说明是面试正常结束，跳到报告页
    const existingReport = sessionStorage.getItem('interview-report');
    if (existingReport) {
      router.push('/report');
    } else {
      router.push('/');
    }
  };

  const handleReport = (report: Record<string, unknown>) => {
    // Store report in sessionStorage for the report page to read
    sessionStorage.setItem('interview-report', JSON.stringify(report));
    router.push('/report');
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center">
          <div className="text-red-400 text-xl mb-4">连接失败</div>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-primary/50 animate-pulse" />
            <div className="absolute inset-4 rounded-full bg-primary/20 flex items-center justify-center">
              <LoadingSpinner className="w-6 h-6 text-primary" />
            </div>
          </div>
          <p className="text-gray-400">正在连接面试房间...</p>
        </div>
      </div>
    );
  }

  return (
    <InterviewRoom
      token={token}
      serverUrl={serverUrl}
      position={position}
      userName={userName}
      onDisconnected={handleDisconnected}
      onReport={handleReport}
    />
  );
}

export default function InterviewPage() {
  return (
    <Suspense fallback={<PageLoading text="Loading..." />}>
      <InterviewContent />
    </Suspense>
  );
}