import type { MyPullsResult, MyIssuesResult } from "./github/types";

export interface CachedData {
	pulls: MyPullsResult | null;
	issues: MyIssuesResult | null;
	lastFetched: number;
}

const EMPTY_CACHE: CachedData = { pulls: null, issues: null, lastFetched: 0 };

export function emptyCacheData(): CachedData {
	return { ...EMPTY_CACHE };
}

export function isCacheStale(cache: CachedData, maxAgeMs: number): boolean {
	if (!cache.pulls && !cache.issues) return true;
	return Date.now() - cache.lastFetched > maxAgeMs;
}
