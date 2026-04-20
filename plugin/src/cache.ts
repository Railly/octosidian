import type { MyPullsResult, MyIssuesResult } from "./github/types";

export interface CachedData {
	pulls: MyPullsResult | null;
	issues: MyIssuesResult | null;
	lastFetched: number;
	lastSeen: Record<string, number>;
}

const EMPTY_CACHE: CachedData = { pulls: null, issues: null, lastFetched: 0, lastSeen: {} };

export function emptyCacheData(): CachedData {
	return { ...EMPTY_CACHE, lastSeen: {} };
}

export function isCacheStale(cache: CachedData, maxAgeMs: number): boolean {
	if (!cache.pulls && !cache.issues) return true;
	return Date.now() - cache.lastFetched > maxAgeMs;
}

export function seenKey(kind: "pr" | "issue", id: number): string {
	return `${kind}:${id}`;
}

export function isUnread(
	cache: CachedData,
	kind: "pr" | "issue",
	id: number,
	updatedAt: string,
): boolean {
	const key = seenKey(kind, id);
	const seenTs = cache.lastSeen[key] ?? 0;
	return new Date(updatedAt).getTime() > seenTs;
}
