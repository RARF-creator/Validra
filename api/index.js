import { connectDB } from '../src/db/connection.js';
import app from '../src/server.js';

export default async function handler(req, res) {
  // Ensure DB is connected before handling the request
  await connectDB();
  return app(req, res);
}
