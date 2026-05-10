/**
 * Validra Auth Routes
 * POST /auth/register  – Create new account
 * POST /auth/login     – Login, receive JWT
 * GET  /auth/me        – Validate token, return user info
 */
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connectDB } from '../db/connection.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'validra-dev-secret-change-in-prod';
const JWT_EXPIRES = '7d';

function usersCollection() {
  // We reuse the same DB connection
  return connectDB().then(db => db.collection('users'));
}

// ── Middleware: verify token ───────────────────────────────────────────────────
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, error: 'Authentication required.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
  }
}

// ── POST /auth/register ────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: 'name, email and password are required.' });
    if (password.length < 6)
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });

    const col = await usersCollection();
    const existing = await col.findOne({ email: email.toLowerCase().trim() });
    if (existing)
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });

    const hash = await bcrypt.hash(password, 12);
    const user = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hash,
      created_at: new Date(),
      role: 'user',
    };

    const result = await col.insertOne(user);
    const token = jwt.sign({ id: result.insertedId.toString(), email: user.email, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    return res.status(201).json({ success: true, token, user: { id: result.insertedId, name: user.name, email: user.email } });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// ── POST /auth/login ───────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, error: 'email and password are required.' });

    const col = await usersCollection();
    const user = await col.findOne({ email: email.toLowerCase().trim() });
    if (!user)
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    const token = jwt.sign({ id: user._id.toString(), email: user.email, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    return res.json({ success: true, token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// ── GET /auth/me ───────────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ success: true, user: req.user });
});

export default router;
