import { NextRequest, NextResponse } from 'next/server';
import { getInterview, deleteInterview, updateInterviewReport } from '@/lib/db';

// GET /api/interviews/:id — 获取面试详情
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const interview = getInterview(id);
    if (!interview) {
      return NextResponse.json({ error: '面试不存在' }, { status: 404 });
    }
    return NextResponse.json({ interview });
  } catch (error) {
    console.error('Failed to get interview:', error);
    return NextResponse.json({ error: 'Failed to get interview' }, { status: 500 });
  }
}

// PATCH /api/interviews/:id — 更新面试报告
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const interview = getInterview(id);
    if (!interview) {
      return NextResponse.json({ error: '面试不存在' }, { status: 404 });
    }

    if (body.report) {
      updateInterviewReport(id, typeof body.report === 'string' ? body.report : JSON.stringify(body.report));
    }

    const updated = getInterview(id);
    return NextResponse.json({ interview: updated });
  } catch (error) {
    console.error('Failed to update interview:', error);
    return NextResponse.json({ error: 'Failed to update interview' }, { status: 500 });
  }
}

// DELETE /api/interviews/:id — 删除面试
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    deleteInterview(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete interview:', error);
    return NextResponse.json({ error: 'Failed to delete interview' }, { status: 500 });
  }
}
