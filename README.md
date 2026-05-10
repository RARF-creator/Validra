# Validra – Startup Idea Similarity Checker

A production-ready Express.js backend for checking whether your startup idea already exists, built for a university project using **MongoDB Atlas** (Vector Search + Full-Text Search) and **local embeddings** (no OpenAI API key needed).

---

## ✨ Features

| Feature | Endpoint | Details |
|---|---|---|
| Submit Idea | `POST /api/ideas` | Generates embedding locally, stores in Atlas |
| Similarity Search | `POST /api/similarity` | $vectorSearch: top-3 matches + domain risk score |
| Autocomplete | `GET /api/autocomplete?q=` | Real-time title suggestions via Atlas Search |
| Trend Analysis | `GET /api/trends` | Ideas per domain, ranked, with 7-day activity |
| List Ideas | `GET /api/ideas` | Paginated listing (no embeddings) |

---

## 📁 Project Structure

```
validra/
├── src/
│   ├── server.js                  # Express entry point
│   ├── routes/api.js              # All API routes
│   ├── db/connection.js           # MongoDB Atlas connection
│   ├── constants/domains.js       # 10 supported domains
│   ├── services/embedder.js       # Local embedding (transformers.js)
│   └── controllers/
│       ├── ideasController.js     # CRUD for ideas
│       ├── similarityController.js # $vectorSearch + domain analysis
│       ├── autocompleteController.js # Atlas Search autocomplete
│       └── trendsController.js    # Aggregation pipeline
├── scripts/
│   ├── importData.js              # Bulk import JSON/CSV
│   └── seedSample.js              # Seed 30 sample ideas
├── data/
│   ├── sample_ideas.json          # 10 sample ideas (JSON)
│   └── sample_ideas.csv           # 10 sample ideas (CSV)
├── atlas_indexes/
│   ├── vector_index.json          # Vector Search index config
│   └── search_index.json          # Full-Text Search index config
├── .env.example                   # Environment variable template
└── package.json
```

---

## 🌐 The 10 Supported Domains

| Domain | Description |
|---|---|
| `HealthTech` | Medical, wellness, patient monitoring |
| `EdTech` | Education, learning platforms |
| `FinTech` | Finance, payments, investment |
| `AgriTech` | Agriculture, farming technology |
| `CleanTech` | Sustainability, clean energy |
| `LegalTech` | Legal services, contract management |
| `RetailTech` | E-commerce, in-store technology |
| `HRTech` | Human resources, recruitment |
| `PropTech` | Real estate, property management |
| `FoodTech` | Food production, delivery, nutrition |

---

## 🚀 Setup Guide

### Step 1 – Create your `.env` file

```bash
cp .env.example .env
```

Edit `.env` and fill in your MongoDB Atlas connection string:

```env
MONGODB_URI=mongodb+srv://youruser:yourpassword@cluster0.mongodb.net/
DB_NAME=validra
COLLECTION_NAME=startup_ideas
PORT=3000
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
VECTOR_DIM=384
```

### Step 2 – Install dependencies

```bash
npm install
```

### Step 3 – Create Atlas Indexes

You need **two indexes** in MongoDB Atlas. Go to:
**Atlas UI → Your Cluster → Search → Create Search Index**

#### A. Vector Search Index (for similarity & semantic search)

1. Click **"Create Search Index"** → Choose **"JSON Editor"**
2. Select your **database** (`validra`) and **collection** (`startup_ideas`)
3. Set the index name to: **`vector_index`**
4. Paste the contents of `atlas_indexes/vector_index.json`

```json
{
  "name": "vector_index",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {
        "type": "vector",
        "path": "vector_embedding",
        "numDimensions": 384,
        "similarity": "cosine"
      },
      { "type": "filter", "path": "domain" },
      { "type": "filter", "path": "source" }
    ]
  }
}
```

> ⚠️ **numDimensions must be 384** if using `Xenova/all-MiniLM-L6-v2`. Change to 768 if using `all-mpnet-base-v2` (also update `VECTOR_DIM` in `.env`).

#### B. Atlas Full-Text Search Index (for autocomplete)

1. Click **"Create Search Index"** → Choose **"JSON Editor"**
2. Same database and collection
3. Set the index name to: **`search_index`**
4. Paste the contents of `atlas_indexes/search_index.json`

> ⏳ Atlas indexes take 1–3 minutes to build. The `similarity` and `autocomplete` endpoints will return a `503` with instructions until the indexes are ready.

### Step 4 – Seed sample data

```bash
npm run seed
```

This inserts 30 pre-written startup ideas (3 per domain) with embeddings into your database — perfect for testing similarity search immediately.

### Step 5 – Run the server

```bash
npm run dev     # with auto-restart (nodemon)
# or
npm start       # production
```

---

## 🔌 API Reference

### `POST /api/ideas`
Submit a new startup idea. Generates a vector embedding and stores it.

**Request body:**
```json
{
  "title": "AI-powered crop disease detection",
  "description": "Uses computer vision drones to identify plant diseases before visible symptoms appear.",
  "domain": "AgriTech"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Idea saved successfully.",
  "id": "665c1a2b3f4e5d6a7b8c9d0e"
}
```

---

### `POST /api/similarity`
Find the 3 most similar ideas with domain-aware risk scoring.

**Request body:**
```json
{
  "title": "Drone crop monitoring system",
  "description": "Autonomous drones scan farms to detect diseases early using AI image analysis.",
  "domain": "AgriTech"
}
```

**Response:**
```json
{
  "success": true,
  "query": { "title": "...", "description": "...", "domain": "AgriTech" },
  "verdict": "POTENTIAL_DUPLICATE – One very similar idea found. Ensure your concept is differentiated.",
  "similar_ideas": [
    {
      "_id": "...",
      "title": "Drone-Based Crop Disease Detection",
      "domain": "AgriTech",
      "similarity_score": 0.9341,
      "domain_match": true,
      "risk_level": "HIGH_RISK"
    }
  ]
}
```

**Risk Levels:**

| Level | Condition |
|---|---|
| `HIGH_RISK` | Score ≥ 0.92 AND same domain |
| `MEDIUM_RISK` | Score ≥ 0.80 AND same domain |
| `CROSS_DOMAIN_SIMILAR` | Score ≥ 0.80 AND different domain |
| `LOW_RISK` | Score < 0.80 |

---

### `GET /api/autocomplete?q=crop&domain=AgriTech&limit=5`
Real-time title suggestions as the user types.

**Query params:**

| Param | Required | Default | Description |
|---|---|---|---|
| `q` | ✅ | — | Search prefix |
| `domain` | ❌ | — | Filter by domain |
| `limit` | ❌ | 8 | Max results (max 20) |

**Response:**
```json
{
  "success": true,
  "query": "crop",
  "suggestions": [
    {
      "_id": "...",
      "title": "Drone-Based Crop Disease Detection",
      "domain": "AgriTech",
      "score": 4.23,
      "highlights": [{ "path": "title", "texts": [...] }]
    }
  ]
}
```

---

### `GET /api/trends`
Domain trend analysis with ranking and 7-day activity.

**Response:**
```json
{
  "success": true,
  "grand_total": 30,
  "hottest_domain": "HealthTech",
  "opportunity_domain": "FoodTech",
  "domains": [
    {
      "rank": 1,
      "domain": "HealthTech",
      "total": 5,
      "user_submitted": 2,
      "external": 3,
      "percentage": 16.67,
      "recent_7d": 1
    }
  ]
}
```

---

## 📦 Bulk Import Script

### Import from JSON

```bash
node scripts/importData.js --file data/sample_ideas.json
```

### Import from CSV

```bash
node scripts/importData.js --file data/sample_ideas.csv
```

### Dry run (validate without inserting)

```bash
node scripts/importData.js --file data/sample_ideas.json --dry-run
```

### Larger datasets with more concurrency

```bash
node scripts/importData.js --file data/my_ideas.json --batch 10
```

**Expected JSON format:**
```json
[
  {
    "title": "My Startup Title",
    "description": "Detailed description of the startup idea.",
    "domain": "FinTech",
    "source": "external"
  }
]
```

**Expected CSV format** (first row = header):
```csv
title,description,domain,source
"My Startup","Detailed description","FinTech","external"
```

---

## 🧠 Embedding Model

Embeddings are generated **100% locally** using [@xenova/transformers](https://github.com/xenova/transformers.js) — no API key, no cost.

| Model | Dimensions | Size | Speed |
|---|---|---|---|
| `Xenova/all-MiniLM-L6-v2` *(default)* | 384 | ~23 MB | Fast |
| `Xenova/all-mpnet-base-v2` | 768 | ~90 MB | Slower, more accurate |

The model downloads automatically on first use and caches locally in `.cache/`.

To switch models, update `.env`:
```env
EMBEDDING_MODEL=Xenova/all-mpnet-base-v2
VECTOR_DIM=768
```

And update your `vector_index.json` `numDimensions` to `768` before creating the Atlas index.

---

## 📊 Database Schema

```javascript
{
  _id: ObjectId,              // Auto-generated
  title: String,              // Required – idea name
  description: String,        // Required – detailed description
  domain: String,             // Required – one of 10 allowed domains
  vector_embedding: [Number], // Auto-generated – 384-dim float array
  source: "user" | "external",// "user" = submitted via API, "external" = imported
  created_at: Date            // Auto-generated – insertion timestamp
}
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ES Modules) |
| Framework | Express.js |
| Database | MongoDB Atlas |
| Similarity | Atlas Vector Search ($vectorSearch) |
| Autocomplete | Atlas Full-Text Search ($search) |
| Embeddings | @xenova/transformers (local, free) |
| Security | Helmet.js |
| Logging | Morgan |
