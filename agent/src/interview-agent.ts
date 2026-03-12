import { voice, llm } from '@livekit/agents';
import type { Room } from '@livekit/rtc-node';
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

    super({
      instructions,
      chatCtx: config.chatCtx,
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
          role: 'system',
          content: `[面试题库参考 - 仅供你参考，不要直接念出来]\n${ragContent}\n\n请根据候选人的回答水平，结合以上参考信息，自然地追问或过渡到下一个问题。`,
        });
      }
    } catch (error) {
      console.error('RAG lookup failed:', error);
    }
  }
}
