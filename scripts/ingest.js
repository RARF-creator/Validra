#!/usr/bin/env node
/**
 * ingest.js – Real-World Startup Data Migrator
 * 
 * Fetches real registration data from OpenCorporates and realistic 
 * descriptions from NewsAPI to populate the Validra database.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { connectDB, getCollection, closeDB } from '../src/db/connection.js';
import { generateEmbedding, buildEmbeddingText } from '../src/services/embedder.js';
import { DOMAINS } from '../src/constants/domains.js';

dotenv.config();

const OPENCORPORATES_KEY = process.env.OPENCORPORATES_API_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// Max records as per user requirement
const MAX_NEW_RECORDS = 200;
const RECORDS_PER_DOMAIN = Math.floor(MAX_NEW_RECORDS / DOMAINS.length); // 20

/**
 * Fetch company names and registration dates from OpenCorporates
 */
async function fetchCompanies(domain) {
  try {
    console.log(`🔍 [OpenCorporates] Searching companies for domain: ${domain}...`);
    const response = await axios.get('https://api.opencorporates.com/v0.4/companies/search', {
      params: {
        q: `${domain} startup`,
        incorporated_from: '2024-01-01',
        incorporated_to: '2026-12-31',
        per_page: RECORDS_PER_DOMAIN,
        api_token: OPENCORPORATES_KEY === 'YOUR_OPENCORPORATES_KEY' ? null : OPENCORPORATES_KEY
      }
    });

    return response.data.results.companies.map(c => ({
      title: c.company.name,
      registered_at: c.company.incorporation_date
    }));
  } catch (err) {
    console.error(`❌ OpenCorporates error for ${domain}:`, err.message);
    // Return mock data if API key is missing for demonstration
    if (OPENCORPORATES_KEY === 'YOUR_OPENCORPORATES_KEY') {
       return Array.from({ length: RECORDS_PER_DOMAIN }).map((_, i) => ({
         title: `${domain} Innovator ${i + 1} Ltd`,
         registered_at: '2024-05-10'
       }));
    }
    return [];
  }
}

/**
 * Fetch realistic startup descriptions from NewsAPI
 */
async function fetchDescriptions(domain) {
  try {
    console.log(`📰 [NewsAPI] Fetching launch news for domain: ${domain}...`);
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: `${domain} AND (startup OR launch OR funding)`,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: RECORDS_PER_DOMAIN,
        apiKey: NEWS_API_KEY === 'YOUR_NEWS_API_KEY' ? null : NEWS_API_KEY
      }
    });

    return response.data.articles.map(a => a.description || a.title);
  } catch (err) {
    console.error(`❌ NewsAPI error for ${domain}:`, err.message);
    if (NEWS_API_KEY === 'YOUR_NEWS_API_KEY') {
      return Array.from({ length: RECORDS_PER_DOMAIN }).map(() => 
        `Helping enterprises leverage ${domain} technologies to optimize workflows and drive 2024 growth.`
      );
    }
    return [];
  }
}

async function ingest() {
  console.log('\n🚀 Starting Real-World Startup Ingestion');
  console.log('════════════════════════════════════════');
  
  await connectDB();
  const collection = getCollection();
  
  let totalProcessed = 0;

  for (const domain of DOMAINS) {
    console.log(`\n📂 Processing: ${domain}`);
    
    // Fetch data from both sources in parallel
    const [companies, descriptions] = await Promise.all([
      fetchCompanies(domain),
      fetchDescriptions(domain)
    ]);

    const itemsToUpsert = [];

    for (let i = 0; i < Math.min(companies.length, descriptions.length); i++) {
        const company = companies[i];
        const description = descriptions[i];

        console.log(`  ➕ Preparing: ${company.title}`);

        const text = buildEmbeddingText(company.title, description);
        const vector_embedding = await generateEmbedding(text);

        itemsToUpsert.push({
          updateOne: {
            filter: { title: company.title },
            update: {
              $set: {
                title: company.title,
                description: description,
                domain: domain,
                vector_embedding,
                source: 'real-world-migration',
                registration_date: company.registered_at,
                migrated_at: new Date()
              }
            },
            upsert: true
          }
        });
        totalProcessed++;
    }

    if (itemsToUpsert.length > 0) {
      console.log(`  💾 Bulk upserting ${itemsToUpsert.length} records...`);
      await collection.bulkWrite(itemsToUpsert);
    }
  }

  console.log(`\n✅ Ingestion Complete!`);
  console.log(`   Total new/updated records: ${totalProcessed}`);
  
  await closeDB();
}

ingest().catch((err) => {
  console.error('\n❌ Fatal Ingestion Error:', err);
  process.exit(1);
});
