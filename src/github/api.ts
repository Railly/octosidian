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
