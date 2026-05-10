import { getCollection } from '../db/connection.js';
import { generateEmbedding, buildEmbeddingText } from '../services/embedder.js';
import { validateDomain, DOMAINS } from '../constants/domains.js';

// ─── POST /api/similarity ──────────────────────────────────────────────────────
/**
 * Find the 3 most similar startup ideas using Atlas $vectorSearch.
 *
 * Request body:
 *   { title: string, description: string, domain: string }
 *
 * Response includes:
 *   - Top 3 similar ideas with cosine similarity scores
 *   - Domain match analysis for each result
 *   - Recommendation on duplication risk
 */
export async function findSimilar(req, res) {
  try {
    const { title, description, domain } = req.body;

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

    // 1. Generate embedding for the incoming idea
    const queryVector = await generateEmbedding(
      buildEmbeddingText(title, description)
    );

    const collection = getCollection();

    // 2. Run Atlas $vectorSearch
    //    Index name: "vector_index" (must be created in Atlas UI / API)
    //    numCandidates: candidate pool size (10× numResults is recommended)
    const pipeline = [
      {
        $vectorSearch: {
          index: 'vector_index',
          path: 'vector_embedding',
          queryVector,
          numCandidates: 30,  // examine top-30, return top-3
          limit: 3,
        },
      },
      {
        // Append an Atlas-computed similarity score field
        $addFields: {
          similarity_score: { $meta: 'vectorSearchScore' },
        },
      },
      {
        // Strip the raw embedding from the response (too large)
        $project: {
          vector_embedding: 0,
        },
      },
    ];

    const results = await collection.aggregate(pipeline).toArray();

    // 3. Domain comparison logic
    const enrichedResults = results.map((idea) => {
      const domainMatch = idea.domain === canonicalDomain;
      let riskLevel;

      // Score thresholds for cosine similarity (0–1 range, higher = more similar)
      if (idea.similarity_score >= 0.92 && domainMatch) {
        riskLevel = 'HIGH_RISK';   // Almost identical in same domain
      } else if (idea.similarity_score >= 0.80 && domainMatch) {
        riskLevel = 'MEDIUM_RISK'; // Similar concept in same domain
      } else if (idea.similarity_score >= 0.80 && !domainMatch) {
        riskLevel = 'CROSS_DOMAIN_SIMILAR'; // Same concept, different market
      } else {
        riskLevel = 'LOW_RISK';    // Conceptually different
      }

      return {
        ...idea,
        domain_match: domainMatch,
        risk_level: riskLevel,
      };
    });

    // 4. Overall duplication verdict
    const highRiskCount = enrichedResults.filter(
      (r) => r.risk_level === 'HIGH_RISK'
    ).length;

    let verdict;
    if (highRiskCount >= 2) {
      verdict = 'LIKELY_DUPLICATE – Multiple highly similar ideas exist in this domain.';
    } else if (highRiskCount === 1) {
      verdict = 'POTENTIAL_DUPLICATE – One very similar idea found. Ensure your concept is differentiated.';
    } else {
      verdict = 'NOVEL_ENOUGH – No critical duplicates detected. Proceed with caution.';
    }

    return res.json({
      success: true,
      query: { title, description, domain: canonicalDomain },
      verdict,
      similar_ideas: enrichedResults,
    });
  } catch (err) {
    // Catch common Atlas errors and give actionable messages
    if (err.message?.includes('PlanExecutor error') || err.message?.includes('vector_index')) {
      return res.status(503).json({
        success: false,
        error:
          'Vector search index not found. Please create the "vector_index" in MongoDB Atlas first. ' +
          'See atlas_indexes/vector_index.json for the configuration.',
      });
    }
    console.error('findSimilar error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}
