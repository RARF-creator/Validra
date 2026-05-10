import axios from 'axios';
import cron from 'node-cron';
import { getCollection } from '../db/connection.js';
import { generateEmbedding, buildEmbeddingText } from './embedder.js';

export function startScraperCron() {
  // Run every 12 hours
  cron.schedule('0 */12 * * *', async () => {
    console.log('🔄 Running scheduled startup idea scraper from free sources...');
    try {
      // Using HackerNews Ask/Show HN stories as a free API source for ideas
      const response = await axios.get('https://hacker-news.firebaseio.com/v0/askstories.json');
      const storyIds = response.data.slice(0, 10);
      const collection = getCollection();

      for (const id of storyIds) {
        const itemRes = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        const item = itemRes.data;
        if (item && item.title && (item.title.startsWith('Show HN:') || item.title.includes('Startup'))) {
          const title = item.title.replace('Show HN:', '').trim();
          const description = item.text ? item.text.replace(/<[^>]*>?/gm, '').substring(0, 500) : 'No description provided.';
          
          // Check if idea already exists
          const existing = await collection.findOne({ title });
          if (!existing) {
             const vector_embedding = await generateEmbedding(buildEmbeddingText(title, description));
             await collection.insertOne({
               title,
               description,
               domain: 'Technology', // Default domain for scraped data
               vector_embedding,
               source: 'external',
               external_id: id.toString(),
               created_at: new Date(),
               is_private: false
             });
             console.log(`✅ Scraped and automatically added new idea: "${title}"`);
          }
        }
      }
    } catch (err) {
      console.error('Scraper error:', err.message);
    }
  });
}
