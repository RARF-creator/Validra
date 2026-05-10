import express from 'express';
import { createIdea, listIdeas } from '../controllers/ideasController.js';
import { findSimilar } from '../controllers/similarityController.js';
import { autocomplete } from '../controllers/autocompleteController.js';
import { getTrends } from '../controllers/trendsController.js';

const router = express.Router();

// ── Ideas ─────────────────────────────────────────────────────────────────────
// POST   /api/ideas       – Submit a new startup idea (generates embedding)
// GET    /api/ideas       – List all ideas (paginated)
router.post('/ideas', createIdea);
router.get('/ideas', listIdeas);

import { requireAuth } from './auth.js';
import { createPrivateIdea, listPrivateIdeas } from '../controllers/ideasController.js';

// ── Private Ideas ─────────────────────────────────────────────────────────────
router.post('/private-ideas', requireAuth, createPrivateIdea);
router.get('/private-ideas', requireAuth, listPrivateIdeas);

// ── Similarity ────────────────────────────────────────────────────────────────
// POST   /api/similarity  – Find top-3 similar ideas + domain risk analysis
router.post('/similarity', findSimilar);

// ── Autocomplete ──────────────────────────────────────────────────────────────
// GET    /api/autocomplete?q=abc&domain=FinTech&limit=8
router.get('/autocomplete', autocomplete);

// ── Trends ────────────────────────────────────────────────────────────────────
// GET    /api/trends      – Domain idea counts, ranking, + 7-day activity
router.get('/trends', getTrends);

// ── Classification ────────────────────────────────────────────────────────────
// POST   /api/classify    – Semantic domain classification based on text
import { classifyIdea } from '../controllers/classificationController.js';
router.post('/classify', classifyIdea);

export default router;
