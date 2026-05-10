/**
 * The 10 booming startup domains for Validra.
 * Updated as per user request for 2024-2026 registration ingestion.
 */
export const DOMAINS = [
  'Agentic AI',
  'Climate Tech',
  'Fintech',
  'HealthTech',
  'Cybersecurity',
  'EdTech',
  'Logistics',
  'SpaceTech',
  'AgriTech',
  'Retail/E-commerce'
];

/**
 * Validates that a given domain string is one of the 10 allowed values.
 * Case-insensitive comparison; returns the canonical casing or null.
 */
export function validateDomain(domain) {
  if (!domain) return null;
  const match = DOMAINS.find(
    (d) => d.toLowerCase() === domain.toLowerCase()
  );
  return match ?? null;
}
