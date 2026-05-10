import { getCollection } from '../db/connection.js';
import { DOMAINS } from '../constants/domains.js';

// ─── GET /api/trends ──────────────────────────────────────────────────────────
/**
 * Trend analysis: counts total ideas per domain and ranks them.
 *
 * Returns:
 *   - Ranked list of all 10 domains (most → least crowded)
 *   - The "hottest" domain (most ideas)
 *   - The "opportunity" domain (fewest ideas)
 *   - Total ideas in the database
 *   - Source breakdown per domain (user-submitted vs external)
 */
export async function getTrends(req, res) {
  try {
    const collection = getCollection();

    // ── Main aggregation pipeline ────────────────────────────────────────────
    const pipeline = [
      // Stage 1: Group by domain → count total, count by source
      {
        $group: {
          _id: '$domain',
          total: { $sum: 1 },
          user_submitted: {
            $sum: { $cond: [{ $eq: ['$source', 'user'] }, 1, 0] },
          },
          external: {
            $sum: { $cond: [{ $eq: ['$source', 'external'] }, 1, 0] },
          },
        },
      },

      // Stage 2: Sort by total descending (most crowded first)
      {
        $sort: { total: -1 },
      },

      // Stage 3: Reshape output
      {
        $project: {
          _id: 0,
          domain: '$_id',
          total: 1,
          user_submitted: 1,
          external: 1,
          // Percentage of all ideas (requires second pass, handled in JS below)
        },
      },
    ];

    const domainCounts = await collection.aggregate(pipeline).toArray();

    // ── Ensure all 10 domains appear (even if count = 0) ─────────────────────
    const countsMap = new Map(domainCounts.map((d) => [d.domain, d]));
    const allDomains = DOMAINS.map((domain) => {
      return (
        countsMap.get(domain) ?? {
          domain,
          total: 0,
          user_submitted: 0,
          external: 0,
        }
      );
    });

    // Re-sort to keep ranking correct after filling in zeros
    allDomains.sort((a, b) => b.total - a.total);

    // ── Compute grand totals and percentages ─────────────────────────────────
    const grandTotal = allDomains.reduce((sum, d) => sum + d.total, 0);
    const rankedDomains = allDomains.map((d, idx) => ({
      rank: idx + 1,
      ...d,
      percentage:
        grandTotal > 0
          ? parseFloat(((d.total / grandTotal) * 100).toFixed(2))
          : 0,
    }));

    // ── Insights ─────────────────────────────────────────────────────────────
    const hottest = rankedDomains[0];
    const opportunity = rankedDomains[rankedDomains.length - 1];

    // Recent activity: ideas added in last 7 days per domain
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const recentPipeline = [
      { $match: { created_at: { $gte: sevenDaysAgo } } },
      { $group: { _id: '$domain', recent_total: { $sum: 1 } } },
    ];
    const recentCounts = await collection.aggregate(recentPipeline).toArray();
    const recentMap = new Map(recentCounts.map((r) => [r._id, r.recent_total]));

    const finalDomains = rankedDomains.map((d) => ({
      ...d,
      recent_7d: recentMap.get(d.domain) ?? 0,
    }));

    return res.json({
      success: true,
      grand_total: grandTotal,
      hottest_domain: hottest?.domain ?? null,
      opportunity_domain: opportunity?.domain ?? null,
      domains: finalDomains,
    });
  } catch (err) {
    console.error('getTrends error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}
