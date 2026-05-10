import { getCollection } from '../db/connection.js';
import { generateEmbedding, buildEmbeddingText } from '../services/embedder.js';
import { validateDomain, DOMAINS } from '../constants/domains.js';

// ─── POST /api/ideas ───────────────────────────────────────────────────────────
/**
 * Submit a new startup idea.
 * Generates a vector embedding and stores the document in Atlas.
 */
export async function createIdea(req, res) {
  try {
    const { title, description, domain } = req.body;

    // Validate required fields
    if (!title || !description || !domain) {
      return res.status(400).json({
        success: false,
        error: 'title, description, and domain are required.',
      });
    }

    const canonicalDomain = validateDomain(domain);
    if (!canonicalDomain) {
      return res.status(400).json({
        success: false,
        error: `Invalid domain. Must be one of: ${DOMAINS.join(', ')}`,
      });
    }

    // Generate embedding from title + description
    const vector_embedding = await generateEmbedding(
      buildEmbeddingText(title, description)
    );

    const doc = {
      title: title.trim(),
      description: description.trim(),
      domain: canonicalDomain,
      vector_embedding,
      source: 'user',
      created_at: new Date(),
    };

    const collection = getCollection();
    const result = await collection.insertOne(doc);

    return res.status(201).json({
      success: true,
      message: 'Idea saved successfully.',
      id: result.insertedId,
    });
  } catch (err) {
    console.error('createIdea error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── GET /api/ideas ────────────────────────────────────────────────────────────
/**
 * List all ideas (paginated, no embeddings returned to save bandwidth).
 */
export async function listIdeas(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const collection = getCollection();
    const [ideas, total] = await Promise.all([
      collection
        .find({}, { projection: { vector_embedding: 0 } })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(),
    ]);

    return res.json({ success: true, total, page, limit, ideas });
  } catch (err) {
    console.error('listIdeas error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── POST /api/private-ideas ──────────────────────────────────────────────────
/**
 * Submit a private startup idea for an authenticated user.
 */
export async function createPrivateIdea(req, res) {
  try {
    const { title, description, domain } = req.body;
    const userId = req.user.id;

    if (!title || !description || !domain) {
      return res.status(400).json({ success: false, error: 'title, description, and domain are required.' });
    }

    const canonicalDomain = validateDomain(domain);
    if (!canonicalDomain) {
      return res.status(400).json({ success: false, error: `Invalid domain. Must be one of: ${DOMAINS.join(', ')}` });
    }

    const vector_embedding = await generateEmbedding(buildEmbeddingText(title, description));

    const doc = {
      title: title.trim(),
      description: description.trim(),
      domain: canonicalDomain,
      vector_embedding,
      source: 'user',
      created_at: new Date(),
      is_private: true,
      user_id: userId
    };

    const collection = getCollection();
    const result = await collection.insertOne(doc);

    return res.status(201).json({ success: true, message: 'Private idea saved securely.', id: result.insertedId });
  } catch (err) {
    console.error('createPrivateIdea error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}

// ─── GET /api/private-ideas ───────────────────────────────────────────────────
/**
 * List all private ideas for the authenticated user.
 */
export async function listPrivateIdeas(req, res) {
  try {
    const userId = req.user.id;
    const collection = getCollection();
    
    const ideas = await collection
      .find({ user_id: userId, is_private: true }, { projection: { vector_embedding: 0 } })
      .sort({ created_at: -1 })
      .toArray();

    return res.json({ success: true, ideas });
  } catch (err) {
    console.error('listPrivateIdeas error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}
