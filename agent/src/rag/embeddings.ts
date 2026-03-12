import OpenAI from 'openai';
import { getSiliconFlowConfig } from '../utils/config.js';

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const config = getSiliconFlowConfig();
    _client = new OpenAI({
      apiKey: config.apiKey || 'dummy',
      baseURL: config.baseURL,
    });
  }
  return _client;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await getClient().embeddings.create({
    model: process.env.EMBEDDING_MODEL || 'BAAI/bge-large-zh-v1.5',
    input: text,
  });
  return response.data[0].embedding;
}

export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const batchSize = 20;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const response = await getClient().embeddings.create({
      model: process.env.EMBEDDING_MODEL || 'BAAI/bge-large-zh-v1.5',
      input: batch,
    });
    allEmbeddings.push(...response.data.map((d) => d.embedding));
  }

  return allEmbeddings;
}
