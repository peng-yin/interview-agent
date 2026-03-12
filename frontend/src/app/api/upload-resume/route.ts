import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

// 最大文件大小：10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: '请上传简历文件' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '文件大小不能超过 10MB' },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';

    if (fileName.endsWith('.pdf')) {
      const data = await pdf(buffer);
      text = data.text;
    } else if (fileName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (fileName.endsWith('.doc')) {
      // mammoth 只支持 docx，doc 格式需要提示用户转换
      return NextResponse.json(
        { error: '暂不支持 .doc 格式，请将文件转换为 .docx 或 .pdf 后重新上传' },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: '不支持的文件格式，请上传 PDF 或 DOCX 文件' },
        { status: 400 }
      );
    }

    // 清理提取的文本
    text = text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!text || text.length < 10) {
      return NextResponse.json(
        { error: '无法从文件中提取有效文本，请确保文件内容正确' },
        { status: 400 }
      );
    }

    // 限制文本长度，避免传输过大
    const maxLength = 8000;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '\n\n[简历内容已截取前部分]';
    }

    return NextResponse.json({
      text,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error) {
    console.error('Resume upload error:', error);
    return NextResponse.json(
      { error: '文件解析失败，请检查文件是否损坏' },
      { status: 500 }
    );
  }
}
