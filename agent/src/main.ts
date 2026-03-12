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
    const messages = chatCtx.items
      .filter((item): item is { role: string; textContent?: string; type: string } =>
        'role' in item && item.type === 'message'
      )
      .map((m) => ({
        role: m.role,
        content: m.textContent || '',
      }));

    const reportLLM = new openai.LLM({
      model: process.env.LLM_MODEL || 'deepseek-ai/DeepSeek-V3',
      ...siliconFlowConfig,
    });

    const reportPrompt = `你是一位资深的面试评估专家。根据以下面试对话记录，生成一份结构化的面试评估报告。

面试对话记录：
${messages.map((m) => `${m.role}: ${m.content}`).join('\n')}

请严格按照以下 JSON 格式返回评估报告（不要添加其他内容，只返回 JSON）：
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
}

注意：由于面试时间很短，请基于已有对话做出合理评估。如果对话内容不多，可以适当说明。`;

    const chatContext = new llm.ChatContext();
    chatContext.addMessage({
      role: 'user',
      content: reportPrompt,
    });

    const reportStream = reportLLM.chat({
      chatCtx: chatContext,
    });

    let reportText = '';
    for await (const chunk of reportStream) {
      if (chunk.delta?.content) {
        reportText += chunk.delta.content;
      }
    }

    console.log('Raw report from LLM:', reportText);

    // Extract JSON from response
    const jsonMatch = reportText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Failed to extract JSON from LLM report response');
      // Send a fallback report
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
      console.log('Fallback report sent to frontend');
      return;
    }

    const reportData = JSON.parse(jsonMatch[0]);
    const fullReport = {
      type: 'interview-report',
      position,
      difficulty,
      timestamp: new Date().toISOString(),
      ...reportData,
    };

    await publishJsonData(ctx.room, 'interview-report', fullReport);
    console.log('Interview report sent to frontend');
    // Wait to ensure data is flushed
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (err) {
    console.error('Failed to generate/send report:', err);
  }
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
        voice: process.env.TTS_VOICE || 'FunAudioLLM/CosyVoice2-0.5B:alex',
        ...siliconFlowConfig,
      }),
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
    const greetingInstructions = `用友好的语气和候选人打招呼，简单介绍你是${positionLabel}技术面试官，然后请候选人做一个简单的自我介绍。`;

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
