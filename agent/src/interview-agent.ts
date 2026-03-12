import { voice, llm } from '@livekit/agents';
import type { Room } from '@livekit/rtc-node';
import { z } from 'zod';
import { searchQuestions, formatRAGResults } from './rag/knowledge-base.js';
import { getInterviewerInstructions } from './prompts/interviewer.js';
import { publishJsonData } from './utils/data-channel.js';

interface InterviewConfig {
  position: string;
  resume?: string;
  difficulty?: string;
  chatCtx?: llm.ChatContext;
  room: Room;
}

// 用于检测用户是否想结束面试的关键词
const END_INTERVIEW_KEYWORDS = [
  '结束面试', '结束吧', '面试结束', '到此结束', '就到这里',
  '不想继续', '没有问题了', '今天就到这', '可以结束了',
  '我说完了', '没什么要说的了', '告辞', '再见',
];

export class InterviewAgent extends voice.Agent {
  private position: string;
  private questionCount: number = 0;
  private useRAG: boolean;
  private isEnding: boolean = false;
  private room: Room;

  constructor(config: InterviewConfig) {
    const instructions = getInterviewerInstructions(config.position, config.resume);
    const room = config.room;

    super({
      instructions,
      chatCtx: config.chatCtx,
      tools: {
        endInterview: llm.tool({
          description: '当面试结束时调用此工具，生成面试评估报告。你需要根据整场面试的对话内容，对候选人进行全面评估。',
          parameters: z.object({
            overallComment: z.string().describe('总体评价，一句话概括候选人表现'),
            technicalScore: z.number().min(1).max(10).describe('技术能力评分，1-10分'),
            communicationScore: z.number().min(1).max(10).describe('沟通表达评分，1-10分'),
            experienceScore: z.number().min(1).max(10).describe('项目经验评分，1-10分'),
            problemSolvingScore: z.number().min(1).max(10).describe('问题解决能力评分，1-10分'),
            highlights: z.array(z.string()).describe('候选人的亮点，列出2-4条'),
            improvements: z.array(z.string()).describe('候选人需要提高的地方，列出2-4条'),
            recommendation: z.enum(['强烈推荐', '推荐', '待定', '不推荐']).describe('是否推荐进入下一轮'),
            detailedFeedback: z.string().describe('详细反馈，100-300字的综合评价'),
          }),
          execute: async (report) => {
            console.log('endInterview tool called, preparing report...');
            try {
              const reportData = {
                type: 'interview-report',
                position: config.position,
                difficulty: config.difficulty || '中级',
                timestamp: new Date().toISOString(),
                ...report,
              };
              console.log('Publishing report data to frontend...');
              await publishJsonData(room, 'interview-report', reportData);
              console.log('Interview report sent to frontend');
              // Wait a moment to ensure data is flushed before session ends
              await new Promise((resolve) => setTimeout(resolve, 2000));
            } catch (err) {
              console.error('Failed to send report:', err);
            }
            return `面试评估已生成并发送给候选人。`;
          },
        }),
      },
    });

    this.position = config.position;
    this.useRAG = process.env.CHROMA_URL ? true : false;
    this.room = config.room;
  }

  private detectEndInterview(text: string): boolean {
    return END_INTERVIEW_KEYWORDS.some((keyword) => text.includes(keyword));
  }

  async onUserTurnCompleted(
    turnCtx: llm.ChatContext,
    newMessage: llm.ChatMessage
  ): Promise<void> {
    this.questionCount++;

    const userText = newMessage.textContent;
    if (!userText || userText.length < 2) return;

    // 检测用户是否想通过语音结束面试
    if (!this.isEnding && this.detectEndInterview(userText)) {
      this.isEnding = true;
      console.log('Detected end-interview intent from user speech:', userText);

      // 让 Agent 口头总结，不依赖 LLM 调用工具
      this.session.generateReply({
        instructions: `候选人表示想要结束面试（原话："${userText}"）。请你简短地对候选人做一个口头总结（2-3句话），感谢候选人的参与。不要再问新问题了。不要调用任何工具。`,
      });

      // 通过 data channel 发送结束信号，触发 main.ts 中的可靠报告生成逻辑
      try {
        await publishJsonData(this.room, 'end-interview-voice', { type: 'end-interview', reason: 'voice' });
        console.log('Sent end-interview-voice signal to main.ts');
      } catch (err) {
        console.error('Failed to send end-interview-voice signal:', err);
      }
      return;
    }

    if (!this.useRAG) return;

    try {
      const results = await searchQuestions(userText, this.position, 2);
      if (results.length > 0) {
        const ragContent = formatRAGResults(results);
        turnCtx.addMessage({
          role: 'assistant',
          content: `[面试题库参考 - 仅供你参考，不要直接念出来]\n${ragContent}\n\n请根据候选人的回答水平，结合以上参考信息，自然地追问或过渡到下一个问题。`,
        });
      }
    } catch (error) {
      console.error('RAG lookup failed:', error);
    }
  }
}
