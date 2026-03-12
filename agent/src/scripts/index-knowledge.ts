import { ChromaClient } from 'chromadb';
import { getEmbeddings } from '../rag/embeddings.js';
import { CHROMA_URL, CHROMA_COLLECTION_NAME, CHROMA_COLLECTION_METADATA } from '../utils/config.js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// dotenv 不覆盖已有变量，先加载优先级高的
dotenv.config({ path: resolve(__dirname, '../../../.env.local') }); // 本地覆盖（可选）
dotenv.config({ path: resolve(__dirname, '../../../.env') });       // 兜底配置

interface Question {
  id: string;
  question: string;
  key_points: string[];
  difficulty: string;
  follow_ups: string[];
  scoring_criteria: string;
}

interface Category {
  id: string;
  name: string;
  questions: Question[];
}

interface KnowledgeBase {
  position: string;
  name: string;
  categories: Category[];
}

async function indexKnowledge() {
  console.log('Starting knowledge base indexing...');

  const client = new ChromaClient({ path: CHROMA_URL });

  // Delete existing collection and recreate
  try {
    await client.deleteCollection({ name: CHROMA_COLLECTION_NAME });
  } catch {
    // Collection may not exist
  }

  const collection = await client.createCollection({
    name: CHROMA_COLLECTION_NAME,
    metadata: CHROMA_COLLECTION_METADATA,
  });

  const files = ['frontend.json', 'backend.json', 'fullstack.json', 'common.json'];
  const allIds: string[] = [];
  const allDocuments: string[] = [];
  const allMetadatas: Record<string, any>[] = [];

  for (const file of files) {
    const filePath = resolve(__dirname, '../knowledge', file);
    let data: KnowledgeBase;
    try {
      const content = readFileSync(filePath, 'utf-8');
      data = JSON.parse(content);
    } catch {
      // Try relative to dist
      const altPath = resolve(process.cwd(), 'src/knowledge', file);
      const content = readFileSync(altPath, 'utf-8');
      data = JSON.parse(content);
    }

    console.log(`Processing ${data.name} (${data.position})...`);

    for (const category of data.categories) {
      for (const q of category.questions) {
        const docText = `${q.question} ${q.key_points.join(' ')} ${q.scoring_criteria}`;
        allIds.push(q.id);
        allDocuments.push(docText);
        allMetadatas.push({
          question: q.question,
          key_points: JSON.stringify(q.key_points),
          follow_ups: JSON.stringify(q.follow_ups),
          difficulty: q.difficulty,
          scoring_criteria: q.scoring_criteria,
          category: category.name,
          position: data.position,
        });
      }
    }
  }

  console.log(`Generating embeddings for ${allDocuments.length} questions...`);
  const embeddings = await getEmbeddings(allDocuments);

  console.log('Inserting into ChromaDB...');
  await collection.add({
    ids: allIds,
    documents: allDocuments,
    embeddings: embeddings,
    metadatas: allMetadatas,
  });

  console.log(`Successfully indexed ${allIds.length} questions!`);
}

indexKnowledge().catch(console.error);
