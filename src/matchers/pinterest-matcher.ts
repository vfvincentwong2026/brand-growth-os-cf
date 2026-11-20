export type VisualIntentDomain = "brand_vi" | "packaging" | "spatial_3d" | "campaign";

export interface PinterestCandidatePin {
  pinId: string;
  sourceUrl: string;
  imageUrl: string;
  title?: string;
  description?: string;
  tags?: string[];
  width?: number;
  height?: number;
  perceptualHash: string;
  r2Key: string;
}

export interface MatchingContext {
  projectId: string;
  industry: string;
  brandKeywords: string[];
  moodKeywords: string[];
  forbiddenKeywords: string[];
  intentDomain: VisualIntentDomain;
  minScore: number;
  targetCount: number;
}

export interface ScoredPin extends PinterestCandidatePin {
  intentDomain: VisualIntentDomain;
  score: number;
  rationale: string;
}

/**
 * Synthesizes multi-axis Pinterest search queries, deduplicates/filters noisy pins,
 * and scores candidates against brand intent, aesthetic harmony, and anti-patterns.
 */
export class PinterestMatcher {
  public buildSearchQueries(ctx: MatchingContext): string[] {
    const baseDomainMap: Record<VisualIntentDomain, string[]> = {
      brand_vi: ["brand identity system", "minimalist logo grid", "editorial visual identity"],
      packaging: ["packaging design editorial", "tactile paper box mockup", "product packaging aesthetic"],
      spatial_3d: ["retail interior architecture", "pop up space design", "warm studio lighting interior"],
      campaign: ["brand campaign art direction", "editorial product photography", "visual storytelling poster"],
    };

    const queries = new Set<string>();
    const domainSeeds = baseDomainMap[ctx.intentDomain] ?? baseDomainMap.brand_vi;

    for (const seed of domainSeeds) {
      for (const mood of ctx.moodKeywords.slice(0, 3)) {
        queries.add(`${ctx.industry} ${seed} ${mood}`.trim());
      }
      for (const kw of ctx.brandKeywords.slice(0, 2)) {
        queries.add(`${kw} ${seed}`.trim());
      }
    }

    return Array.from(queries).slice(0, 8);
  }

  public rankCandidates(
    candidates: PinterestCandidatePin[],
    ctx: MatchingContext
  ): ScoredPin[] {
    const seenHashes = new Set<string>();
    const scored: ScoredPin[] = [];

    for (const pin of candidates) {
      if (!pin.perceptualHash || seenHashes.has(pin.perceptualHash)) {
        continue;
      }
      seenHashes.add(pin.perceptualHash);

      if ((pin.width && pin.width < 400) || (pin.height && pin.height < 400)) {
        continue;
      }

      const corpus = [
        pin.title ?? "",
        pin.description ?? "",
        ...(pin.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();

      const hasForbidden = ctx.forbiddenKeywords.some(
        (bad) => bad.trim().length > 0 && corpus.includes(bad.toLowerCase())
      );
      if (hasForbidden) {
        continue;
      }

      let intentScore = 0.35;
      if (ctx.intentDomain === "packaging" && /(packaging|box|cup|label|bag|bottle|wrap)/i.test(corpus)) {
        intentScore += 0.25;
      } else if (ctx.intentDomain === "spatial_3d" && /(interior|space|retail|kiosk|booth|lighting|architecture)/i.test(corpus)) {
        intentScore += 0.25;
      } else if (ctx.intentDomain === "brand_vi" && /(brand|logo|identity|typography|grid|poster)/i.test(corpus)) {
        intentScore += 0.25;
      } else if (ctx.intentDomain === "campaign" && /(campaign|editorial|photography|art direction)/i.test(corpus)) {
        intentScore += 0.25;
      }

      const moodHits = ctx.moodKeywords.filter((m) => corpus.includes(m.toLowerCase())).length;
      const brandHits = ctx.brandKeywords.filter((k) => corpus.includes(k.toLowerCase())).length;
      const aestheticScore = Math.min(0.3, moodHits * 0.1 + brandHits * 0.07);

      const resolutionBonus =
        (pin.width ?? 0) >= 800 && (pin.height ?? 0) >= 800 ? 0.1 : 0.04;

      const totalScore = Number(Math.min(0.99, intentScore + aestheticScore + resolutionBonus).toFixed(3));

      if (totalScore >= ctx.minScore) {
        scored.push({
          ...pin,
          intentDomain: ctx.intentDomain,
          score: totalScore,
          rationale: `intent=${intentScore.toFixed(2)}, mood_hits=${moodHits}, brand_hits=${brandHits}`,
        });
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, ctx.targetCount);
  }
}
