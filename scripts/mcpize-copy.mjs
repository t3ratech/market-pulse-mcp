#!/usr/bin/env node
// Prints the MCPize listing copy and plan for each tier, derived from the live service's plans.
//   node scripts/mcpize-copy.mjs [tier]      JSON on stdout
import { fetchOffers, listingCopy, longDescription } from "./lib/plans.mjs";

const wanted = process.argv[2];
const { plans, freeTier } = await fetchOffers();
const out = plans.filter(p => !wanted || p.tier === wanted).map(p => ({ ...listingCopy(p, freeTier), longDescription: longDescription(p, plans, freeTier) }));
if (out.length === 0) { console.error(`no such tier: ${wanted}`); process.exit(1); }
console.log(JSON.stringify(out, null, 2));
