import { ItemView, MarkdownRenderer, WorkspaceLeaf, Notice } from "obsidian";
import type OctosidianPlugin from "../main";
import { getClient } from "../github/client";
import { getMyPulls, getMyIssues, getNotifications, getPullPageData, getIssuePageData, createComment, updatePullState, updateIssueState, mergePullRequest, getPullChecks, markNotificationRead, markAllNotificationsRead, getRepoOverview, getRepoTree, getRepoReadme, getRepoPulls, getRepoIssues, getFileContent, type CheckRun } from "../github/api";
import type {
	MyPullsResult,
	MyIssuesResult,
	PullSummary,
	IssueSummary,
	PullPageData,
	IssuePageData,
	GitHubNotification,
	PullComment,
	IssueComment,
} from "../github/types";
import { ICONS, prStateIcon } from "../icons";
import { textColorFor } from "../lib/contrast";
import { isUnread, seenKey } from "../cache";

function labelAttrs(color: string): { style: string } {
	const textColor = textColorFor(color) === "dark" ? "#000000" : "#ffffff";
	return { style: `--label-color: #${color}; --label-text: ${textColor}` };
}

export const OCTO_VIEW_TYPE = "octo-view";

type TopTab = "overview" | "inbox" | "pulls" | "issues" | "reviews";
type RoleFilter = "all" | "review-requested" | "authored" | "assigned" | "mentioned" | "involved";
type DetailState =
	| null
	| { type: "pr"; owner: string; repo: string; number: number; data: PullPageData | null; loading: boolean }
	| { type: "issue"; owner: string; repo: string; number: number; data: IssuePageData | null; loading: boolean };

interface RepoViewState {
	owner: string;
	repo: string;
	tree: Array<{ name: string; type: string; path: string; size: number }> | null;
	readme: string | null;
	overview: { description: string; stars: number; forks: number; watchers: number; language: string | null; license: string | null; defaultBranch: string } | null;
	recentPrs: PullSummary[];
	recentIssues: IssueSummary[];
	loading: boolean;
	treePath: string;
	fileContent: string | null;
	filePath: string | null;
}

const LANG_MAP: Record<string, string> = {
	ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", mjs: "javascript", cjs: "javascript",
	py: "python", rb: "ruby", go: "go", rs: "rust", java: "java", kt: "kotlin", swift: "swift",
	c: "c", h: "c", cpp: "cpp", cc: "cpp", hpp: "cpp",
	cs: "csharp", php: "php", sh: "bash", bash: "bash", zsh: "bash", fish: "bash",
	yml: "yaml", yaml: "yaml", toml: "toml", json: "json", xml: "xml", html: "html",
	css: "css", scss: "scss", sass: "sass", less: "less",
	sql: "sql", graphql: "graphql", gql: "graphql",
	dockerfile: "dockerfile", makefile: "makefile",
	lock: "json", gitignore: "bash",
};

function getLangFromExt(ext: string): string {
	return LANG_MAP[ext] ?? ext ?? "";
}

export class OctosidianView extends ItemView {
	plugin: OctosidianPlugin;
	pullsData: MyPullsResult | null = null;
	issuesData: MyIssuesResult | null = null;
	notifications: GitHubNotification[] = [];
	inboxFilter: "unread" | "all" = "unread";
	loading = false;
	activeTab: TopTab = "overview";
	activeRole: RoleFilter = "all";
	searchQuery = "";
	sortBy: "updated" | "newest" | "oldest" | "comments" = "updated";
	repoFilter: string | null = null;
	statusFilter: "all" | "open" | "draft" | "merged" | "closed" = "all";
	detail: DetailState = null;
	repoView: RepoViewState | null = null;
	lastFetched = 0;
	expandedRows: Set<number> = new Set();
	expandedCache: Map<number, PullPageData | IssuePageData> = new Map();

	constructor(leaf: WorkspaceLeaf, plugin: OctosidianPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string { return OCTO_VIEW_TYPE; }
	getDisplayText(): string { return "Octosidian"; }
	getIcon(): string { return "git-pull-request"; }

	async onOpen() {
		this.containerEl.addClass("octo-container");

		const cached = this.plugin.cache;
		if (cached.pulls || cached.issues) {
			this.pullsData = cached.pulls;
			this.issuesData = cached.issues;
			this.lastFetched = cached.lastFetched;
		}

		this.render();

		if (getClient()) {
			this.refreshInBackground();
		}
	}

	async onClose() {}

	async refreshInBackground() {
		if (!getClient()) return;
		this.loading = true;
		this.render();
		try {
			const [pulls, issues, notifs] = await Promise.all([getMyPulls(), getMyIssues(), getNotifications()]);
			this.pullsData = pulls;
			this.issuesData = issues;
			this.notifications = notifs;
			this.lastFetched = Date.now();

			this.plugin.cache = {
				...this.plugin.cache,
				pulls,
				issues,
				lastFetched: this.lastFetched,
			};
			this.plugin.saveCache();
		} catch (err) {
			if (!this.pullsData && !this.issuesData) {
				new Notice(`Octosidian: ${err instanceof Error ? err.message : "Failed to fetch"}`);
			}
		}
		this.loading = false;
		this.render();
	}

	async refresh() {
		if (!getClient()) {
			new Notice("Octosidian: No GitHub token configured");
			return;
		}
		await this.refreshInBackground();
	}

	prChecks: CheckRun[] = [];

	async openPrDetail(owner: string, repo: string, num: number) {
		this.markSeenByNumber("pr", owner, repo, num);
		this.detail = { type: "pr", owner, repo, number: num, data: null, loading: true };
		this.render();
		try {
			const data = await getPullPageData(owner, repo, num);
			if (data?.detail?.headSha) {
				this.prChecks = await getPullChecks(owner, repo, data.detail.headSha);
			} else {
				this.prChecks = [];
			}
			if (this.detail?.type === "pr" && this.detail.number === num) {
				this.detail = { ...this.detail, data, loading: false };
				this.render();
			}
		} catch {
			new Notice("Octosidian: Failed to load PR details");
			this.detail = null;
			this.render();
		}
	}

	async openIssueDetail(owner: string, repo: string, num: number) {
		this.markSeenByNumber("issue", owner, repo, num);
		this.detail = { type: "issue", owner, repo, number: num, data: null, loading: true };
		this.render();
		try {
			const data = await getIssuePageData(owner, repo, num);
			if (this.detail?.type === "issue" && this.detail.number === num) {
				this.detail = { ...this.detail, data, loading: false };
				this.render();
			}
		} catch {
			new Notice("Octosidian: Failed to load issue details");
			this.detail = null;
			this.render();
		}
	}

	closeDetail() {
		this.detail = null;
		this.render();
	}

	async openRepoView(owner: string, repo: string) {
		this.repoView = { owner, repo, tree: null, readme: null, overview: null, recentPrs: [], recentIssues: [], loading: true, treePath: "", fileContent: null, filePath: null };
		this.detail = null;
		this.render();
		try {
			const [overview, tree, readme, prs, issues] = await Promise.all([
				getRepoOverview(owner, repo),
				getRepoTree(owner, repo),
				getRepoReadme(owner, repo),
				getRepoPulls(owner, repo),
				getRepoIssues(owner, repo),
			]);
			if (this.repoView?.owner === owner && this.repoView?.repo === repo) {
				this.repoView = { ...this.repoView, overview, tree, readme, recentPrs: prs, recentIssues: issues, loading: false };
				this.render();
			}
		} catch {
			new Notice("Octosidian: Failed to load repo");
			this.repoView = null;
			this.render();
		}
	}

	async navigateRepoTree(path: string) {
		if (!this.repoView) return;
		const { owner, repo } = this.repoView;
		this.repoView = { ...this.repoView, tree: null, treePath: path, loading: true, fileContent: null, filePath: null };
		this.render();
		try {
			const tree = await getRepoTree(owner, repo, path);
			if (this.repoView?.treePath === path) {
				this.repoView = { ...this.repoView, tree, loading: false };
				this.render();
			}
		} catch {
			this.repoView = { ...this.repoView, tree: [], loading: false };
			this.render();
		}
	}

	async openFileView(path: string, name: string) {
		if (!this.repoView) return;
		const { owner, repo } = this.repoView;
		this.repoView = { ...this.repoView, fileContent: null, filePath: path, loading: true };
		this.render();
		const result = await getFileContent(owner, repo, path);
		if (this.repoView?.filePath === path) {
			this.repoView = { ...this.repoView, fileContent: result?.content ?? "Could not load file.", loading: false };
			this.render();
		}
	}

	closeFileView() {
		if (!this.repoView) return;
		this.repoView = { ...this.repoView, fileContent: null, filePath: null };
		this.render();
	}

	closeRepoView() {
		this.repoView = null;
		this.render();
	}

	getPrTotal(): number {
		if (!this.pullsData) return 0;
		const d = this.pullsData;
		return d.reviewRequested.length + d.authored.length + d.assigned.length + d.mentioned.length;
	}

	getIssueTotal(): number {
		if (!this.issuesData) return 0;
		const d = this.issuesData;
		return d.assigned.length + d.authored.length + d.mentioned.length;
	}

	getReviewTotal(): number {
		return this.pullsData?.reviewRequested.length ?? 0;
	}

	render() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("octo-page");

		if (!getClient()) {
			this.renderEmptyState(container, "Configure your GitHub token in settings to get started.");
			return;
		}

		this.renderTopNav(container);

		const body = container.createDiv({ cls: "octo-body" });

		if (this.detail) {
			this.renderDetailView(body);
			return;
		}

		if (this.repoView) {
			this.renderRepoView(body);
			return;
		}

		if (this.loading && !this.pullsData) {
			this.renderLoading(body);
			return;
		}

		const grid = body.createDiv({ cls: "octo-grid" });

		switch (this.activeTab) {
			case "overview":
				this.renderOverviewPage(grid);
				break;
			case "inbox":
				this.renderInboxPage(grid);
				break;
			case "pulls":
				this.renderPullsPage(grid);
				break;
			case "issues":
				this.renderIssuesPage(grid);
				break;
			case "reviews":
				this.renderReviewsPage(grid);
				break;
		}
	}

	renderTopNav(parent: HTMLElement) {
		const nav = parent.createDiv({ cls: "octo-topnav" });

		const tabs = nav.createDiv({ cls: "octo-topnav-tabs" });
		const unreadCount = this.notifications.filter((n) => n.unread).length;
		const tabDefs: Array<{ id: TopTab; label: string; count: number; icon: string }> = [
			{ id: "overview", label: "Overview", count: 0, icon: ICONS.eye },
			{ id: "inbox", label: "Inbox", count: unreadCount, icon: ICONS.comment },
			{ id: "pulls", label: "Pull Requests", count: this.getPrTotal(), icon: ICONS.prOpen },
			{ id: "issues", label: "Issues", count: this.getIssueTotal(), icon: ICONS.issueOpen },
			{ id: "reviews", label: "Reviews", count: this.getReviewTotal(), icon: ICONS.eye },
		];

		for (const tab of tabDefs) {
			const btn = tabs.createDiv({
				cls: `octo-topnav-tab ${this.activeTab === tab.id ? "octo-topnav-active" : ""}`,
			});
			const iconEl = btn.createSpan({ cls: "octo-topnav-icon" });
			iconEl.innerHTML = tab.icon;
			btn.createSpan({ text: tab.label });
			if (tab.count > 0) {
				btn.createSpan({ cls: "octo-topnav-count", text: String(tab.count) });
			}
			btn.addEventListener("click", () => {
				this.activeTab = tab.id;
				this.activeRole = "all";
				this.searchQuery = "";
				this.detail = null;
				this.repoView = null;
				this.render();
			});
		}

		const right = nav.createDiv({ cls: "octo-topnav-right" });

		if (this.lastFetched > 0) {
			right.createSpan({ cls: "octo-topnav-updated", text: `Updated ${this.timeAgo(new Date(this.lastFetched).toISOString())}` });
		}

		const unreadCountAll = this.getUnreadCount();
		if (unreadCountAll > 0) {
			const markAll = right.createEl("button", {
				cls: "octo-toolbar-btn octo-mark-all",
				text: `Mark all read (${unreadCountAll})`,
				attr: { "aria-label": "Mark all as read" },
			});
			markAll.addEventListener("click", () => this.markAllAsRead());
		}

		const refreshBtn = right.createEl("button", {
			cls: "octo-toolbar-btn clickable-icon",
			attr: { "aria-label": "Refresh" },
		});
		refreshBtn.innerHTML = ICONS.refresh;
		if (this.loading) refreshBtn.addClass("octo-spin");
		refreshBtn.addEventListener("click", () => this.refresh());
	}

	// --- OVERVIEW PAGE ---

	renderOverviewPage(grid: HTMLElement) {
		grid.removeClass("octo-grid");
		grid.addClass("octo-overview");

		const { data: user } = this.getUser();

		const welcome = grid.createDiv({ cls: "octo-overview-welcome" });
		welcome.createEl("h1", { cls: "octo-overview-title", text: `Welcome back${user ? `, ${user}` : ""}` });

		const cards = grid.createDiv({ cls: "octo-overview-cards" });
		const prCard = cards.createDiv({ cls: "octo-stat-card" });
		const prIcon = prCard.createDiv({ cls: "octo-stat-card-icon octo-icon-open" });
		prIcon.innerHTML = ICONS.prOpen;
		const prInfo = prCard.createDiv({ cls: "octo-stat-card-info" });
		prInfo.createDiv({ cls: "octo-stat-card-value", text: String(this.getPrTotal()) });
		prInfo.createDiv({ cls: "octo-stat-card-label", text: "Open Pull Requests" });
		prCard.addEventListener("click", () => { this.activeTab = "pulls"; this.render(); });

		const issueCard = cards.createDiv({ cls: "octo-stat-card" });
		const issueIcon = issueCard.createDiv({ cls: "octo-stat-card-icon octo-icon-open" });
		issueIcon.innerHTML = ICONS.issueOpen;
		const issueInfo = issueCard.createDiv({ cls: "octo-stat-card-info" });
		issueInfo.createDiv({ cls: "octo-stat-card-value", text: String(this.getIssueTotal()) });
		issueInfo.createDiv({ cls: "octo-stat-card-label", text: "Open Issues" });
		issueCard.addEventListener("click", () => { this.activeTab = "issues"; this.render(); });

		const reviewCard = cards.createDiv({ cls: "octo-stat-card" });
		const reviewIcon = reviewCard.createDiv({ cls: "octo-stat-card-icon" });
		reviewIcon.innerHTML = ICONS.eye;
		const reviewInfo = reviewCard.createDiv({ cls: "octo-stat-card-info" });
		reviewInfo.createDiv({ cls: "octo-stat-card-value", text: String(this.getReviewTotal()) });
		reviewInfo.createDiv({ cls: "octo-stat-card-label", text: "Review Requests" });
		reviewCard.addEventListener("click", () => { this.activeTab = "reviews"; this.render(); });

		const recentSection = grid.createDiv({ cls: "octo-overview-recent" });
		recentSection.createEl("h2", { cls: "octo-overview-section-title", text: "Recent Pull Requests" });

		const allPrs = this.getAllPrsSorted().slice(0, 10);
		if (allPrs.length === 0) {
			this.renderEmptyState(recentSection, "No recent pull requests.");
			return;
		}
		const list = recentSection.createDiv({ cls: "octo-pr-list" });
		for (const pr of allPrs) this.renderPrRow(list, pr);
	}

	getUser(): { data: string | null } {
		if (!this.pullsData) return { data: null };
		const authored = this.pullsData.authored;
		if (authored.length > 0 && authored[0].author) return { data: authored[0].author.login };
		return { data: null };
	}

	getAllPrsSorted(): PullSummary[] {
		if (!this.pullsData) return [];
		const d = this.pullsData;
		const seen = new Set<number>();
		const all: PullSummary[] = [];
		for (const list of [d.reviewRequested, d.authored, d.assigned, d.mentioned]) {
			for (const pr of list) {
				if (!seen.has(pr.id)) { seen.add(pr.id); all.push(pr); }
			}
		}
		return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
	}

	// --- INBOX PAGE ---

	renderInboxPage(grid: HTMLElement) {
		grid.removeClass("octo-grid");
		grid.addClass("octo-inbox-page");

		const header = grid.createDiv({ cls: "octo-inbox-header" });
		header.createEl("h1", { cls: "octo-aside-title", text: "Inbox" });

		const filterBar = header.createDiv({ cls: "octo-inbox-filters" });
		const unreadBtn = filterBar.createEl("button", {
			cls: `octo-inbox-filter-btn ${this.inboxFilter === "unread" ? "octo-inbox-filter-active" : ""}`,
			text: "Unread",
		});
		unreadBtn.addEventListener("click", () => { this.inboxFilter = "unread"; this.render(); });
		const allBtn = filterBar.createEl("button", {
			cls: `octo-inbox-filter-btn ${this.inboxFilter === "all" ? "octo-inbox-filter-active" : ""}`,
			text: "All",
		});
		allBtn.addEventListener("click", () => { this.inboxFilter = "all"; this.render(); });

		if (this.notifications.some(n => n.unread)) {
			const markAllBtn = header.createEl("button", { cls: "octo-inbox-action", text: "Mark all as read" });
			markAllBtn.addEventListener("click", async () => {
				markAllBtn.disabled = true; markAllBtn.textContent = "...";
				try {
					await markAllNotificationsRead();
					this.notifications = this.notifications.map(n => ({ ...n, unread: false }));
					this.render();
				} catch { new Notice("Octosidian: Failed to mark all as read"); markAllBtn.disabled = false; markAllBtn.textContent = "Mark all as read"; }
			});
		}

		const filtered = this.inboxFilter === "unread"
			? this.notifications.filter((n) => n.unread)
			: this.notifications;

		if (filtered.length === 0) {
			this.renderEmptyState(grid, this.inboxFilter === "unread" ? "No unread notifications." : "No notifications.");
			return;
		}

		const list = grid.createDiv({ cls: "octo-inbox-list" });
		for (const notif of filtered) {
			this.renderNotificationRow(list, notif);
		}
	}

	renderNotificationRow(parent: HTMLElement, notif: GitHubNotification) {
		const row = parent.createDiv({ cls: `octo-inbox-row ${notif.unread ? "octo-inbox-unread" : ""}` });

		const iconEl = row.createDiv({ cls: "octo-inbox-icon" });
		if (notif.subject.type === "PullRequest") {
			iconEl.innerHTML = ICONS.prOpen;
			iconEl.addClass("octo-icon-open");
		} else if (notif.subject.type === "Issue") {
			iconEl.innerHTML = ICONS.issueOpen;
			iconEl.addClass("octo-icon-open");
		} else {
			iconEl.innerHTML = ICONS.comment;
		}

		const info = row.createDiv({ cls: "octo-inbox-info" });
		const repoLine = info.createDiv({ cls: "octo-inbox-repo" });
		repoLine.createSpan({ text: notif.repository.fullName });
		if (notif.unread) {
			repoLine.createSpan({ cls: "octo-inbox-dot" });
		}
		info.createDiv({ cls: "octo-inbox-title", text: notif.subject.title });
		const metaLine = info.createDiv({ cls: "octo-inbox-meta" });
		metaLine.createSpan({ text: notif.reason });
		metaLine.createSpan({ cls: "octo-dot", text: " · " });
		metaLine.createSpan({ text: this.timeAgo(notif.updatedAt) });

		row.addEventListener("click", () => {
			if (notif.subject.url) {
				const htmlUrl = notif.subject.url
					.replace("api.github.com/repos", "github.com")
					.replace("/pulls/", "/pull/");
				window.open(htmlUrl, "_blank");
			}
		});

		if (notif.unread) {
			const markBtn = row.createEl("button", { cls: "octo-inbox-action", attr: { title: "Mark as read", "aria-label": "Mark as read" } });
			markBtn.textContent = "✓";
			markBtn.addEventListener("click", async (e) => {
				e.stopPropagation();
				markBtn.disabled = true;
				try {
					await markNotificationRead(notif.id);
					this.notifications = this.notifications.map(n => n.id === notif.id ? { ...n, unread: false } : n);
					this.render();
				} catch { new Notice("Octosidian: Failed to mark notification"); markBtn.disabled = false; }
			});
		}
	}

	// --- PULLS PAGE ---

	renderPullsPage(grid: HTMLElement) {
		const aside = grid.createDiv({ cls: "octo-aside" });
		const header = aside.createDiv({ cls: "octo-aside-header" });
		header.createEl("h1", { cls: "octo-aside-title", text: "Pull Requests" });
		header.createEl("p", { cls: "octo-aside-subtitle", text: `${this.getPrTotal()} open pulls across your queues` });

		const nav = aside.createEl("nav", { cls: "octo-role-nav" });
		const roles = this.getPrRoleCounts();
		for (const role of roles) {
			this.renderRoleCard(nav, role);
		}

		const main = grid.createDiv({ cls: "octo-main" });
		this.renderSearchBar(main, "pr");

		const groups = this.getPrGroups();
		let hasAny = false;
		for (const g of groups) {
			if (g.items.length === 0) continue;
			hasAny = true;
			this.renderPrGroup(main, g);
		}
		if (!hasAny) {
			this.renderEmptyState(main, this.searchQuery ? "No results match your search." : "No open pull requests.");
		}
	}

	getPrRoleCounts(): Array<{ id: RoleFilter; label: string; count: number; icon: string }> {
		const d = this.pullsData;
		if (!d) return [];
		return [
			{ id: "review-requested", label: "Review requested", count: d.reviewRequested.length, icon: ICONS.eye },
			{ id: "assigned", label: "Assigned", count: d.assigned.length, icon: ICONS.prOpen },
			{ id: "authored", label: "Authored", count: d.authored.length, icon: ICONS.prOpen },
			{ id: "mentioned", label: "Mentioned", count: d.mentioned.length, icon: ICONS.comment },
			{ id: "involved", label: "Involved", count: d.involved?.length ?? 0, icon: ICONS.prOpen },
		];
	}

	getPrGroups(): Array<{ id: string; label: string; items: PullSummary[] }> {
		if (!this.pullsData) return [];
		const d = this.pullsData;
		const q = this.searchQuery.toLowerCase();
		const textFilter = (items: PullSummary[]) => !q ? items : items.filter(pr =>
			pr.title.toLowerCase().includes(q) || pr.repository.fullName.toLowerCase().includes(q) || (pr.author?.login.toLowerCase().includes(q) ?? false));
		const applyAll = (items: PullSummary[]) => this.applySort(this.applyPrFilters(textFilter(items)));

		if (this.activeRole !== "all") {
			const map: Record<string, PullSummary[]> = { "review-requested": d.reviewRequested, authored: d.authored, assigned: d.assigned, mentioned: d.mentioned, involved: d.involved ?? [] };
			const label = this.activeRole.replace("-", " ");
			return [{ id: this.activeRole, label: label.charAt(0).toUpperCase() + label.slice(1), items: applyAll(map[this.activeRole] ?? []) }];
		}
		return [
			{ id: "review-requested", label: "Review requested", items: applyAll(d.reviewRequested) },
			{ id: "authored", label: "Authored", items: applyAll(d.authored) },
			{ id: "assigned", label: "Assigned", items: applyAll(d.assigned) },
			{ id: "mentioned", label: "Mentioned", items: applyAll(d.mentioned) },
		];
	}

	renderPrGroup(parent: HTMLElement, group: { id: string; label: string; items: PullSummary[] }) {
		const section = parent.createDiv({ cls: "octo-group" });
		const header = section.createDiv({ cls: "octo-group-header" });
		const left = header.createDiv({ cls: "octo-group-header-left" });
		const icon = left.createSpan({ cls: "octo-group-icon" });
		icon.innerHTML = ICONS.prOpen;
		left.createSpan({ text: group.label });
		header.createSpan({ cls: "octo-group-count", text: String(group.items.length) });

		const list = section.createDiv({ cls: "octo-pr-list" });
		for (const pr of group.items) this.renderPrRow(list, pr);
	}

	renderPrRow(parent: HTMLElement, pr: PullSummary) {
		const unread = isUnread(this.plugin.cache, "pr", pr.id, pr.updatedAt);
		const wrapper = parent.createDiv({ cls: "octo-pr-row-wrapper" });
		const row = wrapper.createDiv({ cls: `octo-pr-row${unread ? " octo-row-unread" : ""}` });
		row.addEventListener("click", () => {
			this.openPrDetail(pr.repository.owner, pr.repository.name, pr.number);
		});

		if (unread) row.createDiv({ cls: "octo-row-unread-dot" });

		const { svg, cls } = prStateIcon(pr);
		const iconEl = row.createDiv({ cls: `octo-pr-icon ${cls}` });
		iconEl.innerHTML = svg;

		const info = row.createDiv({ cls: "octo-pr-info" });
		info.createDiv({ cls: "octo-pr-title", text: pr.title });

		const meta = info.createDiv({ cls: "octo-pr-meta" });
		const repoLink = meta.createSpan({ cls: "octo-repo-link", text: pr.repository.fullName });
		repoLink.addEventListener("click", (e) => { e.stopPropagation(); this.openRepoView(pr.repository.owner, pr.repository.name); });
		meta.createSpan({ text: ` #${pr.number}` });
		if (pr.author) {
			meta.createSpan({ cls: "octo-dot", text: " · " });
			const avatar = meta.createEl("img", { cls: "octo-avatar", attr: { src: pr.author.avatarUrl, alt: pr.author.login, width: "14", height: "14" } });
			avatar.addEventListener("error", () => avatar.remove());
			meta.createSpan({ text: ` ${pr.author.login}` });
		}
		meta.createSpan({ cls: "octo-dot", text: " · " });
		meta.createSpan({ text: this.timeAgo(pr.updatedAt) });

		if (pr.labels.length > 0) {
			const labels = info.createDiv({ cls: "octo-pr-labels" });
			for (const label of pr.labels.slice(0, 4)) {
				labels.createSpan({ cls: "octo-label", text: label.name, attr: labelAttrs(label.color) });
			}
		}

		const actions = row.createDiv({ cls: "octo-pr-actions" });

		const previewBtn = actions.createEl("button", { cls: "octo-preview-btn", text: "Preview" });
		previewBtn.addEventListener("click", async (e) => {
			e.stopPropagation();
			const key = pr.id;
			if (this.expandedRows.has(key)) {
				this.expandedRows.delete(key);
				wrapper.querySelector(".octo-expanded")?.remove();
			} else {
				this.expandedRows.add(key);
				const expandedEl = wrapper.createDiv({ cls: "octo-expanded" });
				if (this.expandedCache.has(key)) {
					this.renderExpandedComments(expandedEl, this.expandedCache.get(key) as PullPageData);
				} else {
					expandedEl.createDiv({ cls: "octo-expanded-loading", text: "Loading..." });
					const data = await getPullPageData(pr.repository.owner, pr.repository.name, pr.number);
					expandedEl.empty();
					if (data) { this.expandedCache.set(key, data); this.renderExpandedComments(expandedEl, data); }
					else expandedEl.createDiv({ text: "Could not load comments." });
				}
			}
		});

		if (pr.comments > 0) {
			const c = actions.createSpan({ cls: "octo-comment-count" });
			c.innerHTML = ICONS.comment;
			c.createSpan({ text: ` ${pr.comments}` });
		}
	}

	renderExpandedComments(parent: HTMLElement, data: PullPageData | IssuePageData) {
		const comments = "detail" in data ? (data as PullPageData).comments : (data as IssuePageData).comments;
		const last3 = comments.slice(-3);
		if (last3.length === 0) { parent.createDiv({ cls: "octo-expanded-empty", text: "No comments yet." }); return; }
		const list = parent.createDiv({ cls: "octo-expanded-comments" });
		for (const c of last3) {
			const item = list.createDiv({ cls: "octo-expanded-comment" });
			const header = item.createDiv({ cls: "octo-expanded-comment-header" });
			if (c.author) {
				const avatar = header.createEl("img", { cls: "octo-avatar", attr: { src: c.author.avatarUrl, alt: c.author.login, width: "16", height: "16" } });
				avatar.addEventListener("error", () => avatar.remove());
				header.createSpan({ cls: "octo-expanded-comment-author", text: c.author.login });
			}
			header.createSpan({ cls: "octo-expanded-comment-time", text: this.timeAgo(c.createdAt) });
			const body = c.body.length > 200 ? c.body.slice(0, 200) + "…" : c.body;
			item.createDiv({ cls: "octo-expanded-comment-body", text: body });
		}
	}

	// --- ISSUES PAGE ---

	renderIssuesPage(grid: HTMLElement) {
		const aside = grid.createDiv({ cls: "octo-aside" });
		const header = aside.createDiv({ cls: "octo-aside-header" });
		header.createEl("h1", { cls: "octo-aside-title", text: "Issues" });
		header.createEl("p", { cls: "octo-aside-subtitle", text: `${this.getIssueTotal()} open issues across your repos` });

		const nav = aside.createEl("nav", { cls: "octo-role-nav" });
		const roles = this.getIssueRoleCounts();
		for (const role of roles) this.renderRoleCard(nav, role);

		const main = grid.createDiv({ cls: "octo-main" });
		this.renderSearchBar(main, "issue");

		const groups = this.getIssueGroups();
		let hasAny = false;
		for (const g of groups) {
			if (g.items.length === 0) continue;
			hasAny = true;
			this.renderIssueGroup(main, g);
		}
		if (!hasAny) {
			this.renderEmptyState(main, this.searchQuery ? "No results match your search." : "No open issues.");
		}
	}

	getIssueRoleCounts(): Array<{ id: RoleFilter; label: string; count: number; icon: string }> {
		const d = this.issuesData;
		if (!d) return [];
		return [
			{ id: "assigned", label: "Assigned", count: d.assigned.length, icon: ICONS.issueOpen },
			{ id: "authored", label: "Authored", count: d.authored.length, icon: ICONS.issueOpen },
			{ id: "mentioned", label: "Mentioned", count: d.mentioned.length, icon: ICONS.comment },
		];
	}

	getIssueGroups(): Array<{ id: string; label: string; items: IssueSummary[] }> {
		if (!this.issuesData) return [];
		const d = this.issuesData;
		const q = this.searchQuery.toLowerCase();
		const textFilter = (items: IssueSummary[]) => !q ? items : items.filter(i =>
			i.title.toLowerCase().includes(q) || i.repository.fullName.toLowerCase().includes(q) || (i.author?.login.toLowerCase().includes(q) ?? false));
		const applyAll = (items: IssueSummary[]) => this.applySort(this.applyIssueFilters(textFilter(items)));

		if (this.activeRole !== "all") {
			const map: Record<string, IssueSummary[]> = { assigned: d.assigned, authored: d.authored, mentioned: d.mentioned };
			const label = this.activeRole.replace("-", " ");
			return [{ id: this.activeRole, label: label.charAt(0).toUpperCase() + label.slice(1), items: applyAll(map[this.activeRole] ?? []) }];
		}
		return [
			{ id: "assigned", label: "Assigned", items: applyAll(d.assigned) },
			{ id: "authored", label: "Authored", items: applyAll(d.authored) },
			{ id: "mentioned", label: "Mentioned", items: applyAll(d.mentioned) },
		];
	}

	renderIssueGroup(parent: HTMLElement, group: { id: string; label: string; items: IssueSummary[] }) {
		const section = parent.createDiv({ cls: "octo-group" });
		const header = section.createDiv({ cls: "octo-group-header" });
		const left = header.createDiv({ cls: "octo-group-header-left" });
		const icon = left.createSpan({ cls: "octo-group-icon" });
		icon.innerHTML = ICONS.issueOpen;
		left.createSpan({ text: group.label });
		header.createSpan({ cls: "octo-group-count", text: String(group.items.length) });

		const list = section.createDiv({ cls: "octo-pr-list" });
		for (const issue of group.items) this.renderIssueRow(list, issue);
	}

	renderIssueRow(parent: HTMLElement, issue: IssueSummary) {
		const unread = isUnread(this.plugin.cache, "issue", issue.id, issue.updatedAt);
		const wrapper = parent.createDiv({ cls: "octo-pr-row-wrapper" });
		const row = wrapper.createDiv({ cls: `octo-pr-row${unread ? " octo-row-unread" : ""}` });
		row.addEventListener("click", () => {
			this.openIssueDetail(issue.repository.owner, issue.repository.name, issue.number);
		});

		if (unread) row.createDiv({ cls: "octo-row-unread-dot" });

		const isOpen = issue.state === "open";
		const iconEl = row.createDiv({ cls: `octo-pr-icon ${isOpen ? "octo-icon-open" : "octo-icon-closed"}` });
		iconEl.innerHTML = isOpen ? ICONS.issueOpen : ICONS.issueClosed;

		const info = row.createDiv({ cls: "octo-pr-info" });
		info.createDiv({ cls: "octo-pr-title", text: issue.title });

		const meta = info.createDiv({ cls: "octo-pr-meta" });
		const repoLink = meta.createSpan({ cls: "octo-repo-link", text: issue.repository.fullName });
		repoLink.addEventListener("click", (e) => { e.stopPropagation(); this.openRepoView(issue.repository.owner, issue.repository.name); });
		meta.createSpan({ text: ` #${issue.number}` });
		if (issue.author) {
			meta.createSpan({ cls: "octo-dot", text: " · " });
			const avatar = meta.createEl("img", { cls: "octo-avatar", attr: { src: issue.author.avatarUrl, alt: issue.author.login, width: "14", height: "14" } });
			avatar.addEventListener("error", () => avatar.remove());
			meta.createSpan({ text: ` ${issue.author.login}` });
		}
		meta.createSpan({ cls: "octo-dot", text: " · " });
		meta.createSpan({ text: this.timeAgo(issue.updatedAt) });

		if (issue.labels.length > 0) {
			const labels = info.createDiv({ cls: "octo-pr-labels" });
			for (const label of issue.labels.slice(0, 4)) {
				labels.createSpan({ cls: "octo-label", text: label.name, attr: labelAttrs(label.color) });
			}
		}

		const actions = row.createDiv({ cls: "octo-pr-actions" });
		const previewBtn = actions.createEl("button", { cls: "octo-preview-btn", text: "Preview" });
		previewBtn.addEventListener("click", async (e) => {
			e.stopPropagation();
			const key = issue.id;
			if (this.expandedRows.has(key)) {
				this.expandedRows.delete(key);
				wrapper.querySelector(".octo-expanded")?.remove();
			} else {
				this.expandedRows.add(key);
				const expandedEl = wrapper.createDiv({ cls: "octo-expanded" });
				if (this.expandedCache.has(key)) {
					this.renderExpandedComments(expandedEl, this.expandedCache.get(key) as IssuePageData);
				} else {
					expandedEl.createDiv({ cls: "octo-expanded-loading", text: "Loading..." });
					const data = await getIssuePageData(issue.repository.owner, issue.repository.name, issue.number);
					expandedEl.empty();
					if (data) { this.expandedCache.set(key, data); this.renderExpandedComments(expandedEl, data); }
					else expandedEl.createDiv({ text: "Could not load comments." });
				}
			}
		});

		if (issue.comments > 0) {
			const c = actions.createSpan({ cls: "octo-comment-count" });
			c.innerHTML = ICONS.comment;
			c.createSpan({ text: ` ${issue.comments}` });
		}
	}

	// --- REVIEWS PAGE ---

	renderReviewsPage(grid: HTMLElement) {
		const aside = grid.createDiv({ cls: "octo-aside" });
		const header = aside.createDiv({ cls: "octo-aside-header" });
		header.createEl("h1", { cls: "octo-aside-title", text: "Reviews" });
		header.createEl("p", { cls: "octo-aside-subtitle", text: `${this.getReviewTotal()} pending review requests` });

		const main = grid.createDiv({ cls: "octo-main" });
		this.renderSearchBar(main);

		const items = this.pullsData?.reviewRequested ?? [];
		const q = this.searchQuery.toLowerCase();
		const filtered = !q ? items : items.filter(pr =>
			pr.title.toLowerCase().includes(q) || pr.repository.fullName.toLowerCase().includes(q));

		if (filtered.length === 0) {
			this.renderEmptyState(main, this.searchQuery ? "No results match your search." : "No pending reviews.");
			return;
		}

		const list = main.createDiv({ cls: "octo-pr-list" });
		for (const pr of filtered) this.renderPrRow(list, pr);
	}

	// --- DETAIL VIEW ---

	renderDetailView(container: HTMLElement) {
		const d = this.detail!;
		const wrapper = container.createDiv({ cls: "octo-detail" });

		const topbar = wrapper.createDiv({ cls: "octo-detail-topbar" });
		const backBtn = topbar.createDiv({ cls: "octo-detail-back" });
		backBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
		backBtn.createSpan({ text: " Back" });
		backBtn.addEventListener("click", () => this.closeDetail());

		const breadcrumb = topbar.createDiv({ cls: "octo-detail-breadcrumb" });
		breadcrumb.createSpan({ text: `${d.owner}/${d.repo}` });
		breadcrumb.createSpan({ cls: "octo-dot", text: " / " });
		breadcrumb.createSpan({ text: `#${d.number}` });

		const openGh = topbar.createDiv({ cls: "octo-detail-open-gh" });
		openGh.createSpan({ text: "Open in GitHub" });
		openGh.addEventListener("click", () => {
			const path = d.type === "pr" ? "pull" : "issues";
			window.open(`https://github.com/${d.owner}/${d.repo}/${path}/${d.number}`, "_blank");
		});

		if (d.loading) {
			this.renderLoading(wrapper);
			return;
		}

		if (d.type === "pr" && d.data?.detail) {
			this.renderPrDetail(wrapper, d.data, this.prChecks);
		} else if (d.type === "issue" && d.data?.detail) {
			this.renderIssueDetail(wrapper, d.data);
		} else {
			this.renderEmptyState(wrapper, "Could not load details.");
		}
	}

	renderPrDetail(parent: HTMLElement, data: PullPageData, checks?: CheckRun[]) {
		const pr = data.detail!;

		const topbarActions = parent.querySelector(".octo-detail-topbar");
		if (topbarActions) {
			const actionsGroup = topbarActions.createDiv({ cls: "octo-detail-actions" });

			const stateBtn = actionsGroup.createEl("button", {
				cls: "octo-action-btn",
				text: pr.state === "open" ? "Close PR" : "Reopen PR",
			});
			stateBtn.addEventListener("click", async () => {
				stateBtn.disabled = true;
				stateBtn.textContent = "...";
				try {
					await updatePullState(this.detail!.owner, this.detail!.repo, pr.number, pr.state === "open" ? "closed" : "open");
					await this.openPrDetail(this.detail!.owner, this.detail!.repo, pr.number);
				} catch { new Notice("Octosidian: Failed to update PR state"); stateBtn.disabled = false; stateBtn.textContent = pr.state === "open" ? "Close PR" : "Reopen PR"; }
			});

			if (pr.state === "open" && !pr.isDraft) {
				const mergeWrapper = actionsGroup.createDiv({ cls: "octo-merge-wrapper" });
				const mergeBtn = mergeWrapper.createEl("button", { cls: "octo-action-btn octo-action-btn-primary", text: "Merge" });
				const mergeArrow = mergeWrapper.createEl("button", { cls: "octo-action-btn octo-action-btn-primary octo-merge-arrow", text: "▾" });
				const mergeDropdown = mergeWrapper.createDiv({ cls: "octo-merge-dropdown octo-hidden" });
				const methods: Array<{ val: "merge" | "squash" | "rebase"; label: string }> = [
					{ val: "merge", label: "Merge commit" },
					{ val: "squash", label: "Squash and merge" },
					{ val: "rebase", label: "Rebase and merge" },
				];
				let selectedMethod: "merge" | "squash" | "rebase" = "merge";
				for (const m of methods) {
					const opt = mergeDropdown.createDiv({ cls: "octo-sort-option", text: m.label });
					opt.addEventListener("click", (e) => { e.stopPropagation(); selectedMethod = m.val; mergeBtn.textContent = m.label; mergeDropdown.addClass("octo-hidden"); });
				}
				mergeArrow.addEventListener("click", (e) => { e.stopPropagation(); mergeDropdown.toggleClass("octo-hidden", !mergeDropdown.hasClass("octo-hidden")); });
				mergeBtn.addEventListener("click", async () => {
					mergeBtn.disabled = true; mergeBtn.textContent = "Merging...";
					try {
						await mergePullRequest(this.detail!.owner, this.detail!.repo, pr.number, selectedMethod);
						await this.openPrDetail(this.detail!.owner, this.detail!.repo, pr.number);
					} catch { new Notice("Octosidian: Failed to merge PR"); mergeBtn.disabled = false; mergeBtn.textContent = "Merge"; }
				});
			}
		}

		const content = parent.createDiv({ cls: "octo-detail-content" });

		const titleSection = content.createDiv({ cls: "octo-detail-title-section" });
		const titleRow = titleSection.createDiv({ cls: "octo-detail-title-row" });
		const { svg, cls } = prStateIcon(pr);
		const iconEl = titleRow.createSpan({ cls: `octo-detail-state-icon ${cls}` });
		iconEl.innerHTML = svg;
		titleRow.createEl("h1", { cls: "octo-detail-title", text: pr.title });
		titleSection.createDiv({ cls: "octo-detail-number", text: `#${pr.number}` });

		const stats = content.createDiv({ cls: "octo-detail-stats" });
		stats.createSpan({ cls: "octo-stat octo-stat-add", text: `+${pr.additions}` });
		stats.createSpan({ cls: "octo-stat octo-stat-del", text: `-${pr.deletions}` });
		stats.createSpan({ cls: "octo-stat", text: `${pr.changedFiles} files` });
		stats.createSpan({ cls: "octo-stat", text: `${pr.commits} commits` });
		const branchInfo = stats.createSpan({ cls: "octo-branch-info" });
		branchInfo.createSpan({ cls: "octo-branch", text: pr.headRefName });
		branchInfo.createSpan({ text: " → " });
		branchInfo.createSpan({ cls: "octo-branch", text: pr.baseRefName });

		if (pr.labels.length > 0) {
			const labels = content.createDiv({ cls: "octo-detail-labels" });
			for (const label of pr.labels) {
				labels.createSpan({ cls: "octo-label", text: label.name, attr: labelAttrs(label.color) });
			}
		}

		if (pr.requestedReviewers.length > 0) {
			const reviewers = content.createDiv({ cls: "octo-detail-assignees" });
			reviewers.createSpan({ cls: "octo-detail-section-label", text: "Reviewers: " });
			for (const r of pr.requestedReviewers) {
				const avatar = reviewers.createEl("img", { cls: "octo-avatar", attr: { src: r.avatarUrl, alt: r.login, width: "14", height: "14" } });
				avatar.addEventListener("error", () => avatar.remove());
				reviewers.createSpan({ text: ` ${r.login} ` });
			}
		}

		if (pr.body) {
			const bodyContainer = content.createDiv({ cls: "octo-detail-body" });
			MarkdownRenderer.render(this.app, pr.body, bodyContainer, "", this);
		}

		if (checks && checks.length > 0) {
			const checksSection = content.createDiv({ cls: "octo-checks" });
			const passed = checks.filter(c => c.conclusion === "success").length;
			checksSection.createDiv({ cls: "octo-detail-section-title", text: `Checks — ${passed} of ${checks.length} passed` });
			for (const check of checks) {
				const row = checksSection.createDiv({ cls: "octo-check-row" });
				const iconEl = row.createSpan({ cls: "octo-check-icon" });
				if (check.conclusion === "success") { iconEl.textContent = "✓"; iconEl.addClass("octo-check-pass"); }
				else if (check.status !== "completed") { iconEl.textContent = "◌"; iconEl.addClass("octo-check-pending"); }
				else { iconEl.textContent = "✗"; iconEl.addClass("octo-check-fail"); }
				row.createSpan({ text: check.name });
				if (check.conclusion) row.createSpan({ cls: "octo-check-conclusion", text: check.conclusion });
			}
		}

		if (data.comments.length > 0) {
			const commentsSection = content.createDiv({ cls: "octo-detail-comments" });
			commentsSection.createDiv({ cls: "octo-detail-section-title", text: `Comments (${data.comments.length})` });
			for (const comment of data.comments) {
				const c = commentsSection.createDiv({ cls: "octo-comment" });
				const cHeader = c.createDiv({ cls: "octo-comment-header" });
				if (comment.author) {
					const avatar = cHeader.createEl("img", { cls: "octo-comment-avatar", attr: { src: comment.author.avatarUrl, alt: comment.author.login, width: "20", height: "20" } });
					avatar.addEventListener("error", () => avatar.remove());
					cHeader.createSpan({ cls: "octo-comment-author", text: comment.author.login });
				}
				cHeader.createSpan({ cls: "octo-comment-time", text: this.timeAgo(comment.createdAt) });
				const cBody = c.createDiv({ cls: "octo-comment-body" });
				MarkdownRenderer.render(this.app, comment.body, cBody, "", this);
				this.renderReactions(c, comment);
			}
		}

		const commentForm = content.createDiv({ cls: "octo-comment-form" });
		const textarea = commentForm.createEl("textarea", { cls: "octo-comment-textarea", attr: { placeholder: "Leave a comment..." } });
		const submitBtn = commentForm.createEl("button", { cls: "octo-comment-submit", text: "Comment" });
		submitBtn.addEventListener("click", async () => {
			const body = textarea.value.trim();
			if (!body) return;
			submitBtn.disabled = true; submitBtn.textContent = "Sending...";
			try {
				await createComment(this.detail!.owner, this.detail!.repo, pr.number, body);
				await this.openPrDetail(this.detail!.owner, this.detail!.repo, pr.number);
			} catch { new Notice("Octosidian: Failed to post comment"); submitBtn.disabled = false; submitBtn.textContent = "Comment"; }
		});
	}

	renderIssueDetail(parent: HTMLElement, data: IssuePageData) {
		const issue = data.detail!;

		const topbarActions = parent.querySelector(".octo-detail-topbar");
		if (topbarActions) {
			const actionsGroup = topbarActions.createDiv({ cls: "octo-detail-actions" });
			const stateBtn = actionsGroup.createEl("button", {
				cls: "octo-action-btn",
				text: issue.state === "open" ? "Close issue" : "Reopen issue",
			});
			stateBtn.addEventListener("click", async () => {
				stateBtn.disabled = true; stateBtn.textContent = "...";
				try {
					await updateIssueState(this.detail!.owner, this.detail!.repo, issue.number, issue.state === "open" ? "closed" : "open");
					await this.openIssueDetail(this.detail!.owner, this.detail!.repo, issue.number);
				} catch { new Notice("Octosidian: Failed to update issue state"); stateBtn.disabled = false; stateBtn.textContent = issue.state === "open" ? "Close issue" : "Reopen issue"; }
			});
		}

		const content = parent.createDiv({ cls: "octo-detail-content" });

		const titleSection = content.createDiv({ cls: "octo-detail-title-section" });
		const titleRow = titleSection.createDiv({ cls: "octo-detail-title-row" });
		const isOpen = issue.state === "open";
		const iconEl = titleRow.createSpan({ cls: `octo-detail-state-icon ${isOpen ? "octo-icon-open" : "octo-icon-closed"}` });
		iconEl.innerHTML = isOpen ? ICONS.issueOpen : ICONS.issueClosed;
		titleRow.createEl("h1", { cls: "octo-detail-title", text: issue.title });
		titleSection.createDiv({ cls: "octo-detail-number", text: `#${issue.number}` });

		if (issue.labels.length > 0) {
			const labels = content.createDiv({ cls: "octo-detail-labels" });
			for (const label of issue.labels) {
				labels.createSpan({ cls: "octo-label", text: label.name, attr: labelAttrs(label.color) });
			}
		}

		if (issue.assignees.length > 0) {
			const assignees = content.createDiv({ cls: "octo-detail-assignees" });
			assignees.createSpan({ cls: "octo-detail-section-label", text: "Assignees: " });
			for (const a of issue.assignees) {
				const avatar = assignees.createEl("img", { cls: "octo-avatar", attr: { src: a.avatarUrl, alt: a.login, width: "14", height: "14" } });
				avatar.addEventListener("error", () => avatar.remove());
				assignees.createSpan({ text: ` ${a.login} ` });
			}
		}

		if (issue.body) {
			const bodyContainer = content.createDiv({ cls: "octo-detail-body" });
			MarkdownRenderer.render(this.app, issue.body, bodyContainer, "", this);
		}

		if (data.comments.length > 0) {
			const commentsSection = content.createDiv({ cls: "octo-detail-comments" });
			commentsSection.createDiv({ cls: "octo-detail-section-title", text: `Comments (${data.comments.length})` });
			for (const comment of data.comments) {
				const c = commentsSection.createDiv({ cls: "octo-comment" });
				const cHeader = c.createDiv({ cls: "octo-comment-header" });
				if (comment.author) {
					const avatar = cHeader.createEl("img", { cls: "octo-comment-avatar", attr: { src: comment.author.avatarUrl, alt: comment.author.login, width: "20", height: "20" } });
					avatar.addEventListener("error", () => avatar.remove());
					cHeader.createSpan({ cls: "octo-comment-author", text: comment.author.login });
				}
				cHeader.createSpan({ cls: "octo-comment-time", text: this.timeAgo(comment.createdAt) });
				const cBody = c.createDiv({ cls: "octo-comment-body" });
				MarkdownRenderer.render(this.app, comment.body, cBody, "", this);
				this.renderReactions(c, comment);
			}
		}

		const commentForm = content.createDiv({ cls: "octo-comment-form" });
		const textarea = commentForm.createEl("textarea", { cls: "octo-comment-textarea", attr: { placeholder: "Leave a comment..." } });
		const submitBtn = commentForm.createEl("button", { cls: "octo-comment-submit", text: "Comment" });
		submitBtn.addEventListener("click", async () => {
			const body = textarea.value.trim();
			if (!body) return;
			submitBtn.disabled = true; submitBtn.textContent = "Sending...";
			try {
				await createComment(this.detail!.owner, this.detail!.repo, issue.number, body);
				await this.openIssueDetail(this.detail!.owner, this.detail!.repo, issue.number);
			} catch { new Notice("Octosidian: Failed to post comment"); submitBtn.disabled = false; submitBtn.textContent = "Comment"; }
		});
	}

	// --- REPO VIEW ---

	renderRepoView(parent: HTMLElement) {
		const rv = this.repoView!;
		const wrapper = parent.createDiv({ cls: "octo-repo" });

		const topbar = wrapper.createDiv({ cls: "octo-detail-topbar" });
		const backBtn = topbar.createDiv({ cls: "octo-detail-back" });
		backBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
		backBtn.createSpan({ text: " Back" });
		backBtn.addEventListener("click", () => this.closeRepoView());

		const repoName = topbar.createDiv({ cls: "octo-repo-header-name" });
		repoName.createSpan({ cls: "octo-repo-owner", text: rv.owner });
		repoName.createSpan({ text: " / " });
		repoName.createSpan({ cls: "octo-repo-name-bold", text: rv.repo });

		const openGh = topbar.createDiv({ cls: "octo-detail-open-gh" });
		openGh.createSpan({ text: "Open in GitHub" });
		openGh.addEventListener("click", () => window.open(`https://github.com/${rv.owner}/${rv.repo}`, "_blank"));

		if (rv.loading && !rv.tree) {
			this.renderLoading(wrapper);
			return;
		}

		const isBrowsing = rv.treePath !== "" || rv.filePath !== null;

		if (isBrowsing) {
			this.renderRepoBrowserLayout(wrapper, rv);
		} else {
			this.renderRepoLandingLayout(wrapper, rv);
		}
	}

	renderRepoBrowserLayout(wrapper: HTMLElement, rv: RepoViewState) {
		const grid = wrapper.createDiv({ cls: "octo-repo-browser-grid" });

		// LEFT: File tree sidebar
		const treeSide = grid.createDiv({ cls: "octo-repo-tree-side" });
		const treeHeader = treeSide.createDiv({ cls: "octo-tree-header" });
		treeHeader.createSpan({ cls: "octo-tree-header-title", text: "Files" });

		if (rv.treePath) {
			const homeBtn = treeHeader.createSpan({ cls: "octo-tree-home", text: "← Root" });
			homeBtn.addEventListener("click", () => this.navigateRepoTree(""));
		}

		if (rv.tree && rv.tree.length > 0) {
			const list = treeSide.createDiv({ cls: "octo-file-list" });
			if (rv.treePath) {
				const upRow = list.createDiv({ cls: "octo-file-row octo-file-up" });
				upRow.createSpan({ text: "../" });
				upRow.addEventListener("click", () => {
					const parent = rv.treePath.split("/").slice(0, -1).join("/");
					this.navigateRepoTree(parent);
				});
			}
			for (const item of rv.tree) {
				const fileRow = list.createDiv({ cls: `octo-file-row ${rv.filePath === item.path ? "octo-file-active" : ""}` });
				const icon = fileRow.createSpan({ cls: "octo-file-icon" });
				icon.innerHTML = item.type === "dir"
					? `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"></path></svg>`
					: `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"></path></svg>`;
				fileRow.createSpan({ cls: `octo-file-name ${item.type === "dir" ? "octo-file-dir" : ""}`, text: item.name });
				if (item.type === "dir") {
					fileRow.addEventListener("click", () => this.navigateRepoTree(item.path));
				} else {
					fileRow.addEventListener("click", () => this.openFileView(item.path, item.name));
				}
			}
		}

		// RIGHT: Main content
		const mainSide = grid.createDiv({ cls: "octo-repo-content-side" });

		const breadcrumb = mainSide.createDiv({ cls: "octo-repo-breadcrumb" });
		const rootLink = breadcrumb.createSpan({ cls: "octo-repo-link", text: rv.repo });
		rootLink.addEventListener("click", () => this.navigateRepoTree(""));
		const breadcrumbPath = rv.filePath ?? rv.treePath;
		if (breadcrumbPath) {
			const parts = breadcrumbPath.split("/");
			for (let i = 0; i < parts.length; i++) {
				breadcrumb.createSpan({ text: " / " });
				const partPath = parts.slice(0, i + 1).join("/");
				if (i < parts.length - 1) {
					const link = breadcrumb.createSpan({ cls: "octo-repo-link", text: parts[i] });
					link.addEventListener("click", () => this.navigateRepoTree(partPath));
				} else {
					breadcrumb.createSpan({ cls: "octo-repo-name-bold", text: parts[i] });
				}
			}
		}

		if (rv.loading) {
			mainSide.createDiv({ cls: "octo-empty-state", text: "Loading..." });
		} else if (rv.fileContent !== null && rv.filePath) {
			this.renderFileContent(mainSide, rv.filePath, rv.fileContent);
		} else {
			mainSide.createDiv({ cls: "octo-empty-state", text: "Select a file to view" });
		}
	}

	renderRepoLandingLayout(wrapper: HTMLElement, rv: RepoViewState) {
		const grid = wrapper.createDiv({ cls: "octo-repo-grid" });
		const mainCol = grid.createDiv({ cls: "octo-repo-main" });

		if (rv.tree && rv.tree.length > 0) {
			const fileTable = mainCol.createDiv({ cls: "octo-file-tree" });
			for (const item of rv.tree) {
				const fileRow = fileTable.createDiv({ cls: "octo-file-row" });
				const icon = fileRow.createSpan({ cls: "octo-file-icon" });
				icon.innerHTML = item.type === "dir"
					? `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z"></path></svg>`
					: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"></path></svg>`;
				fileRow.createSpan({ cls: `octo-file-name ${item.type === "dir" ? "octo-file-dir" : ""}`, text: item.name });
				if (item.type === "dir") {
					fileRow.addEventListener("click", () => this.navigateRepoTree(item.path));
				} else {
					fileRow.style.cursor = "pointer";
					fileRow.addEventListener("click", () => this.openFileView(item.path, item.name));
				}
			}
		}

		if (rv.readme) {
			const readmeSection = mainCol.createDiv({ cls: "octo-repo-readme" });
			readmeSection.createDiv({ cls: "octo-repo-readme-header", text: "README.md" });
			const readmeBody = readmeSection.createDiv({ cls: "octo-detail-body octo-readme-body" });
			MarkdownRenderer.render(this.app, rv.readme, readmeBody, "", this);
		}

		const sideCol = grid.createDiv({ cls: "octo-repo-side" });

		if (rv.overview) {
			const about = sideCol.createDiv({ cls: "octo-repo-about" });
			about.createDiv({ cls: "octo-repo-section-title", text: "About" });
			if (rv.overview.description) about.createDiv({ cls: "octo-repo-desc", text: rv.overview.description });
			const stats = about.createDiv({ cls: "octo-repo-stats" });
			stats.createSpan({ cls: "octo-repo-stat", text: `${rv.overview.stars} Stars` });
			stats.createSpan({ cls: "octo-repo-stat", text: `${rv.overview.forks} Forks` });
			stats.createSpan({ cls: "octo-repo-stat", text: `${rv.overview.watchers} Watchers` });
			if (rv.overview.language) stats.createSpan({ cls: "octo-repo-stat", text: rv.overview.language });
			if (rv.overview.license) stats.createSpan({ cls: "octo-repo-stat", text: rv.overview.license });
		}

		if (rv.recentPrs.length > 0) {
			const prSection = sideCol.createDiv({ cls: "octo-repo-sidebar-section" });
			prSection.createDiv({ cls: "octo-repo-section-title", text: `Pull Requests ${rv.recentPrs.length}` });
			for (const pr of rv.recentPrs) {
				const row = prSection.createDiv({ cls: "octo-repo-sidebar-row" });
				const iconEl = row.createSpan({ cls: "octo-icon-open" });
				iconEl.innerHTML = ICONS.prOpen;
				row.createSpan({ cls: "octo-repo-sidebar-title", text: pr.title });
				row.addEventListener("click", () => this.openPrDetail(rv.owner, rv.repo, pr.number));
			}
		}

		if (rv.recentIssues.length > 0) {
			const issueSection = sideCol.createDiv({ cls: "octo-repo-sidebar-section" });
			issueSection.createDiv({ cls: "octo-repo-section-title", text: `Issues ${rv.recentIssues.length}` });
			for (const issue of rv.recentIssues) {
				const row = issueSection.createDiv({ cls: "octo-repo-sidebar-row" });
				const iconEl = row.createSpan({ cls: "octo-icon-open" });
				iconEl.innerHTML = ICONS.issueOpen;
				row.createSpan({ cls: "octo-repo-sidebar-title", text: issue.title });
				row.addEventListener("click", () => this.openIssueDetail(rv.owner, rv.repo, issue.number));
			}
		}
	}

	renderFileContent(parent: HTMLElement, filePath: string, content: string) {
		const container = parent.createDiv({ cls: "octo-file-viewer" });

		const header = container.createDiv({ cls: "octo-file-viewer-header" });
		header.createSpan({ cls: "octo-file-viewer-path", text: filePath });

		const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
		const mdExtensions = ["md", "mdx", "markdown"];
		const isMarkdown = mdExtensions.includes(ext);
		const codeBody = container.createDiv({
			cls: `octo-file-viewer-body ${isMarkdown ? "octo-file-viewer-md" : "octo-file-viewer-code"}`,
		});

		if (isMarkdown) {
			MarkdownRenderer.render(this.app, content, codeBody, "", this);
		} else {
			const lang = getLangFromExt(ext);
			const fenced = "```" + lang + "\n" + content + "\n```";
			MarkdownRenderer.render(this.app, fenced, codeBody, "", this);
		}
	}

	// --- SHARED ---

	renderRoleCard(nav: HTMLElement, role: { id: RoleFilter; label: string; count: number; icon: string }) {
		const isActive = this.activeRole === role.id;
		const isEmpty = role.count === 0;
		const card = nav.createDiv({
			cls: `octo-role-card ${isActive ? "octo-role-active" : ""} ${isEmpty ? "octo-role-empty" : ""}`,
		});
		card.addEventListener("click", () => {
			if (isEmpty) return;
			this.activeRole = this.activeRole === role.id ? "all" : role.id;
			this.render();
		});
		const left = card.createDiv({ cls: "octo-role-left" });
		const iconEl = left.createSpan({ cls: "octo-role-icon" });
		iconEl.innerHTML = role.icon;
		left.createSpan({ cls: "octo-role-label", text: role.label });
		card.createSpan({ cls: "octo-role-count", text: String(role.count) });
	}

	renderSearchBar(parent: HTMLElement, mode: "pr" | "issue" = "pr") {
		const toolbar = parent.createDiv({ cls: "octo-toolbar" });
		const row = toolbar.createDiv({ cls: "octo-search-row" });

		const searchBox = row.createDiv({ cls: "octo-search-box" });
		const searchIcon = searchBox.createSpan({ cls: "octo-search-icon" });
		searchIcon.innerHTML = ICONS.search;
		const input = searchBox.createEl("input", {
			cls: "octo-search-input",
			attr: { type: "text", placeholder: "Search by title, author, repo..." },
		});
		input.value = this.searchQuery;
		input.addEventListener("input", (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value;
			this.render();
			const newInput = this.containerEl.querySelector(".octo-search-input") as HTMLInputElement;
			if (newInput) { newInput.focus(); newInput.setSelectionRange(this.searchQuery.length, this.searchQuery.length); }
		});

		const sortBtn = row.createEl("button", { cls: "octo-sort-btn", attr: { "aria-label": "Sort" } });
		const sortLabels: Record<string, string> = { updated: "Recently updated", newest: "Newest", oldest: "Oldest", comments: "Most comments" };
		sortBtn.textContent = sortLabels[this.sortBy];

		const sortDropdown = row.createDiv({ cls: "octo-sort-dropdown octo-hidden" });
		const sortOptions: Array<{ val: typeof this.sortBy; label: string }> = [
			{ val: "updated", label: "Recently updated" },
			{ val: "newest", label: "Newest" },
			{ val: "oldest", label: "Oldest" },
			{ val: "comments", label: "Most comments" },
		];
		for (const opt of sortOptions) {
			const optEl = sortDropdown.createDiv({ cls: `octo-sort-option ${this.sortBy === opt.val ? "octo-sort-option-active" : ""}`, text: opt.label });
			optEl.addEventListener("click", (e) => {
				e.stopPropagation();
				this.sortBy = opt.val;
				sortDropdown.addClass("octo-hidden");
				this.render();
			});
		}
		sortBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			sortDropdown.toggleClass("octo-hidden", !sortDropdown.hasClass("octo-hidden"));
		});
		document.addEventListener("click", () => sortDropdown.addClass("octo-hidden"), { once: true });

		const allItems = mode === "pr" ? this.getAllPrItems() : this.getAllIssueItems();
		const uniqueRepos = [...new Set(allItems.map(i => i.repository.fullName))].sort();

		const filterRow = toolbar.createDiv({ cls: "octo-filter-row" });

		if (uniqueRepos.length > 1) {
			const repoSelect = filterRow.createEl("select", { cls: "octo-sort-btn octo-repo-select" });
			repoSelect.createEl("option", { value: "", text: "All repos" });
			for (const repo of uniqueRepos) {
				const opt = repoSelect.createEl("option", { value: repo, text: repo });
				if (this.repoFilter === repo) opt.selected = true;
			}
			repoSelect.addEventListener("change", () => {
				this.repoFilter = repoSelect.value || null;
				this.render();
			});
		}

		const statuses: Array<{ val: typeof this.statusFilter; label: string }> = mode === "pr"
			? [{ val: "open", label: "Open" }, { val: "draft", label: "Draft" }, { val: "merged", label: "Merged" }, { val: "closed", label: "Closed" }]
			: [{ val: "open", label: "Open" }, { val: "closed", label: "Closed" }];

		for (const s of statuses) {
			const pill = filterRow.createEl("button", { cls: `octo-filter-pill ${this.statusFilter === s.val ? "octo-filter-pill-active" : ""}`, text: s.label });
			pill.addEventListener("click", () => {
				this.statusFilter = this.statusFilter === s.val ? "all" : s.val;
				this.render();
			});
		}

		const hasFilters = this.repoFilter !== null || this.statusFilter !== "all";
		if (hasFilters) {
			const clearAll = filterRow.createEl("button", { cls: "octo-filter-clear", text: "Clear all" });
			clearAll.addEventListener("click", () => {
				this.repoFilter = null;
				this.statusFilter = "all";
				this.render();
			});
		}
	}

	getAllPrItems(): PullSummary[] {
		if (!this.pullsData) return [];
		const d = this.pullsData;
		const seen = new Set<number>();
		const all: PullSummary[] = [];
		for (const list of [d.reviewRequested, d.authored, d.assigned, d.mentioned]) {
			for (const pr of list) {
				if (!seen.has(pr.id)) { seen.add(pr.id); all.push(pr); }
			}
		}
		return all;
	}

	getAllIssueItems(): IssueSummary[] {
		if (!this.issuesData) return [];
		const d = this.issuesData;
		const seen = new Set<number>();
		const all: IssueSummary[] = [];
		for (const list of [d.assigned, d.authored, d.mentioned]) {
			for (const i of list) {
				if (!seen.has(i.id)) { seen.add(i.id); all.push(i); }
			}
		}
		return all;
	}

	applySort<T extends { updatedAt: string; createdAt: string; comments: number }>(items: T[]): T[] {
		const sorted = [...items];
		switch (this.sortBy) {
			case "updated": sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()); break;
			case "newest": sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
			case "oldest": sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
			case "comments": sorted.sort((a, b) => b.comments - a.comments); break;
		}
		return sorted;
	}

	applyPrFilters(items: PullSummary[]): PullSummary[] {
		return items.filter(pr => {
			if (this.repoFilter && pr.repository.fullName !== this.repoFilter) return false;
			if (this.statusFilter === "draft" && !pr.isDraft) return false;
			if (this.statusFilter === "merged" && !pr.mergedAt) return false;
			if (this.statusFilter === "closed" && pr.state !== "closed") return false;
			if (this.statusFilter === "open" && (pr.state !== "open" || pr.isDraft || pr.mergedAt)) return false;
			return true;
		});
	}

	applyIssueFilters(items: IssueSummary[]): IssueSummary[] {
		return items.filter(i => {
			if (this.repoFilter && i.repository.fullName !== this.repoFilter) return false;
			if (this.statusFilter === "open" && i.state !== "open") return false;
			if (this.statusFilter === "closed" && i.state !== "closed") return false;
			return true;
		});
	}

	renderLoading(parent: HTMLElement) {
		const grid = parent.createDiv({ cls: "octo-grid" });
		const aside = grid.createDiv({ cls: "octo-aside" });
		aside.createDiv({ cls: "octo-skeleton-block octo-skeleton-lg" });
		for (let i = 0; i < 5; i++) aside.createDiv({ cls: "octo-skeleton-block octo-skeleton-card" });
		const main = grid.createDiv({ cls: "octo-main" });
		main.createDiv({ cls: "octo-skeleton-block octo-skeleton-search" });
		for (let i = 0; i < 8; i++) main.createDiv({ cls: "octo-skeleton-block octo-skeleton-row" });
	}

	renderEmptyState(parent: HTMLElement, message: string) {
		const empty = parent.createDiv({ cls: "octo-empty-state" });
		const iconEl = empty.createDiv({ cls: "octo-empty-icon" });
		iconEl.innerHTML = ICONS.prOpen;
		empty.createDiv({ cls: "octo-empty-text", text: message });
	}

	markSeenByNumber(kind: "pr" | "issue", owner: string, repo: string, num: number) {
		const list = kind === "pr" ? this.pullsData : this.issuesData;
		if (!list) return;
		const items = kind === "pr"
			? [...(list as MyPullsResult).reviewRequested, ...(list as MyPullsResult).authored, ...(list as MyPullsResult).assigned, ...(list as MyPullsResult).mentioned, ...((list as MyPullsResult).involved ?? [])]
			: [...(list as MyIssuesResult).assigned, ...(list as MyIssuesResult).authored, ...(list as MyIssuesResult).mentioned];
		const hit = items.find((i) => i.number === num && i.repository.owner === owner && i.repository.name === repo);
		if (hit) {
			this.plugin.cache.lastSeen[seenKey(kind, hit.id)] = Date.now();
			this.plugin.saveCache();
		}
	}

	getUnreadCount(): number {
		let n = 0;
		const p = this.pullsData;
		if (p) {
			for (const list of [p.reviewRequested, p.authored, p.assigned, p.mentioned, p.involved ?? []]) {
				for (const pr of list) if (isUnread(this.plugin.cache, "pr", pr.id, pr.updatedAt)) n++;
			}
		}
		const i = this.issuesData;
		if (i) {
			for (const list of [i.assigned, i.authored, i.mentioned]) {
				for (const is of list) if (isUnread(this.plugin.cache, "issue", is.id, is.updatedAt)) n++;
			}
		}
		return n;
	}

	markAllAsRead() {
		const now = Date.now();
		const p = this.pullsData;
		if (p) {
			for (const list of [p.reviewRequested, p.authored, p.assigned, p.mentioned, p.involved ?? []]) {
				for (const pr of list) this.plugin.cache.lastSeen[seenKey("pr", pr.id)] = now;
			}
		}
		const i = this.issuesData;
		if (i) {
			for (const list of [i.assigned, i.authored, i.mentioned]) {
				for (const is of list) this.plugin.cache.lastSeen[seenKey("issue", is.id)] = now;
			}
		}
		this.plugin.saveCache();
		this.render();
	}

	renderReactions(parent: HTMLElement, comment: PullComment | IssueComment) {
		if (!comment.reactions?.total) return;
		const EMOJI_MAP: Record<string, string> = {
			"+1": "👍", "-1": "👎", laugh: "😄", hooray: "🎉",
			confused: "😕", heart: "❤️", rocket: "🚀", eyes: "👀",
		};
		const bar = parent.createDiv({ cls: "octo-reactions" });
		for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
			const count = comment.reactions.byType[key as keyof typeof comment.reactions.byType];
			if (count && count > 0) {
				bar.createSpan({ cls: "octo-reaction-pill", text: `${emoji} ${count}` });
			}
		}
	}

	timeAgo(dateStr: string): string {
		const now = Date.now();
		const then = new Date(dateStr).getTime();
		const diff = Math.floor((now - then) / 1000);
		if (diff < 60) return "just now";
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return `${Math.floor(diff / 86400)}d ago`;
	}
}
