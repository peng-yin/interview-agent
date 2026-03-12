'use client';

import { useEffect, useState, Suspense, use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import InterviewRoom from '@/components/InterviewRoom';
import { LoadingSpinner, PageLoading } from '@/components/LoadingSpinner';
import { updateInterviewCandidate, updateInterviewRoom } from './actions';

function InterviewContent({ interviewId }: { interviewId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [position, setPosition] = useState('');
  const [interviewDuration, setInterviewDuration] = useState(30);
  const [error, setError] = useState('');
  const [isConnecting, setIsConnecting] = useState(true);

  const userName = searchParams.get('name') || 'Candidate';
  const email = searchParams.get('email') || '';

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        // Fetch interview info
        const infoRes = await fetch(`/api/interviews/${interviewId}`);
        if (!infoRes.ok) {
          throw new Error('面试不存在');
        }
        const infoData = await infoRes.json();
        const interview = infoData.interview;

        if (interview.status === 'completed') {
          router.push(`/c/${interviewId}/complete`);
          return;
        }

        // Update candidate info
        await updateInterviewCandidate(interviewId, userName, email);

        // Get resume from interview data (uploaded by recruiter)
        const resume = interview.resume || '';

        // Get LiveKit token
        const response = await fetch('/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participant_name: userName,
            participant_identity: `candidate-${interviewId}-${Date.now()}`,
            room_name: `interview-${interviewId}`,
            position: interview.position,
            difficulty: interview.difficulty,
            resume,
            interview_id: interviewId,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get token');
        }

        const data = await response.json();
        if (!cancelled) {
          // Update room name in DB
          await updateInterviewRoom(interviewId, data.roomName);
          setToken(data.participantToken);
          setServerUrl(data.serverUrl);
          setPosition(interview.position);
          setInterviewDuration(interview.duration || 30);
          setIsConnecting(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '连接失败，请重试');
          setIsConnecting(false);
        }
      }
    }

    connect();
    return () => { cancelled = true; };
  }, [interviewId, userName, email, router]);

  const handleDisconnected = () => {
    router.push(`/c/${interviewId}/complete`);
  };

  const handleReport = async (report: Record<string, unknown>) => {
    // Save report to database
    try {
      await fetch(`/api/interviews/${interviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report }),
      });
    } catch (err) {
      console.error('Failed to save report:', err);
    }
    router.push(`/c/${interviewId}/complete`);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="glass-card rounded-2xl p-8 max-w-md text-center">
          <div className="text-red-400 text-xl mb-4">连接失败</div>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push(`/c/${interviewId}`)}
            className="px-6 py-3 rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors"
          >
            返回
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
      duration={interviewDuration}
      onDisconnected={handleDisconnected}
      onReport={handleReport}
    />
  );
}

export default function CandidateInterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<PageLoading text="Loading..." />}>
      <InterviewContent interviewId={id} />
    </Suspense>
  );
}
