import { ChromaClient, Collection } from 'chromadb';
import { getEmbedding } from './embeddings.js';
import { CHROMA_URL, CHROMA_COLLECTION_NAME, CHROMA_COLLECTION_METADATA } from '../utils/config.js';

let client: ChromaClient | null = null;
let collection: Collection | null = null;

async function getCollection(): Promise<Collection> {
  if (collection) return collection;

  client = new ChromaClient({ path: CHROMA_URL });
  collection = await client.getOrCreateCollection({
    name: CHROMA_COLLECTION_NAME,
    metadata: CHROMA_COLLECTION_METADATA,
  });
  return collection;
}

export interface RAGResult {
  question: string;
  keyPoints: string[];
  followUps: string[];
  difficulty: string;
  category: string;
  position: string;
  score: number;
}

export async function searchQuestions(
  query: string,
  position?: string,
  topK: number = 3
): Promise<RAGResult[]> {
  const col = await getCollection();
  const queryEmbedding = await getEmbedding(query);

  const whereFilter = position ? { position: { $eq: position } } : undefined;

  const results = await col.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
    where: whereFilter as any,
  });

  if (!results.documents[0]) return [];

  return results.documents[0].map((doc, i) => {
    const metadata = results.metadatas[0][i] as Record<string, any>;
    return {
      question: metadata.question || '',
      keyPoints: JSON.parse(metadata.key_points || '[]'),
      followUps: JSON.parse(metadata.follow_ups || '[]'),
      difficulty: metadata.difficulty || '',
      category: metadata.category || '',
      position: metadata.position || '',
      score: results.distances?.[0]?.[i] ?? 0,
    };
  });
}

export function formatRAGResults(results: RAGResult[]): string {
  if (results.length === 0) return '';

  return results
    .map((r, i) => {
      return `【参考题目${i + 1}】
题目: ${r.question}
考察要点: ${r.keyPoints.join('、')}
难度: ${r.difficulty}
可追问方向: ${r.followUps.join('；')}`;
    })
    .join('\n\n');
}
