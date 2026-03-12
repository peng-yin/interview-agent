'use client';

import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useRoomContext,
  useLocalParticipant,
  useVoiceAssistant,
  BarVisualizer,
  useTrackTranscription,
} from '@livekit/components-react';
import { Track, RoomEvent } from 'livekit-client';
import '@livekit/components-styles';
import { positionNames } from '@/lib/constants';

// 打字机效果组件：逐字符渲染文本
function TypewriterText({ text, isFinal, speed = 30 }: { text: string; isFinal: boolean; speed?: number }) {
  const [displayedLen, setDisplayedLen] = useState(0);
  const prevTextRef = useRef('');
  const displayedLenRef = useRef(0);
  const animFrameRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 同步 ref
  useEffect(() => {
    displayedLenRef.current = displayedLen;
  }, [displayedLen]);

  useEffect(() => {
    if (animFrameRef.current) clearTimeout(animFrameRef.current);

    const prevText = prevTextRef.current;
    const currentDisplayed = displayedLenRef.current;

    // 计算起始位置
    let startFrom: number;
    if (text.startsWith(prevText) && prevText.length > 0) {
      // 文本是追加的，从已展示的长度继续
      startFrom = Math.max(currentDisplayed, prevText.length);
    } else if (prevText.length > 0 && text !== prevText) {
      // 文本被完全替换了，重新开始
      startFrom = 0;
    } else {
      startFrom = currentDisplayed;
    }

    prevTextRef.current = text;

    if (startFrom >= text.length) {
      setDisplayedLen(text.length);
      return;
    }

    // 如果有较多需要追赶的字符，加快速度
    const charsToShow = text.length - startFrom;
    const baseDelay = charsToShow > 20 ? Math.max(8, speed * 0.3) : speed;

    let current = startFrom;
    setDisplayedLen(current);

    const tick = () => {
      current++;
      setDisplayedLen(current);
      if (current < text.length) {
        animFrameRef.current = setTimeout(tick, baseDelay);
      }
    };
    animFrameRef.current = setTimeout(tick, baseDelay * 0.5);

    return () => {
      if (animFrameRef.current) clearTimeout(animFrameRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed]);

  const shown = displayedLen >= text.length ? text : text.slice(0, displayedLen);
  const isTyping = displayedLen < text.length;

  return <>{shown}</>;
}

interface InterviewRoomProps {
  token: string;
  serverUrl: string;
  position: string;
  userName: string;
  duration?: number; // 面试时长（分钟），默认30
  onDisconnected: () => void;
  onReport: (report: Record<string, unknown>) => void;
}

export default function InterviewRoom({
  token,
  serverUrl,
  position,
  userName,
  duration = 30,
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
      <InterviewUI position={position} userName={userName} duration={duration} onEnd={onDisconnected} onReport={onReport} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  );
}

interface TranscriptMessage {
  id: string;
  role: 'agent' | 'user';
  text: string;
  timestamp: number;
  isFinal: boolean;
}

function InterviewUI({
  position,
  userName,
  duration = 30,
  onEnd,
  onReport,
}: {
  position: string;
  userName: string;
  duration?: number;
  onEnd: () => void;
  onReport: (report: Record<string, unknown>) => void;
}) {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const voiceAssistant = useVoiceAssistant();

  const INTERVIEW_DURATION = (duration || 30) * 60; // 面试时长（秒）

  const [isMuted, setIsMuted] = useState(false);
  const [micAvailable, setMicAvailable] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [isEnding, setIsEnding] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [showTranscript, setShowTranscript] = useState(true);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const lastAgentSegCountRef = useRef(0);
  const lastUserSegCountRef = useRef(0);
  const reportReceivedRef = useRef(false);
  const sendEndSignalRef = useRef<(reason: 'button' | 'timeout') => Promise<void>>(undefined);

  // Derive agent state from useVoiceAssistant
  const agentState = voiceAssistant.state;

  // Get agent transcriptions from voice assistant
  const agentTranscriptions = voiceAssistant.agentTranscriptions;

  // Get user (local participant) audio track for transcription
  // Use isMicrophoneEnabled from useLocalParticipant for reactive dependency
  const localAudioTrack = useMemo(() => {
    const pub = localParticipant.getTrackPublication(Track.Source.Microphone);
    if (pub && pub.track) {
      return {
        participant: localParticipant,
        publication: pub,
        source: Track.Source.Microphone as Track.Source,
      };
    }
    return undefined;
  }, [localParticipant, isMicrophoneEnabled]);

  const { segments: userTranscriptionSegments } = useTrackTranscription(localAudioTrack);

  // 构建稳定的 segment ID，确保同一段语音的多次更新使用相同 ID
  const getSegId = useCallback((seg: { id?: string; firstReceivedTime?: number }, prefix: string, index: number) => {
    if (seg.id) return `${prefix}-${seg.id}`;
    if (seg.firstReceivedTime) return `${prefix}-t${seg.firstReceivedTime}`;
    return `${prefix}-idx${index}`;
  }, []);

  // 对同角色连续相同文本的消息去重（STT可能对同一段语音生成多个不同ID但文本相同的segment）
  const dedupeByText = (messages: TranscriptMessage[]): TranscriptMessage[] => {
    const result: TranscriptMessage[] = [];
    for (const msg of messages) {
      const last = result[result.length - 1];
      // 跳过与上一条同角色且文本相同的消息
      if (last && last.role === msg.role && last.text === msg.text) continue;
      result.push(msg);
    }
    return result;
  };

  // Process agent transcriptions - 直接用 segments 数组做映射
  useEffect(() => {
    if (agentTranscriptions.length === 0) return;

    setTranscripts((prev) => {
      const userMessages = prev.filter((m) => m.role === 'user');
      const agentMessages: TranscriptMessage[] = [];
      const seenIds = new Set<string>();

      for (let i = 0; i < agentTranscriptions.length; i++) {
        const seg = agentTranscriptions[i];
        if (!seg.text?.trim()) continue;
        const segId = getSegId(seg, 'agent', i);

        if (seenIds.has(segId)) continue;
        seenIds.add(segId);

        agentMessages.push({
          id: segId,
          role: 'agent',
          text: seg.text,
          timestamp: seg.firstReceivedTime || Date.now(),
          isFinal: seg.final ?? false,
        });
      }

      const allMessages = [...userMessages, ...agentMessages];
      allMessages.sort((a, b) => a.timestamp - b.timestamp);
      return dedupeByText(allMessages);
    });
    lastAgentSegCountRef.current = agentTranscriptions.length;
  }, [agentTranscriptions, getSegId]);

  // Process user transcriptions - 同样直接映射
  useEffect(() => {
    if (userTranscriptionSegments.length === 0) return;

    setTranscripts((prev) => {
      const agentMessages = prev.filter((m) => m.role === 'agent');
      const userMessages: TranscriptMessage[] = [];
      const seenIds = new Set<string>();

      for (let i = 0; i < userTranscriptionSegments.length; i++) {
        const seg = userTranscriptionSegments[i];
        if (!seg.text?.trim()) continue;
        const segId = getSegId(seg, 'user', i);

        if (seenIds.has(segId)) continue;
        seenIds.add(segId);

        userMessages.push({
          id: segId,
          role: 'user',
          text: seg.text,
          timestamp: seg.firstReceivedTime || Date.now(),
          isFinal: seg.final ?? false,
        });
      }

      const allMessages = [...agentMessages, ...userMessages];
      allMessages.sort((a, b) => a.timestamp - b.timestamp);
      return dedupeByText(allMessages);
    });
    lastUserSegCountRef.current = userTranscriptionSegments.length;
  }, [userTranscriptionSegments, getSegId]);

  // Auto-scroll transcript - 使用 MutationObserver 监测内容变化（包括打字机效果）
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  useEffect(() => {
    const container = transcriptContainerRef.current;
    if (!container) return;

    const observer = new MutationObserver(() => {
      // 只有当用户滚动位置接近底部时才自动滚动
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      if (isNearBottom) {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [showTranscript]);

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
      room.disconnect();
      onEnd();
    }
  }, [room, isEnding, onEnd]);

  // Keep ref in sync for timer usage
  useEffect(() => {
    sendEndSignalRef.current = sendEndSignal;
  }, [sendEndSignal]);

  // Timer with auto-end on timeout (uses ref to avoid restarting interval)
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed((d) => {
        const next = d + 1;
        if (next >= INTERVIEW_DURATION) {
          sendEndSignalRef.current?.('timeout');
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [INTERVIEW_DURATION]);

  // Listen for interview report data from agent (only process first report)
  useEffect(() => {
    const handleDataReceived = (
      payload: Uint8Array,
      _participant: unknown,
      _kind: unknown,
      topic?: string
    ) => {
      if (topic === 'interview-report') {
        // Guard against duplicate reports
        if (reportReceivedRef.current) {
          console.log('Duplicate report received, ignoring.');
          return;
        }
        try {
          const decoder = new TextDecoder();
          const data = JSON.parse(decoder.decode(payload));
          if (data.type === 'interview-report') {
            reportReceivedRef.current = true;
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

  // Safety timeout - 报告收到后清除超时
  useEffect(() => {
    if (!isEnding) return;
    // 如果已收到报告，不需要安全超时
    if (reportReceivedRef.current) return;
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

  const remaining = Math.max(0, INTERVIEW_DURATION - elapsed);

  const getAgentStatusText = () => {
    switch (agentState) {
      case 'listening':
        return '正在倾听...';
      case 'thinking':
        return '思考中...';
      case 'speaking':
        return '正在回答...';
      case 'initializing':
        return '初始化中...';
      default:
        return '连接中...';
    }
  };

  const getAgentStatusColor = () => {
    switch (agentState) {
      case 'listening':
        return 'text-emerald-400';
      case 'thinking':
        return 'text-amber-400';
      case 'speaking':
        return 'text-brand-400';
      default:
        return 'text-gray-400';
    }
  };

  const getAgentGlowColor = () => {
    switch (agentState) {
      case 'listening':
        return 'shadow-[0_0_40px_rgba(16,185,129,0.15)]';
      case 'thinking':
        return 'shadow-[0_0_40px_rgba(245,158,11,0.15)]';
      case 'speaking':
        return 'shadow-[0_0_60px_rgba(105,56,239,0.35)]';
      default:
        return '';
    }
  };

  const progressPercent = Math.min((elapsed / INTERVIEW_DURATION) * 100, 100);

  return (
    <div className="h-screen flex flex-col relative overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* Subtle background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-20">
          <div className="absolute top-0 left-1/3 w-80 h-80 bg-primary/30 rounded-full blur-[150px]" />
          <div className="absolute top-20 right-1/3 w-64 h-64 bg-accent/20 rounded-full blur-[120px]" />
        </div>
      </div>

      {/* Ending overlay */}
      {isEnding && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl">
          <div className="glass-card rounded-3xl p-12 text-center max-w-sm">
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ring-pulse" />
              <div className="absolute inset-2 rounded-full border-2 border-primary/30 animate-pulse" />
              <div className="absolute inset-0 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
              <div className="absolute inset-5 rounded-full bg-primary/10 backdrop-blur-sm flex items-center justify-center">
                <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="text-white text-xl font-semibold mb-3">正在生成面试报告</div>
            <div className="text-gray-500 text-sm">AI 面试官正在整理评估结果，请稍候...</div>
            <div className="mt-6 h-1 w-48 mx-auto rounded-full bg-surface-3 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-accent animate-shimmer rounded-full" style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      )}

      {/* Top progress bar */}
      <div className="h-0.5 bg-surface-2 w-full relative">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${
            remaining <= 300
              ? 'bg-gradient-to-r from-red-500 to-orange-500'
              : 'bg-gradient-to-r from-primary to-accent'
          }`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-white">
              {positionNames[position]} 面试
            </span>
            <span className={`text-xs ml-2 ${getAgentStatusColor()}`}>
              {getAgentStatusText()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Transcript toggle */}
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className={`p-2 rounded-lg transition-all duration-200 ${
              showTranscript
                ? 'bg-primary/15 text-primary ring-1 ring-primary/20'
                : 'bg-surface-2 text-gray-500 hover:text-gray-300 ring-1 ring-white/[0.06]'
            }`}
            title={showTranscript ? '隐藏字幕' : '显示字幕'}
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
          </button>
          <div className="flex items-center gap-2 glass-card rounded-full px-4 py-1.5">
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-white font-mono tabular-nums">{formatTime(elapsed)}</span>
            <span className="text-gray-700">/</span>
            <span className={`text-sm font-mono tabular-nums ${remaining <= 300 ? 'text-red-400 animate-pulse' : 'text-gray-600'}`}>
              {formatTime(remaining)}
            </span>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Center: Agent visualization */}
        <div className={`flex-1 flex flex-col items-center justify-center transition-all duration-300 ${showTranscript ? 'pr-0' : ''}`}>
          <div className="flex flex-col items-center gap-8">
            {/* Agent circle with BarVisualizer */}
            <div className="relative">
              {/* Outer glow ring */}
              <div className={`w-52 h-52 rounded-full flex items-center justify-center transition-all duration-700 ${getAgentGlowColor()}`}>
                {/* Gradient border ring */}
                <div className="absolute inset-0 rounded-full p-[2px]">
                  <div className={`w-full h-full rounded-full transition-opacity duration-500 ${
                    agentState === 'speaking' ? 'opacity-100' : 'opacity-30'
                  }`} style={{
                    background: 'linear-gradient(135deg, rgba(105,56,239,0.4), rgba(167,139,250,0.2), rgba(105,56,239,0.4))',
                  }} />
                </div>

                {voiceAssistant.audioTrack ? (
                  <BarVisualizer
                    state={agentState}
                    track={voiceAssistant.audioTrack}
                    barCount={5}
                    className="w-full h-full rounded-full"
                    options={{ minHeight: 20, maxHeight: 80 }}
                  />
                ) : (
                  <div className="relative z-10 flex items-center justify-center w-44 h-44 rounded-full bg-gradient-to-br from-primary via-primary-light to-accent">
                    <span className="text-white text-5xl font-bold tracking-tight">AI</span>
                  </div>
                )}
              </div>

              {/* Thinking spinner */}
              {agentState === 'thinking' && (
                <div className="absolute -inset-4 rounded-full border border-amber-400/20 animate-spin-slow">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400 shadow-lg shadow-amber-400/50" />
                </div>
              )}

              {/* Listening pulse rings */}
              {agentState === 'listening' && (
                <>
                  <div className="absolute -inset-3 rounded-full border border-emerald-400/10 animate-ring-pulse" />
                  <div className="absolute -inset-6 rounded-full border border-emerald-400/5 animate-ring-pulse" style={{ animationDelay: '0.5s' }} />
                </>
              )}
            </div>

            {/* Agent label */}
            <div className="text-center">
              <div className="text-white text-lg font-semibold tracking-tight">
                {positionNames[position]} 面试官
              </div>
              <div className={`text-sm mt-1.5 font-medium ${getAgentStatusColor()}`}>
                {getAgentStatusText()}
              </div>
            </div>

            {/* User section */}
            <div className="flex items-center gap-3 glass-card rounded-2xl px-5 py-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-amber-500/20">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-white text-sm font-medium">{userName}</div>
                <div className="text-xs text-gray-500">
                  {!micAvailable ? '麦克风不可用' : isMuted ? '已静音' : '麦克风开启'}
                </div>
              </div>
              {!isMuted && agentState === 'listening' && (
                <div className="flex gap-[3px] ml-2 items-end h-4">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-[3px] bg-emerald-400/80 rounded-full talking-bar"
                      style={{ height: '4px' }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Transcript panel */}
        {showTranscript && (
          <div className="w-[380px] border-l border-white/[0.04] flex flex-col bg-surface-1/50 backdrop-blur-sm">
            <div className="px-5 py-3.5 border-b border-white/[0.04] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <span className="text-sm font-medium text-gray-400">实时转录</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] text-gray-600 font-medium tracking-widest uppercase">Live</span>
              </div>
            </div>

            <div ref={transcriptContainerRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
              {transcripts.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 text-sm gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-3 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p>对话开始后，转录内容将在此显示</p>
                </div>
              )}
              {transcripts.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 animate-msg-in ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold mt-0.5 ${
                    msg.role === 'agent'
                      ? 'bg-gradient-to-br from-primary to-primary-light text-white'
                      : 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                  }`}>
                    {msg.role === 'agent' ? 'AI' : userName.charAt(0).toUpperCase()}
                  </div>
                  <div
                    className={`max-w-[280px] rounded-2xl px-3.5 py-2.5 text-[13px] leading-[1.7] transition-opacity duration-300 ${
                      msg.role === 'agent'
                        ? 'bg-surface-2 text-gray-300 rounded-tl-md'
                        : 'bg-primary/12 text-gray-300 rounded-tr-md'
                    } ${!msg.isFinal ? 'opacity-80' : 'opacity-100'}`}
                  >
                    <TypewriterText text={msg.text} isFinal={msg.isFinal} speed={25} />
                  </div>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="px-6 py-5 flex items-center justify-center gap-4 border-t border-white/[0.04]">
        <button
          onClick={toggleMute}
          className={`group relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 ${
            isMuted
              ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30 hover:bg-red-500/25'
              : 'bg-surface-2 text-white ring-1 ring-white/[0.08] hover:ring-white/[0.15] hover:bg-surface-3'
          }`}
          title={isMuted ? '取消静音' : '静音'}
        >
          {isMuted ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        <button
          onClick={handleEnd}
          disabled={isEnding}
          className={`relative px-8 py-3.5 rounded-full font-medium transition-all duration-200 ${
            isEnding
              ? 'bg-yellow-600/60 text-white/80 cursor-not-allowed'
              : 'bg-red-600 text-white hover:bg-red-500 hover:shadow-lg hover:shadow-red-600/25 active:scale-95'
          }`}
        >
          {isEnding ? (
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              生成报告中...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 3l-6 6m0 0V4m0 5h5M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
              </svg>
              结束面试
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
