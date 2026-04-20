import type { MyPullsResult, MyIssuesResult, MyReposResult } from "./github/types";

export interface OpenDetailTab {
	id: string;
	type: "pr" | "issue" | "repo" | "profile";
	title: string;
	iconColor: string;
	owner?: string;
	repo?: string;
	number?: number;
	login?: string;
	avatarUrl?: string;
}

export interface CachedData {
	pulls: MyPullsResult | null;
	issues: MyIssuesResult | null;
	repos: MyReposResult | null;
	lastFetched: number;
	lastSeen: Record<string, number>;
	openTabs: OpenDetailTab[];
}

const EMPTY_CACHE: CachedData = { pulls: null, issues: null, repos: null, lastFetched: 0, lastSeen: {}, openTabs: [] };

export function emptyCacheData(): CachedData {
	return { ...EMPTY_CACHE, lastSeen: {}, openTabs: [] };
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
