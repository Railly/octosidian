import { getClient } from "./client";
import type {
	MyPullsResult,
	MyIssuesResult,
	PullSummary,
	IssueSummary,
	PullDetail,
	IssueDetail,
	PullPageData,
	IssuePageData,
	RepositoryRef,
	GitHubActor,
	GitHubLabel,
	PullComment,
	IssueComment,
	TimelineEvent,
	GitHubNotification,
} from "./types";

function requireClient() {
	const client = getClient();
	if (!client) throw new Error("GitHub client not initialized");
	return client;
}

function mapActor(raw: { login: string; avatar_url: string; html_url: string; type?: string } | null): GitHubActor | null {
	if (!raw) return null;
	return {
		login: raw.login,
		avatarUrl: raw.avatar_url,
		url: raw.html_url,
		type: raw.type ?? "User",
	};
}

function mapRepo(raw: { name: string; owner: { login: string }; full_name: string; html_url: string } | undefined, fallbackUrl?: string): RepositoryRef {
	if (raw?.name && raw?.owner) {
		return {
			name: raw.name,
			owner: raw.owner.login,
			fullName: raw.full_name,
			url: raw.html_url,
		};
	}
	if (fallbackUrl) {
		const match = fallbackUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
		if (match) {
			return {
				name: match[2],
				owner: match[1],
				fullName: `${match[1]}/${match[2]}`,
				url: `https://github.com/${match[1]}/${match[2]}`,
			};
		}
	}
	return { name: "unknown", owner: "unknown", fullName: "unknown", url: "" };
}

function mapLabels(raw: Array<{ name?: string; color?: string; description?: string | null }>): GitHubLabel[] {
	return raw
		.filter((l): l is { name: string; color: string; description: string | null } => typeof l.name === "string")
		.map((l) => ({
			name: l.name,
			color: l.color ?? "000000",
			description: l.description ?? null,
		}));
}

function mapPullSummary(raw: Record<string, unknown>): PullSummary {
	const r = raw as Record<string, any>;
	return {
		id: r.id,
		number: r.number,
		title: r.title,
		state: r.state,
		isDraft: r.draft ?? false,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
		closedAt: r.closed_at ?? null,
		mergedAt: r.merged_at ?? null,
		comments: r.comments ?? 0,
		url: r.html_url,
		author: mapActor(r.user),
		labels: mapLabels(r.labels ?? []),
		repository: mapRepo(r.repository ?? r.base?.repo, r.html_url ?? r.repository_url),
	};
}

function mapIssueSummary(raw: Record<string, unknown>): IssueSummary {
	const r = raw as Record<string, any>;
	return {
		id: r.id,
		number: r.number,
		title: r.title,
		state: r.state,
		stateReason: r.state_reason ?? null,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
		closedAt: r.closed_at ?? null,
		comments: r.comments ?? 0,
		url: r.html_url,
		author: mapActor(r.user),
		labels: mapLabels(r.labels ?? []),
		repository: mapRepo(r.repository, r.html_url ?? r.repository_url),
	};
}

export async function getMyPulls(): Promise<MyPullsResult> {
	const client = requireClient();
	const { data: user } = await client.rest.users.getAuthenticated();
	const username = user.login;

	const roles = ["review-requested", "assigned", "author", "mentioned"] as const;
	const results = await Promise.all(
		roles.map((role) =>
			client.rest.search.issuesAndPullRequests({
				q: `is:pr is:open ${role === "author" ? `author:${username}` : `${role}:${username}`}`,
				per_page: 30,
				sort: "updated",
				order: "desc",
			}),
		),
	);

	return {
		reviewRequested: results[0].data.items.map((item) => mapPullSummary(item as Record<string, unknown>)),
		assigned: results[1].data.items.map((item) => mapPullSummary(item as Record<string, unknown>)),
		authored: results[2].data.items.map((item) => mapPullSummary(item as Record<string, unknown>)),
		mentioned: results[3].data.items.map((item) => mapPullSummary(item as Record<string, unknown>)),
		involved: [],
	};
}

export async function getMyIssues(): Promise<MyIssuesResult> {
	const client = requireClient();
	const { data: user } = await client.rest.users.getAuthenticated();
	const username = user.login;

	const roles = ["assignee", "author", "mentioned"] as const;
	const results = await Promise.all(
		roles.map((role) =>
			client.rest.search.issuesAndPullRequests({
				q: `is:issue is:open ${role === "author" ? `author:${username}` : `${role}:${username}`}`,
				per_page: 30,
				sort: "updated",
				order: "desc",
			}),
		),
	);

	return {
		assigned: results[0].data.items.map((item) => mapIssueSummary(item as Record<string, unknown>)),
		authored: results[1].data.items.map((item) => mapIssueSummary(item as Record<string, unknown>)),
		mentioned: results[2].data.items.map((item) => mapIssueSummary(item as Record<string, unknown>)),
	};
}

export async function getPullDetail(
	owner: string,
	repo: string,
	pullNumber: number,
): Promise<PullDetail | null> {
	const client = requireClient();
	try {
		const { data: pr } = await client.rest.pulls.get({ owner, repo, pull_number: pullNumber });
		return {
			id: pr.id,
			number: pr.number,
			title: pr.title,
			state: pr.state,
			isDraft: pr.draft ?? false,
			createdAt: pr.created_at,
			updatedAt: pr.updated_at,
			closedAt: pr.closed_at ?? null,
			mergedAt: pr.merged_at ?? null,
			comments: pr.comments,
			url: pr.html_url,
			author: mapActor(pr.user as any),
			labels: mapLabels(pr.labels as any),
			repository: mapRepo(pr.base.repo as any),
			body: pr.body ?? "",
			additions: pr.additions,
			deletions: pr.deletions,
			changedFiles: pr.changed_files,
			commits: pr.commits,
			reviewComments: pr.review_comments,
			headRefName: pr.head.ref,
			headSha: pr.head.sha,
			headRepoOwner: pr.head.repo?.owner?.login ?? null,
			baseRefName: pr.base.ref,
			isMerged: pr.merged,
			mergeCommitSha: pr.merge_commit_sha ?? null,
			mergedBy: pr.merged_by ? mapActor(pr.merged_by as any) : null,
			mergeable: pr.mergeable ?? null,
			mergeableState: (pr as any).mergeable_state ?? null,
			requestedReviewers: (pr.requested_reviewers ?? []).map((r: any) => mapActor(r)!),
			requestedTeams: (pr.requested_teams ?? []).map((t: any) => ({
				slug: t.slug,
				name: t.name,
				url: t.html_url ?? "",
			})),
		};
	} catch {
		return null;
	}
}

export async function getIssueDetail(
	owner: string,
	repo: string,
	issueNumber: number,
): Promise<IssueDetail | null> {
	const client = requireClient();
	try {
		const { data: issue } = await client.rest.issues.get({ owner, repo, issue_number: issueNumber });
		if (issue.pull_request) return null;
		return {
			id: issue.id,
			number: issue.number,
			title: issue.title,
			state: issue.state,
			stateReason: (issue as any).state_reason ?? null,
			createdAt: issue.created_at,
			updatedAt: issue.updated_at,
			closedAt: issue.closed_at ?? null,
			comments: issue.comments,
			url: issue.html_url,
			author: mapActor(issue.user as any),
			labels: mapLabels(issue.labels as any),
			repository: { name: repo, owner, fullName: `${owner}/${repo}`, url: `https://github.com/${owner}/${repo}` },
			body: issue.body ?? "",
			assignees: (issue.assignees ?? []).map((a: any) => mapActor(a)!),
			milestone: issue.milestone
				? {
						title: issue.milestone.title,
						description: issue.milestone.description ?? null,
						dueOn: issue.milestone.due_on ?? null,
					}
				: null,
		};
	} catch {
		return null;
	}
}

export async function getPullPageData(
	owner: string,
	repo: string,
	pullNumber: number,
): Promise<PullPageData | null> {
	const client = requireClient();
	const detail = await getPullDetail(owner, repo, pullNumber);
	if (!detail) return null;

	let commentsRes: { data: any[] } = { data: [] };
	let eventsRes: { data: any[] } = { data: [] };
	try {
		[commentsRes, eventsRes] = await Promise.all([
			client.rest.issues.listComments({ owner, repo, issue_number: pullNumber, per_page: 30 }),
			client.rest.issues.listEvents({ owner, repo, issue_number: pullNumber, per_page: 100 }),
		]);
	} catch { /* 403 on private repos — show detail without comments */ }

	const comments: PullComment[] = commentsRes.data.map((c) => ({
		id: c.id,
		body: c.body ?? "",
		createdAt: c.created_at,
		author: mapActor(c.user as any),
	}));

	const events: TimelineEvent[] = eventsRes.data.map((e: any) => ({
		id: e.id,
		event: e.event,
		createdAt: e.created_at,
		actor: mapActor(e.actor),
		label: e.label ?? undefined,
		assignee: e.assignee ? mapActor(e.assignee) : undefined,
		requestedReviewer: e.requested_reviewer ? mapActor(e.requested_reviewer) : undefined,
		rename: e.rename ?? undefined,
		milestone: e.milestone ?? undefined,
		reviewState: e.state ?? undefined,
	}));

	return { detail, comments, events };
}

export async function getIssuePageData(
	owner: string,
	repo: string,
	issueNumber: number,
): Promise<IssuePageData | null> {
	const client = requireClient();
	const detail = await getIssueDetail(owner, repo, issueNumber);
	if (!detail) return null;

	let commentsRes: { data: any[] } = { data: [] };
	let eventsRes: { data: any[] } = { data: [] };
	try {
		[commentsRes, eventsRes] = await Promise.all([
			client.rest.issues.listComments({ owner, repo, issue_number: issueNumber, per_page: 30 }),
			client.rest.issues.listEvents({ owner, repo, issue_number: issueNumber, per_page: 100 }),
		]);
	} catch { /* 403 fallback */ }

	const comments: IssueComment[] = commentsRes.data.map((c) => ({
		id: c.id,
		body: c.body ?? "",
		createdAt: c.created_at,
		author: mapActor(c.user as any),
	}));

	const events: TimelineEvent[] = eventsRes.data.map((e: any) => ({
		id: e.id,
		event: e.event,
		createdAt: e.created_at,
		actor: mapActor(e.actor),
		label: e.label ?? undefined,
		assignee: e.assignee ? mapActor(e.assignee) : undefined,
		rename: e.rename ?? undefined,
		milestone: e.milestone ?? undefined,
	}));

	return { detail, comments, events };
}

export async function createComment(owner: string, repo: string, issueNumber: number, body: string): Promise<void> {
	const client = requireClient();
	await client.rest.issues.createComment({ owner, repo, issue_number: issueNumber, body });
}

export async function updatePullState(owner: string, repo: string, pullNumber: number, state: "open" | "closed"): Promise<void> {
	const client = requireClient();
	await client.rest.pulls.update({ owner, repo, pull_number: pullNumber, state });
}

export async function updateIssueState(owner: string, repo: string, issueNumber: number, state: "open" | "closed"): Promise<void> {
	const client = requireClient();
	await client.rest.issues.update({ owner, repo, issue_number: issueNumber, state });
}

export async function mergePullRequest(owner: string, repo: string, pullNumber: number, method: "merge" | "squash" | "rebase"): Promise<void> {
	const client = requireClient();
	await client.rest.pulls.merge({ owner, repo, pull_number: pullNumber, merge_method: method });
}

export type CheckRun = {
	name: string;
	status: string;
	conclusion: string | null;
	appAvatarUrl: string | null;
};

export async function getPullChecks(owner: string, repo: string, ref: string): Promise<CheckRun[]> {
	const client = requireClient();
	try {
		const { data } = await client.rest.checks.listForRef({ owner, repo, ref, per_page: 50 });
		return data.check_runs.map((r: any) => ({
			name: r.name,
			status: r.status,
			conclusion: r.conclusion ?? null,
			appAvatarUrl: r.app?.owner?.avatar_url ?? null,
		}));
	} catch {
		return [];
	}
}

export async function markNotificationRead(threadId: string): Promise<void> {
	const client = requireClient();
	await client.rest.activity.markThreadAsRead({ thread_id: Number(threadId) });
}

export async function markAllNotificationsRead(): Promise<void> {
	const client = requireClient();
	await client.rest.activity.markNotificationsAsRead();
}

export async function searchIssuesAndPRs(query: string): Promise<Array<{ number: number; title: string; state: string; html_url: string; pull_request?: unknown; repository_url: string }>> {
	const client = requireClient();
	try {
		const { data } = await client.rest.search.issuesAndPullRequests({ q: query, per_page: 10 });
		return data.items.map((item: any) => ({
			number: item.number,
			title: item.title,
			state: item.state,
			html_url: item.html_url,
			pull_request: item.pull_request,
			repository_url: item.repository_url,
		}));
	} catch {
		return [];
	}
}

export async function getNotifications(all = false): Promise<GitHubNotification[]> {
	const client = requireClient();
	try {
		const { data } = await client.rest.activity.listNotificationsForAuthenticatedUser({
			all,
			per_page: 50,
		});
		return data.map((n: any) => ({
			id: n.id,
			unread: n.unread,
			reason: n.reason,
			subject: {
				title: n.subject.title,
				url: n.subject.url,
				type: n.subject.type,
			},
			repository: {
				fullName: n.repository.full_name,
				url: n.repository.html_url,
			},
			updatedAt: n.updated_at,
		}));
	} catch {
		return [];
	}
}

export async function getRepoOverview(owner: string, repo: string) {
	const client = requireClient();
	try {
		const { data } = await client.rest.repos.get({ owner, repo });
		return {
			description: data.description ?? "",
			stars: data.stargazers_count,
			forks: data.forks_count,
			watchers: data.watchers_count,
			language: data.language,
			license: data.license?.spdx_id ?? null,
			defaultBranch: data.default_branch,
		};
	} catch {
		return null;
	}
}

export async function getRepoTree(owner: string, repo: string, path = "") {
	const client = requireClient();
	try {
		const { data } = await client.rest.repos.getContent({ owner, repo, path });
		if (!Array.isArray(data)) return [];
		return data
			.map((item: any) => ({ name: item.name, type: item.type as string, path: item.path as string, size: item.size ?? 0 }))
			.sort((a: { type: string; name: string }, b: { type: string; name: string }) => {
				if (a.type === "dir" && b.type !== "dir") return -1;
				if (a.type !== "dir" && b.type === "dir") return 1;
				return a.name.localeCompare(b.name);
			});
	} catch {
		return [];
	}
}

export async function getRepoReadme(owner: string, repo: string): Promise<string | null> {
	const client = requireClient();
	try {
		const { data } = await client.rest.repos.getReadme({ owner, repo, mediaType: { format: "raw" } });
		return data as unknown as string;
	} catch {
		return null;
	}
}

export async function getRepoPulls(owner: string, repo: string, perPage = 5): Promise<PullSummary[]> {
	const client = requireClient();
	try {
		const { data } = await client.rest.pulls.list({ owner, repo, state: "open", per_page: perPage, sort: "updated", direction: "desc" });
		return data.map((pr: any) => mapPullSummary(pr as Record<string, unknown>));
	} catch {
		return [];
	}
}

export async function getRepoIssues(owner: string, repo: string, perPage = 5): Promise<IssueSummary[]> {
	const client = requireClient();
	try {
		const { data } = await client.rest.issues.listForRepo({ owner, repo, state: "open", per_page: perPage, sort: "updated", direction: "desc" });
		return data.filter((i: any) => !i.pull_request).map((i: any) => mapIssueSummary(i as Record<string, unknown>));
	} catch {
		return [];
	}
}

export async function getFileContent(owner: string, repo: string, path: string): Promise<{ content: string; size: number; encoding: string } | null> {
	const client = requireClient();
	try {
		const { data } = await client.rest.repos.getContent({ owner, repo, path, mediaType: { format: "raw" } });
		return { content: data as unknown as string, size: (data as any).length ?? 0, encoding: "utf-8" };
	} catch {
		return null;
	}
}
