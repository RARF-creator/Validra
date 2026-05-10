import { pipeline } from '@xenova/transformers';
import dotenv from 'dotenv';
dotenv.config();

const MODEL_NAME = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
let embedder = null;

/**
 * Lazily initialise the embedding pipeline.
 * Downloads the model on first call (~23 MB for MiniLM), then caches it locally.
 */
async function getEmbedder() {
  if (!embedder) {
    console.log(`⏳ Loading embedding model: ${MODEL_NAME} …`);
    embedder = await pipeline('feature-extraction', MODEL_NAME, {
      quantized: true, // use quantized ONNX model for smaller size & speed
    });
    console.log(`✅ Embedding model ready.`);
  }
  return embedder;
}

/**
 * Convert a plain-text string into a fixed-length vector embedding.
 *
 * @param {string} text - The text to embed (title + description recommended).
 * @returns {Promise<number[]>} - 384-dimensional float array (MiniLM) or 768-dim (mpnet).
 */
export async function generateEmbedding(text) {
  const model = await getEmbedder();

  // Run inference; output shape is [1, tokens, dim]
  const output = await model(text, {
    pooling: 'mean',      // mean-pool token embeddings → sentence embedding
    normalize: true,      // L2 normalise for cosine similarity via dot product
  });

  // Convert typed array → plain JS array for MongoDB storage
  return Array.from(output.data);
}

/**
 * Helper: combine title + description into a single embedding string.
 * Using both fields gives richer semantic meaning than title alone.
 */
export function buildEmbeddingText(title, description) {
  return `${title}. ${description}`.trim();
}
