import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// dotenv 不覆盖已有变量，所以先加载优先级高的文件
const __dirname2 = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname2, '../../.env.local') }); // 本地覆盖（可选）
dotenv.config({ path: resolve(__dirname2, '../../.env') });       // 兜底配置

import {
  type JobContext,
  type JobProcess,
  ServerOptions,
  cli,
  defineAgent,
  voice,
  llm,
} from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';
import { InterviewAgent } from './interview-agent.js';
import { publishJsonData } from './utils/data-channel.js';
import { getSiliconFlowConfig, positionNames } from './utils/config.js';

async function generateAndSendReport(
  session: voice.AgentSession,
  ctx: JobContext,
  position: string,
  difficulty: string,
  siliconFlowConfig: { baseURL: string; apiKey: string | undefined },
) {
  try {
    // Collect chat history for report generation
    const chatCtx = session.chatCtx;
    console.log(`[Report] chatCtx has ${chatCtx.items.length} items`);

    const messages: { role: string; content: string }[] = [];
    for (const item of chatCtx.items) {
      if (item.type === 'message') {
        const msg = item as llm.ChatMessage;
        const text = msg.textContent || '';
        if (text.trim()) {
          messages.push({ role: msg.role, content: text });
        }
      }
    }

    console.log(`[Report] Extracted ${messages.length} messages for report`);
    if (messages.length > 0) {
      console.log('[Report] Messages preview:', messages.slice(0, 3).map(m => `${m.role}: ${m.content.substring(0, 50)}...`));
    }

    // If no messages at all, send fallback directly
    if (messages.length === 0) {
      console.log('[Report] No messages found, sending fallback report');
      await sendFallbackReport(ctx, position, difficulty);
      return;
    }

    const reportLLM = new openai.LLM({
      model: process.env.LLM_MODEL || 'deepseek-ai/DeepSeek-V3',
      ...siliconFlowConfig,
    });

    const reportPrompt = `你是一位资深的面试评估专家。根据以下面试对话记录，生成一份结构化的面试评估报告。

面试对话记录：
${messages.map((m) => `${m.role === 'assistant' ? '面试官' : '候选人'}: ${m.content}`).join('\n')}

请严格按照以下 JSON 格式返回评估报告（不要添加markdown代码块标记，不要添加其他内容，只返回纯 JSON）：
{
  "overallComment": "总体评价，一句话概括候选人表现",
  "technicalScore": 数字1-10,
  "communicationScore": 数字1-10,
  "experienceScore": 数字1-10,
  "problemSolvingScore": 数字1-10,
  "highlights": ["亮点1", "亮点2"],
  "improvements": ["改进点1", "改进点2"],
  "recommendation": "推荐/待定/不推荐/强烈推荐",
  "detailedFeedback": "详细反馈，100-300字的综合评价"
}`;

    const chatContext = new llm.ChatContext();
    chatContext.addMessage({
      role: 'user',
      content: reportPrompt,
    });

    console.log('[Report] Calling LLM for report generation...');
    const reportStream = reportLLM.chat({
      chatCtx: chatContext,
    });

    let reportText = '';
    for await (const chunk of reportStream) {
      if (chunk.delta?.content) {
        reportText += chunk.delta.content;
      }
    }

    console.log('[Report] Raw report from LLM (length=%d):', reportText.length, reportText);

    // Extract JSON from response - strip markdown code block if present
    let cleanedText = reportText.trim();
    // Remove ```json ... ``` wrapping
    cleanedText = cleanedText.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Report] Failed to extract JSON from LLM response, sending fallback');
      await sendFallbackReport(ctx, position, difficulty);
      return;
    }

    let reportData;
    try {
      reportData = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error('[Report] JSON parse error:', parseErr, 'Raw JSON:', jsonMatch[0].substring(0, 200));
      await sendFallbackReport(ctx, position, difficulty);
      return;
    }

    // Validate required fields
    const requiredFields = ['overallComment', 'technicalScore', 'communicationScore', 'experienceScore', 'problemSolvingScore', 'recommendation', 'detailedFeedback'];
    const missingFields = requiredFields.filter(f => !(f in reportData));
    if (missingFields.length > 0) {
      console.error('[Report] Missing required fields:', missingFields);
      await sendFallbackReport(ctx, position, difficulty);
      return;
    }

    const fullReport = {
      type: 'interview-report',
      position,
      difficulty,
      timestamp: new Date().toISOString(),
      ...reportData,
      // Ensure arrays
      highlights: Array.isArray(reportData.highlights) ? reportData.highlights : ['候选人参与了面试'],
      improvements: Array.isArray(reportData.improvements) ? reportData.improvements : ['建议进行更长时间的面试'],
    };

    await publishJsonData(ctx.room, 'interview-report', fullReport);
    console.log('[Report] Interview report sent to frontend successfully');
    // Wait to ensure data is flushed
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (err) {
    console.error('[Report] Failed to generate/send report:', err);
    // Try sending fallback on any error
    try {
      await sendFallbackReport(ctx, position, difficulty);
    } catch (fallbackErr) {
      console.error('[Report] Even fallback report failed:', fallbackErr);
    }
  }
}

async function sendFallbackReport(ctx: JobContext, position: string, difficulty: string) {
  const fallbackReport = {
    type: 'interview-report',
    position,
    difficulty,
    timestamp: new Date().toISOString(),
    overallComment: '面试时间较短，无法进行完整评估',
    technicalScore: 5,
    communicationScore: 5,
    experienceScore: 5,
    problemSolvingScore: 5,
    highlights: ['候选人参与了面试'],
    improvements: ['建议进行更长时间的面试以充分展示能力'],
    recommendation: '待定',
    detailedFeedback: '由于面试时间较短，无法对候选人进行全面评估。建议安排更长时间的面试。',
  };
  await publishJsonData(ctx.room, 'interview-report', fallbackReport);
  console.log('[Report] Fallback report sent to frontend');
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    const vad = ctx.proc.userData.vad! as silero.VAD;

    // Parse metadata from job dispatch
    let position = 'frontend';
    let resume: string | undefined;
    let difficulty = '中级';

    try {
      if (ctx.job.metadata) {
        const metadata = JSON.parse(ctx.job.metadata);
        position = metadata.position || 'frontend';
        resume = metadata.resume;
        difficulty = metadata.difficulty || '中级';
      }
    } catch {
      console.log('No metadata or invalid metadata, using defaults');
    }

    // Also check participant attributes
    await ctx.connect();
    const participant = await ctx.waitForParticipant();

    if (participant.attributes) {
      position = participant.attributes['interview.position'] || position;
      if (participant.attributes['interview.resume']) {
        resume = participant.attributes['interview.resume'];
      }
    }

    console.log(`Starting interview - Position: ${position}, Has Resume: ${!!resume}`);

    const siliconFlowConfig = getSiliconFlowConfig();

    const session = new voice.AgentSession({
      vad,
      stt: new openai.STT({
        model: process.env.STT_MODEL || 'FunAudioLLM/SenseVoiceSmall',
        language: 'zh',
        ...siliconFlowConfig,
      }),
      llm: new openai.LLM({
        model: process.env.LLM_MODEL || 'deepseek-ai/DeepSeek-V3',
        ...siliconFlowConfig,
      }),
      tts: new openai.TTS({
        model: process.env.TTS_MODEL || 'FunAudioLLM/CosyVoice2-0.5B',
        voice: (process.env.TTS_VOICE || 'FunAudioLLM/CosyVoice2-0.5B:alex') as any,
        speed: Number(process.env.TTS_SPEED) || 0.9,
        ...siliconFlowConfig,
      }),
      turnDetection: 'stt',
      voiceOptions: {
        minEndpointingDelay: 800,     // 800ms silence before considering end-of-turn (give candidates time to think)
        maxEndpointingDelay: 3000,    // Max 3s before forcing end-of-turn
        minInterruptionDuration: 500, // 500ms of speech needed to interrupt the agent
        minInterruptionWords: 1,      // Require at least 1 word before agent can be interrupted (Chinese-friendly)
        allowInterruptions: true,
        userAwayTimeout: 20,          // 20s without speech triggers away state (interview needs more thinking time)
      },
    });

    // Create interview agent with position & resume context
    const agent = new InterviewAgent({
      position,
      resume,
      difficulty,
      room: ctx.room,
    });

    await session.start({
      agent,
      room: ctx.room,
    });

    // 当用户长时间不说话时，主动追问
    let awayCount = 0;
    session.on(voice.AgentSessionEventTypes.UserStateChanged, (ev: voice.UserStateChangedEvent) => {
      if (ev.newState === 'away') {
        awayCount++;
        console.log(`User away detected (count: ${awayCount})`);
        if (awayCount <= 3) {
          // 前3次主动引导
          const prompts = [
            '候选人沉默了一段时间，可能在思考或没听清。请用友好的语气提醒一下，比如"你好，能听到我说话吗？如果准备好了可以开始回答"',
            '候选人仍然没有回应，请换一种方式引导，比如"没关系，我们可以先从一个简单的问题开始，你方便做一下自我介绍吗？"',
            '候选人持续沉默，请温和地询问是否遇到了技术问题，比如"你的麦克风是否正常工作？如果有任何问题可以告诉我"',
          ];
          session.generateReply({
            instructions: prompts[awayCount - 1],
          });
        }
      }
    });

    // Listen for end-interview signal from frontend (button click or timer)
    ctx.room.on('dataReceived', async (payload: Uint8Array, _participant?: unknown, _kind?: unknown, topic?: string) => {
      if (topic === 'end-interview') {
        console.log('Received end-interview signal from frontend');
        try {
          const decoder = new TextDecoder();
          const data = JSON.parse(decoder.decode(payload));
          const reason = data.reason === 'timeout' ? '面试时间已到' : '候选人点击了结束面试按钮';

          // Let the agent say a brief closing remark
          session.generateReply({
            instructions: `面试现在需要结束了，原因：${reason}。请你简短地对候选人做一个口头总结（2-3句话），感谢候选人的参与。不要再问新问题了。不要调用任何工具。`,
          });

          // Wait for the closing remark to be spoken, then generate report via code
          setTimeout(async () => {
            console.log('Generating report via direct LLM call...');
            await generateAndSendReport(session, ctx, position, difficulty, siliconFlowConfig);
          }, 5000); // Wait 5 seconds for closing remark
        } catch (err) {
          console.error('Failed to parse end-interview signal:', err);
        }
      }

      // Listen for voice-detected end-interview signal from InterviewAgent
      if (topic === 'end-interview-voice') {
        console.log('Received end-interview-voice signal from InterviewAgent');
        // Agent already said closing remark via generateReply in interview-agent.ts
        setTimeout(async () => {
          console.log('Generating report via direct LLM call (voice trigger)...');
          await generateAndSendReport(session, ctx, position, difficulty, siliconFlowConfig);
        }, 5000);
      }
    });

    // Generate initial greeting
    const positionLabel = positionNames[position] || '技术';
    const greetingInstructions = `你是${positionLabel}技术面试官。现在面试刚开始，请用简短友好的语气和候选人打招呼，介绍你自己是${positionLabel}技术面试官，然后请候选人做一个简单的自我介绍。注意：只说和技术面试相关的内容，不要偏离主题。`;

    session.generateReply({
      instructions: greetingInstructions,
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'interview-agent',
  })
);
