import { App, Modal } from "obsidian";
import { searchIssuesAndPRs } from "../github/api";
import { ICONS } from "../icons";

type SearchResult = {
	number: number;
	title: string;
	state: string;
	html_url: string;
	pull_request?: unknown;
	repository_url: string;
	repoName: string;
};

export class OctoCommandPalette extends Modal {
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	private results: SearchResult[] = [];
	private selectedIndex = 0;
	private listEl: HTMLElement | null = null;

	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("octo-palette");
		contentEl.empty();

		const inputWrapper = contentEl.createDiv({ cls: "octo-palette-input-wrapper" });
		const searchIcon = inputWrapper.createSpan({ cls: "octo-palette-search-icon" });
		searchIcon.innerHTML = ICONS.search;

		const input = inputWrapper.createEl("input", {
			cls: "octo-palette-input",
			attr: { type: "text", placeholder: "Search GitHub issues and PRs..." },
		});
		input.focus();

		this.listEl = contentEl.createDiv({ cls: "octo-palette-list" });
		this.renderEmpty("Type to search GitHub...");

		input.addEventListener("input", () => {
			const query = input.value.trim();
			if (this.debounceTimer) clearTimeout(this.debounceTimer);
			if (!query) { this.results = []; this.selectedIndex = 0; this.renderEmpty("Type to search GitHub..."); return; }
			this.renderEmpty("Searching...");
			this.debounceTimer = setTimeout(async () => {
				const raw = await searchIssuesAndPRs(query);
				this.results = raw.map(r => {
					const match = r.repository_url.match(/repos\/([^/]+\/[^/]+)$/);
					return { ...r, repoName: match ? match[1] : r.repository_url };
				});
				this.selectedIndex = 0;
				this.renderResults();
			}, 250);
		});

		input.addEventListener("keydown", (e) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length - 1);
				this.renderResults();
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
				this.renderResults();
			} else if (e.key === "Enter") {
				e.preventDefault();
				const selected = this.results[this.selectedIndex];
				if (selected) { window.open(selected.html_url, "_blank"); this.close(); }
			}
		});
	}

	renderEmpty(text: string) {
		if (!this.listEl) return;
		this.listEl.empty();
		this.listEl.createDiv({ cls: "octo-palette-empty", text });
	}

	renderResults() {
		if (!this.listEl) return;
		this.listEl.empty();
		if (this.results.length === 0) { this.renderEmpty("No results found."); return; }

		const prs = this.results.filter(r => r.pull_request);
		const issues = this.results.filter(r => !r.pull_request);

		let globalIdx = 0;
		if (prs.length > 0) {
			this.listEl.createDiv({ cls: "octo-palette-group-label", text: "Pull Requests" });
			for (const item of prs) {
				this.renderResultItem(item, globalIdx);
				globalIdx++;
			}
		}
		if (issues.length > 0) {
			this.listEl.createDiv({ cls: "octo-palette-group-label", text: "Issues" });
			for (const item of issues) {
				this.renderResultItem(item, globalIdx);
				globalIdx++;
			}
		}
	}

	renderResultItem(item: SearchResult, idx: number) {
		if (!this.listEl) return;
		const el = this.listEl.createDiv({ cls: `octo-palette-item ${idx === this.selectedIndex ? "octo-palette-item-active" : ""}` });
		const iconEl = el.createSpan({ cls: "octo-palette-item-icon" });
		iconEl.innerHTML = item.pull_request ? ICONS.prOpen : ICONS.issueOpen;
		const info = el.createDiv({ cls: "octo-palette-item-info" });
		info.createDiv({ cls: "octo-palette-item-title", text: item.title });
		info.createDiv({ cls: "octo-palette-item-meta", text: `${item.repoName} #${item.number}` });
		el.addEventListener("click", () => { window.open(item.html_url, "_blank"); this.close(); });
		el.addEventListener("mouseenter", () => {
			this.selectedIndex = idx;
			this.listEl?.querySelectorAll(".octo-palette-item").forEach((e, i) => {
				e.toggleClass("octo-palette-item-active", i === this.selectedIndex);
			});
		});
	}

	onClose() {
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.contentEl.empty();
	}
}
