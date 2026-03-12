import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createInterview, listInterviews } from '@/lib/db';

// GET /api/interviews — 获取面试列表
export async function GET() {
  try {
    const interviews = listInterviews();
    return NextResponse.json({ interviews });
  } catch (error) {
    console.error('Failed to list interviews:', error);
    return NextResponse.json({ error: 'Failed to list interviews' }, { status: 500 });
  }
}

// POST /api/interviews — 创建面试
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { position, difficulty, duration, resume } = body;

    if (!position) {
      return NextResponse.json({ error: '请选择面试岗位' }, { status: 400 });
    }

    const id = uuidv4().replace(/-/g, '').substring(0, 12);
    const interview = createInterview({
      id,
      position: position || 'frontend',
      difficulty: difficulty || 'mid',
      duration: duration || 30,
      resume: resume || undefined,
    });

    return NextResponse.json({ interview });
  } catch (error) {
    console.error('Failed to create interview:', error);
    return NextResponse.json({ error: 'Failed to create interview' }, { status: 500 });
  }
}
