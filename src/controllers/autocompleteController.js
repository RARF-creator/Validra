import { getCollection } from '../db/connection.js';
import { DOMAINS } from '../constants/domains.js';

// ─── GET /api/autocomplete?q=<query> ──────────────────────────────────────────
/**
 * Real-time title autocomplete using Atlas Search (autocomplete index).
 *
 * Atlas Search index name: "search_index"
 * The index must have an autocomplete mapping on the `title` field.
 * See atlas_indexes/search_index.json for the full configuration.
 *
 * Query params:
 *   q       - search prefix (required, min 1 char)
 *   limit   - max results to return (default 8, max 20)
 *   domain  - optional domain filter
 */
export async function autocomplete(req, res) {
  try {
    const { q, limit: rawLimit, domain } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required.',
      });
    }

    const limit = Math.min(parseInt(rawLimit) || 8, 20);
    const searchText = q.trim();

    // Build the Atlas Search pipeline
    const mustClauses = [
      {
        // autocomplete operator – matches partial words as the user types
        autocomplete: {
          query: searchText,
          path: 'title',
          fuzzy: {
            maxEdits: 1,      // tolerate 1 typo
            prefixLength: 2,  // first 2 chars must match exactly (performance)
          },
          tokenOrder: 'sequential',
        },
      },
    ];

    // Optional domain filter (added as an Atlas Search filter clause)
    const filterClauses = [];
    if (domain) {
      filterClauses.push({
        text: { query: domain, path: 'domain' },
      });
    }

    const searchStage = {
      $search: {
        index: 'search_index',
        compound: {
          must: mustClauses,
          ...(filterClauses.length > 0 && { filter: filterClauses }),
        },
        highlight: {
          path: 'title',  // Return highlighted snippets for the matched chars
        },
      },
    };

    const pipeline = [
      searchStage,
      { $limit: limit },
      {
        $project: {
          _id: 1,
          title: 1,
          domain: 1,
          source: 1,
          // Include Atlas Search score for ranking transparency
          score: { $meta: 'searchScore' },
          // Include title highlights (bold matched chars for the UI)
          highlights: { $meta: 'searchHighlights' },
        },
      },
    ];

    const collection = getCollection();
    const suggestions = await collection.aggregate(pipeline).toArray();

    return res.json({
      success: true,
      query: searchText,
      suggestions,
    });
  } catch (err) {
    if (err.message?.includes('search_index') || err.message?.includes('$search')) {
      return res.status(503).json({
        success: false,
        error:
          'Atlas Search index not ready. Create the "search_index" in MongoDB Atlas. ' +
          'See atlas_indexes/search_index.json for configuration.',
      });
    }
    console.error('autocomplete error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}
