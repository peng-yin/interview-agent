'use client';

import { useEffect, useCallback, useState } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useParticipants,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react';
import { Track, RoomEvent, ConnectionState } from 'livekit-client';
import '@livekit/components-styles';
import { positionNames } from '@/lib/constants';

interface InterviewRoomProps {
  token: string;
  serverUrl: string;
  position: string;
  userName: string;
  onDisconnected: () => void;
  onReport: (report: Record<string, unknown>) => void;
}

export default function InterviewRoom({
  token,
  serverUrl,
  position,
  userName,
  onDisconnected,
  onReport,
}: InterviewRoomProps) {
  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect={true}
      audio={false}
      video={false}
      onDisconnected={onDisconnected}
      data-lk-theme="default"
      style={{ height: '100vh' }}
    >
      <InterviewUI position={position} userName={userName} onEnd={onDisconnected} onReport={onReport} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

const INTERVIEW_DURATION = 30 * 60; // 30 minutes in seconds

function InterviewUI({
  position,
  userName,
  onEnd,
  onReport,
}: {
  position: string;
  userName: string;
  onEnd: () => void;
  onReport: (report: Record<string, unknown>) => void;
}) {
  const room = useRoomContext();
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [isMuted, setIsMuted] = useState(false);
  const [micAvailable, setMicAvailable] = useState(true);
  const [duration, setDuration] = useState(0);
  const [agentState, setAgentState] = useState<string>('connecting');
  const [isEnding, setIsEnding] = useState(false);

  // Try to enable microphone after room connects
  useEffect(() => {
    let cancelled = false;
    async function enableMic() {
      try {
        await localParticipant.setMicrophoneEnabled(true);
        if (!cancelled) {
          setMicAvailable(true);
          setIsMuted(false);
        }
      } catch (err) {
        console.warn('Microphone not available, continuing without mic:', err);
        if (!cancelled) {
          setMicAvailable(false);
          setIsMuted(true);
        }
      }
    }
    if (room.state === 'connected') {
      enableMic();
    }
    const handleConnected = () => { enableMic(); };
    room.on(RoomEvent.Connected, handleConnected);
    return () => {
      cancelled = true;
      room.off(RoomEvent.Connected, handleConnected);
    };
  }, [room, localParticipant]);

  // Send end signal to agent via data channel
  const sendEndSignal = useCallback(async (reason: 'button' | 'timeout') => {
    if (isEnding) return;
    setIsEnding(true);
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify({ type: 'end-interview', reason }));
      await room.localParticipant?.publishData(data, {
        reliable: true,
        topic: 'end-interview',
      });
    } catch (err) {
      console.error('Failed to send end signal:', err);
      // Fallback: disconnect directly
      room.disconnect();
      onEnd();
    }
  }, [room, isEnding, onEnd]);

  // Timer with auto-end on timeout
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((d) => {
        const next = d + 1;
        if (next >= INTERVIEW_DURATION) {
          sendEndSignal('timeout');
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [sendEndSignal]);

  // Agent state tracking
  useEffect(() => {
    const agentParticipant = participants.find(
      (p) => p.identity !== localParticipant.identity
    );

    if (agentParticipant) {
      setAgentState('connected');
      const attrs = agentParticipant.attributes;
      if (attrs?.['lk.agent.state']) {
        setAgentState(attrs['lk.agent.state']);
      }
    }
  }, [participants, localParticipant]);

  // Listen for attribute changes
  useEffect(() => {
    const handleAttrsChanged = () => {
      const agentParticipant = participants.find(
        (p) => p.identity !== localParticipant.identity
      );
      if (agentParticipant?.attributes?.['lk.agent.state']) {
        setAgentState(agentParticipant.attributes['lk.agent.state']);
      }
    };

    room.on(RoomEvent.ParticipantAttributesChanged, handleAttrsChanged);
    return () => {
      room.off(RoomEvent.ParticipantAttributesChanged, handleAttrsChanged);
    };
  }, [room, participants, localParticipant]);

  // Listen for interview report data from agent
  useEffect(() => {
    const handleDataReceived = (
      payload: Uint8Array,
      participant: unknown,
      kind: unknown,
      topic?: string
    ) => {
      if (topic === 'interview-report') {
        try {
          const decoder = new TextDecoder();
          const data = JSON.parse(decoder.decode(payload));
          if (data.type === 'interview-report') {
            setIsEnding(true);
            onReport(data);
          }
        } catch (err) {
          console.error('Failed to parse interview report:', err);
        }
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, onReport]);

  // Safety timeout: if ending and no report received within 60s, disconnect anyway
  useEffect(() => {
    if (!isEnding) return;
    const timeout = setTimeout(() => {
      console.warn('Report generation timed out, disconnecting...');
      room.disconnect();
      onEnd();
    }, 60000);
    return () => clearTimeout(timeout);
  }, [isEnding, room, onEnd]);

  const toggleMute = useCallback(async () => {
    if (!micAvailable) return;
    try {
      await localParticipant.setMicrophoneEnabled(isMuted);
      setIsMuted(!isMuted);
    } catch (err) {
      console.warn('Failed to toggle microphone:', err);
      setMicAvailable(false);
      setIsMuted(true);
    }
  }, [localParticipant, isMuted, micAvailable]);

  const handleEnd = useCallback(() => {
    sendEndSignal('button');
  }, [sendEndSignal]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const remaining = Math.max(0, INTERVIEW_DURATION - duration);

  const getAgentStatusText = () => {
    switch (agentState) {
      case 'listening':
        return '正在听你说...';
      case 'thinking':
        return '正在思考...';
      case 'speaking':
        return '正在回答...';
      case 'connected':
        return '已连接';
      default:
        return '连接中...';
    }
  };

  const getAgentStatusColor = () => {
    switch (agentState) {
      case 'listening':
        return 'bg-green-500';
      case 'thinking':
        return 'bg-yellow-500';
      case 'speaking':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-between gradient-bg p-6 relative">
      {/* Ending overlay */}
      {isEnding && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <div className="text-white text-lg font-medium">正在生成面试报告...</div>
            <div className="text-gray-400 text-sm mt-2">AI 面试官正在整理评估结果，请稍候</div>
          </div>
        </div>
      )}
      {/* Top bar */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${getAgentStatusColor()} animate-pulse`} />
          <span className="text-sm text-gray-400">
            {positionNames[position]} 面试
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-400 font-mono">{formatTime(duration)}</div>
          <div className="text-sm text-gray-500">/</div>
          <div className={`text-sm font-mono ${remaining <= 300 ? 'text-red-400' : 'text-gray-500'}`}>
            剩余 {formatTime(remaining)}
          </div>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex items-center justify-center gap-12">
        {/* Agent Avatar */}
        <div className="flex flex-col items-center gap-4">
          <div
            className={`relative w-40 h-40 rounded-2xl overflow-hidden ${
              agentState === 'speaking' ? 'animate-glow' : ''
            }`}
          >
            <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center">
              <div className="text-white text-4xl font-bold">AI</div>
            </div>
            {agentState === 'speaking' && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 h-4 bg-white/80 rounded-full audio-bar"
                  />
                ))}
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-white font-medium">
              {positionNames[position]} 面试官
            </div>
            <div className="text-sm text-gray-400 mt-1">
              {getAgentStatusText()}
            </div>
          </div>
        </div>

        {/* User Avatar */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-40 h-40 rounded-2xl overflow-hidden border-2 border-surface-border">
            <div className="w-full h-full bg-surface-light flex items-center justify-center">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-2xl font-bold">
                {userName.charAt(0).toUpperCase()}
              </div>
            </div>
            {!isMuted && agentState === 'listening' && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 h-4 bg-green-400/80 rounded-full audio-bar"
                  />
                ))}
              </div>
            )}
          </div>
          <div className="text-center">
            <div className="text-white font-medium">{userName}</div>
            <div className="text-sm text-gray-400 mt-1">
              {!micAvailable ? '麦克风不可用' : isMuted ? '麦克风已关闭' : '麦克风开启中'}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            isMuted
              ? 'bg-red-500/20 border border-red-500/40 text-red-400'
              : 'bg-surface-light border border-surface-border text-white hover:bg-surface-border'
          }`}
          title={isMuted ? '取消静音' : '静音'}
        >
          {isMuted ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        <button
          onClick={handleEnd}
          disabled={isEnding}
          className={`px-8 py-3 rounded-full font-medium transition-colors ${
            isEnding
              ? 'bg-yellow-600 text-white cursor-not-allowed'
              : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {isEnding ? '生成报告中...' : '结束面试'}
        </button>
      </div>
    </div>
  );
}
