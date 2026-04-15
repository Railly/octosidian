import { Plugin, WorkspaceLeaf } from "obsidian";
import {
	OctosidianSettingTab,
	DEFAULT_SETTINGS,
	type OctosidianSettings,
} from "./settings";
import { initClient, destroyClient } from "./github/client";
import { OCTO_VIEW_TYPE, OctosidianView } from "./views/sidebar";
import { emptyCacheData, type CachedData } from "./cache";

interface PluginData {
	settings: OctosidianSettings;
	cache: CachedData;
}

export default class OctosidianPlugin extends Plugin {
	settings: OctosidianSettings = DEFAULT_SETTINGS;
	cache: CachedData = emptyCacheData();

	async onload() {
		await this.loadPluginData();

		this.registerView(OCTO_VIEW_TYPE, (leaf) => new OctosidianView(leaf, this));

		this.addRibbonIcon("git-pull-request", "Octosidian", () => {
			this.activateView();
		});

		this.addSettingTab(new OctosidianSettingTab(this.app, this));

		if (this.settings.token) {
			initClient(this.settings.token);
		}
	}

	onunload() {
		destroyClient();
	}

	async activateView() {
		const { workspace } = this.app;
		const leaves = workspace.getLeavesOfType(OCTO_VIEW_TYPE);

		if (leaves.length > 0) {
			workspace.revealLeaf(leaves[0]);
			return;
		}

		const leaf = workspace.getLeaf("tab");
		await leaf.setViewState({
			type: OCTO_VIEW_TYPE,
			active: true,
		});
		workspace.revealLeaf(leaf);
	}

	async loadPluginData() {
		const raw = await this.loadData();
		if (raw) {
			this.settings = Object.assign({}, DEFAULT_SETTINGS, raw.settings ?? raw);
			this.cache = raw.cache ?? emptyCacheData();
		}
	}

	async saveSettings() {
		await this.saveData({ settings: this.settings, cache: this.cache });
		if (this.settings.token) {
			initClient(this.settings.token);
		} else {
			destroyClient();
		}
	}

	async saveCache() {
		await this.saveData({ settings: this.settings, cache: this.cache });
	}
}
