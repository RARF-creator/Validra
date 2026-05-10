#!/usr/bin/env node
/**
 * Validra – Sample Data Seeder
 *
 * Inserts 30 pre-defined startup ideas (3 per domain) into the database.
 * Useful for testing similarity search without requiring a real dataset.
 *
 * Usage:
 *   node scripts/seedSample.js
 */

import dotenv from 'dotenv';
import { connectDB, getCollection, closeDB } from '../src/db/connection.js';
import { generateEmbedding, buildEmbeddingText } from '../src/services/embedder.js';

dotenv.config();

const SAMPLE_IDEAS = [
  // HealthTech
  {
    title: 'AI-Powered Remote Patient Monitoring',
    description: 'Wearable IoT sensors that continuously track vitals and alert doctors when anomalies are detected using machine learning models.',
    domain: 'HealthTech',
  },
  {
    title: 'Mental Health Chatbot for Teens',
    description: 'A conversational AI companion designed specifically for adolescents dealing with anxiety and depression, using CBT-based dialogues.',
    domain: 'HealthTech',
  },
  {
    title: 'Predictive Cancer Screening Platform',
    description: 'Uses patient history and genomic data to predict cancer risk scores and recommend preventive screenings using deep learning.',
    domain: 'HealthTech',
  },

  // EdTech
  {
    title: 'Adaptive Learning Engine for K-12',
    description: 'A personalized learning platform that adjusts difficulty and content in real-time based on student performance and engagement patterns.',
    domain: 'EdTech',
  },
  {
    title: 'VR-Based Science Lab Simulator',
    description: 'Virtual reality lab environment allowing students to conduct chemistry and physics experiments without physical equipment or safety risks.',
    domain: 'EdTech',
  },
  {
    title: 'Peer-to-Peer Skill Exchange App',
    description: 'A marketplace where students can trade skills — one student teaches guitar, another teaches coding — with time credits as currency.',
    domain: 'EdTech',
  },

  // FinTech
  {
    title: 'Micro-Investment App for Gig Workers',
    description: 'Rounds up every transaction to the nearest dollar and invests the spare change in ETFs, tailored for freelancers with irregular income.',
    domain: 'FinTech',
  },
  {
    title: 'AI Credit Scoring for Unbanked Populations',
    description: 'Uses alternative data — mobile phone usage, utility payments, social signals — to generate credit scores for people without bank accounts.',
    domain: 'FinTech',
  },
  {
    title: 'Cross-Border Payroll in Crypto',
    description: 'Enables companies to pay global remote teams instantly in stablecoins with automatic conversion and local tax compliance built in.',
    domain: 'FinTech',
  },

  // AgriTech
  {
    title: 'Drone-Based Crop Disease Detection',
    description: 'Autonomous drones equipped with multispectral cameras scan fields to identify early-stage crop diseases before visible symptoms appear.',
    domain: 'AgriTech',
  },
  {
    title: 'AI-Powered Irrigation Management',
    description: 'Soil sensors and weather forecasting combined with ML models to optimize irrigation schedules, cutting water use by up to 40%.',
    domain: 'AgriTech',
  },
  {
    title: 'Livestock Health Monitoring via RFID',
    description: 'RFID ear tags track animal movement and body temperature, alerting farmers to signs of illness before they spread to the herd.',
    domain: 'AgriTech',
  },

  // CleanTech
  {
    title: 'Residential Solar Panel Sharing Network',
    description: 'Allows households without rooftops to subscribe to fractions of solar panels installed on community buildings and earn credits on bills.',
    domain: 'CleanTech',
  },
  {
    title: 'AI-Optimized EV Charging Grid',
    description: 'Uses predictive demand modelling to intelligently distribute electricity across EV charging networks, reducing grid strain during peak hours.',
    domain: 'CleanTech',
  },
  {
    title: 'Plastic Waste Blockchain Tracking',
    description: 'Assigns unique digital IDs to plastic packaging at manufacture, enabling end-to-end tracking through the recycling supply chain.',
    domain: 'CleanTech',
  },

  // LegalTech
  {
    title: 'AI Contract Review for SMEs',
    description: 'Automatically reviews contracts for risky clauses, missing indemnity terms, and jurisdictional compliance — results in under 60 seconds.',
    domain: 'LegalTech',
  },
  {
    title: 'Online Dispute Resolution Platform',
    description: 'A structured, AI-mediated platform for resolving small business disputes without courts, cutting resolution time from months to days.',
    domain: 'LegalTech',
  },
  {
    title: 'Immigration Case Management SaaS',
    description: 'End-to-end management platform for immigration lawyers to track case status, deadlines, and document checklists across hundreds of clients.',
    domain: 'LegalTech',
  },

  // RetailTech
  {
    title: 'AI-Powered Visual Search for Fashion',
    description: 'Snap a photo of any outfit and instantly find identical or similar items available for purchase across multiple e-commerce platforms.',
    domain: 'RetailTech',
  },
  {
    title: 'Dynamic Pricing Engine for Physical Stores',
    description: 'Electronic shelf labels connected to a central pricing algorithm that adjusts prices based on demand, competitor data, and expiry dates.',
    domain: 'RetailTech',
  },
  {
    title: 'Augmented Reality Fitting Room',
    description: 'Shoppers virtually try on clothes using their phone camera, with accurate size recommendations powered by body measurement AI.',
    domain: 'RetailTech',
  },

  // HRTech
  {
    title: 'AI Resume Screening with Bias Detection',
    description: 'Screens thousands of resumes in seconds while actively flagging and correcting for demographic bias in shortlisting decisions.',
    domain: 'HRTech',
  },
  {
    title: 'Employee Burnout Prediction Dashboard',
    description: 'Analyzes calendar data, messaging patterns, and work hours to predict burnout risk 4-6 weeks in advance and trigger interventions.',
    domain: 'HRTech',
  },
  {
    title: 'Skills-Based Internal Talent Marketplace',
    description: 'Connects employees seeking new internal opportunities with project teams needing specific skills, bypassing traditional job postings.',
    domain: 'HRTech',
  },

  // PropTech
  {
    title: 'AI-Powered Property Valuation Engine',
    description: 'Real-time property price estimates combining comparable sales, satellite imagery, school rankings, and macroeconomic indicators.',
    domain: 'PropTech',
  },
  {
    title: 'Fractional Real Estate Investment App',
    description: 'Allows retail investors to buy fractional ownership of income-generating properties with as little as $50 and receive rental yield.',
    domain: 'PropTech',
  },
  {
    title: 'Smart Lease Management Platform',
    description: 'Automated lease lifecycle management with digital signing, payment tracking, maintenance request routing, and renewal reminders.',
    domain: 'PropTech',
  },

  // FoodTech
  {
    title: 'Personalized Meal Kit Service via DNA',
    description: "Uses DNA test results to curate weekly meal kits optimized for each customer's nutritional needs and food sensitivities.",
    domain: 'FoodTech',
  },
  {
    title: 'Restaurant Food Waste Reduction AI',
    description: 'Predicts daily covers and ingredient demand for restaurants, generates prep lists to minimize end-of-day food waste by 35%.',
    domain: 'FoodTech',
  },
  {
    title: 'Lab-Grown Meat Distribution Platform',
    description: 'B2B marketplace connecting cultivated meat producers with restaurants and retailers, handling cold-chain logistics and regulatory docs.',
    domain: 'FoodTech',
  },
];

async function seed() {
  console.log('\n🌱 Validra Sample Data Seeder');
  console.log('══════════════════════════════');
  console.log(`  Total ideas to seed: ${SAMPLE_IDEAS.length}`);
  console.log('  Generating embeddings…\n');

  await connectDB();
  const collection = getCollection();

  // Check existing count to avoid re-seeding
  const existing = await collection.countDocuments({ source: 'external' });
  if (existing >= SAMPLE_IDEAS.length) {
    console.log(`⚠️  Database already has ${existing} external ideas. Skipping seed to avoid duplicates.`);
    console.log('   To force re-seed, manually delete existing documents.\n');
    await closeDB();
    return;
  }

  let seeded = 0;
  const startTime = Date.now();

  for (const [idx, idea] of SAMPLE_IDEAS.entries()) {
    process.stdout.write(
      `  [${(idx + 1).toString().padStart(2, '0')}/${SAMPLE_IDEAS.length}] "${idea.title.slice(0, 50)}"… `
    );

    const text = buildEmbeddingText(idea.title, idea.description);
    const vector_embedding = await generateEmbedding(text);

    await collection.insertOne({
      ...idea,
      vector_embedding,
      source: 'external',
      created_at: new Date(),
    });

    seeded++;
    console.log('✅');
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Seeded ${seeded} ideas in ${elapsed}s`);
  console.log('   Your database is ready for testing!\n');

  await closeDB();
}

seed().catch((err) => {
  console.error('❌ Seeder failed:', err);
  process.exit(1);
});
