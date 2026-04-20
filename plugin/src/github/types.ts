export type RepositoryRef = {
	name: string;
	owner: string;
	fullName: string;
	url: string;
};

export type GitHubActor = {
	login: string;
	avatarUrl: string;
	url: string;
	type: string;
};

export type GitHubLabel = {
	name: string;
	color: string;
	description: string | null;
};

export type PullSummary = {
	id: number;
	number: number;
	title: string;
	state: string;
	isDraft: boolean;
	createdAt: string;
	updatedAt: string;
	closedAt: string | null;
	mergedAt: string | null;
	comments: number;
	url: string;
	author: GitHubActor | null;
	labels: GitHubLabel[];
	repository: RepositoryRef;
};

export type RequestedTeam = {
	slug: string;
	name: string;
	url: string;
};

export type PullDetail = PullSummary & {
	body: string;
	additions: number;
	deletions: number;
	changedFiles: number;
	commits: number;
	reviewComments: number;
	headRefName: string;
	headSha: string;
	headRepoOwner: string | null;
	baseRefName: string;
	isMerged: boolean;
	mergeCommitSha: string | null;
	mergedBy: GitHubActor | null;
	mergeable: boolean | null;
	mergeableState?: string | null;
	requestedReviewers: GitHubActor[];
	requestedTeams: RequestedTeam[];
};

export type IssueSummary = {
	id: number;
	number: number;
	title: string;
	state: string;
	stateReason: string | null;
	createdAt: string;
	updatedAt: string;
	closedAt: string | null;
	comments: number;
	url: string;
	author: GitHubActor | null;
	labels: GitHubLabel[];
	repository: RepositoryRef;
};

export type IssueDetail = IssueSummary & {
	body: string;
	assignees: GitHubActor[];
	milestone: {
		title: string;
		description: string | null;
		dueOn: string | null;
	} | null;
};

export type MyPullsResult = {
	reviewRequested: PullSummary[];
	assigned: PullSummary[];
	authored: PullSummary[];
	mentioned: PullSummary[];
	involved: PullSummary[];
	forbiddenOrgs?: string[];
	timedOut?: boolean;
};

export type MyIssuesResult = {
	assigned: IssueSummary[];
	authored: IssueSummary[];
	mentioned: IssueSummary[];
	forbiddenOrgs?: string[];
	timedOut?: boolean;
};

export type CommentReactions = {
	total: number;
	byType: Partial<Record<'+1' | '-1' | 'laugh' | 'hooray' | 'confused' | 'heart' | 'rocket' | 'eyes', number>>;
};

export type PullComment = {
	id: number;
	body: string;
	createdAt: string;
	author: GitHubActor | null;
	reactions?: CommentReactions;
};

export type IssueComment = {
	id: number;
	body: string;
	createdAt: string;
	author: GitHubActor | null;
	reactions?: CommentReactions;
};

export type TimelineEvent = {
	id: number;
	event: string;
	createdAt: string;
	actor: GitHubActor | null;
	label?: { name: string; color: string };
	assignee?: GitHubActor | null;
	requestedReviewer?: GitHubActor | null;
	requestedTeam?: { name: string; slug: string } | null;
	rename?: { from: string; to: string };
	source?: {
		type: "issue" | "pull_request";
		number: number;
		title: string;
		state: string;
		url: string;
		repository: string | null;
	} | null;
	milestone?: { title: string } | null;
	reviewState?: string;
	stateReason?: string | null;
	body?: string;
};

export type GroupedLabelEvent = {
	kind: "grouped-label";
	actor: GitHubActor | null;
	createdAt: string;
	added: Array<{ name: string; color: string }>;
	removed: Array<{ name: string; color: string }>;
};

export type ReviewComment = {
	id: number;
	inReplyToId: number | null;
	path: string;
	line: number | null;
	originalLine: number | null;
	side: "LEFT" | "RIGHT";
	diffHunk: string;
	body: string;
	createdAt: string;
	author: GitHubActor | null;
};

export type ReviewThread = {
	id: number;
	path: string;
	line: number | null;
	side: "LEFT" | "RIGHT";
	diffHunk: string;
	isResolved: boolean;
	root: ReviewComment;
	replies: ReviewComment[];
};

export type PullPageData = {
	detail: PullDetail | null;
	comments: PullComment[];
	events: TimelineEvent[];
	reviewThreads?: ReviewThread[];
};

export type IssuePageData = {
	detail: IssueDetail | null;
	comments: IssueComment[];
	events: TimelineEvent[];
};

export type GitHubUserProfile = {
	login: string;
	name: string | null;
	avatarUrl: string;
	url: string;
};

export type Repository = {
	id: number;
	name: string;
	fullName: string;
	owner: string;
	description: string | null;
	url: string;
	language: string | null;
	stars: number;
	forks: number;
	isPrivate: boolean;
	isFork: boolean;
	isArchived: boolean;
	updatedAt: string;
	pushedAt: string;
};

export type MyReposResult = {
	repos: Repository[];
	fetchedAt: number;
};

export type GitHubProfile = {
	login: string;
	name: string | null;
	avatarUrl: string;
	url: string;
	bio: string | null;
	company: string | null;
	location: string | null;
	blog: string | null;
	email: string | null;
	followers: number;
	following: number;
	publicRepos: number;
	createdAt: string;
	type: string;
};

export type ProfilePageData = {
	profile: GitHubProfile | null;
	repos: Repository[];
	recentPulls: PullSummary[];
	recentIssues: IssueSummary[];
};

export type GitHubNotification = {
	id: string;
	unread: boolean;
	reason: string;
	subject: {
		title: string;
		url: string | null;
		type: string;
	};
	repository: {
		fullName: string;
		url: string;
	};
	updatedAt: string;
};
