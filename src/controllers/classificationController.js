import { generateEmbedding, buildEmbeddingText } from '../services/embedder.js';
import { DOMAINS } from '../constants/domains.js';

// Cache for domain embeddings to avoid re-generating on every request
let domainEmbeddings = null;

/**
 * Pre-calculates embeddings for all 10 domains.
 * We add descriptive keywords to each domain to improve semantic matching.
 */
const DOMAIN_DESCRIPTIONS = {
  'Agentic AI': 'Agentic AI autonomous agents generative intelligence large language models LLMs orchestration',
  'Climate Tech': 'Climate Tech sustainability carbon credits renewable energy green hydrogen decarbonization environment',
  'Fintech': 'Fintech banking payments insurance credit crypto blockchain finance wealth management lending',
  'HealthTech': 'HealthTech telemedicine medical devices clinical digital health biotechnology patient care',
  'Cybersecurity': 'Cybersecurity network security threat detection encryption zero trust firewalls identity management',
  'EdTech': 'EdTech education learning management systems online courses student training pedagogy classrooms',
  'Logistics': 'Logistics supply chain delivery tracking fulfillment shipping warehousing transportation',
  'SpaceTech': 'SpaceTech aerospace satellites rockets orbital exploration deep space communications',
  'AgriTech': 'AgriTech farming soil health regenerative agriculture livestock crop monitoring drones agritech',
  'Retail/E-commerce': 'Retail E-commerce online shopping marketplace direct-to-consumer DTC supply chain point of sale POS'
};

async function getDomainEmbeddings() {
  if (domainEmbeddings) return domainEmbeddings;

  console.log('--- Initializing Domain Classifier Embeddings ---');
  domainEmbeddings = await Promise.all(
    DOMAINS.map(async (domain) => {
      const text = DOMAIN_DESCRIPTIONS[domain] || domain;
      const vector = await generateEmbedding(text);
      return { domain, vector };
    })
  );
  return domainEmbeddings;
}

/**
 * Simple cosine similarity calculation.
 */
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
}

/**
 * POST /api/classify
 * Analyzes title/description and returns the most likely domain matches.
 */
export async function classifyIdea(req, res) {
  try {
    const { title, description } = req.body;
    if (!description && !title) {
      return res.status(400).json({ success: false, error: 'Text required for classification.' });
    }

    const inputEmbedding = await generateEmbedding(buildEmbeddingText(title || '', description || ''));
    const domains = await getDomainEmbeddings();

    const suggestions = domains
      .map((d) => ({
        domain: d.domain,
        score: cosineSimilarity(inputEmbedding, d.vector)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Top 3

    return res.json({
      success: true,
      suggestions
    });
  } catch (err) {
    console.error('Classification error:', err);
    return res.status(500).json({ success: false, error: 'Failed to classify idea.' });
  }
}
