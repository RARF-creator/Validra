import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

let client = null;
let db = null;

/**
 * Connect to MongoDB Atlas. Re-uses existing connection if already established.
 */
export async function connectDB() {
  if (db) return db;

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in .env file');
  }

  client = new MongoClient(process.env.MONGODB_URI, {
    // Modern driver – no extra options needed for Atlas
  });

  await client.connect();
  db = client.db(process.env.DB_NAME || 'validra');
  console.log(`✅ Connected to MongoDB Atlas – DB: "${db.databaseName}"`);
  return db;
}

/**
 * Returns the main ideas collection.
 */
export function getCollection() {
  if (!db) throw new Error('Database not initialised. Call connectDB() first.');
  return db.collection(process.env.COLLECTION_NAME || 'startup_ideas');
}

/**
 * Gracefully close the connection.
 */
export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('🔌 MongoDB connection closed.');
  }
}
