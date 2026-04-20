import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type OctosidianPlugin from "./main";
import { testConnection } from "./github/client";

export interface SavedSearch {
	id: string;
	name: string;
	query: string;
	scope: "pr" | "issue" | "all";
}

export interface OctosidianSettings {
	token: string;
	pollingInterval: number;
	savedSearches: SavedSearch[];
}

export const DEFAULT_SETTINGS: OctosidianSettings = {
	token: "",
	pollingInterval: 60000,
	savedSearches: [],
};

export class OctosidianSettingTab extends PluginSettingTab {
	plugin: OctosidianPlugin;

	constructor(app: App, plugin: OctosidianPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Octosidian Settings" });

		new Setting(containerEl)
			.setName("GitHub Personal Access Token")
			.setDesc(
				"Generate a token with 'repo' scope at github.com/settings/tokens",
			)
			.addText((text) =>
				text
					.setPlaceholder("ghp_...")
					.setValue(this.plugin.settings.token)
					.onChange(async (value) => {
						this.plugin.settings.token = value;
						await this.plugin.saveSettings();
					}),
			);

		const testSetting = new Setting(containerEl)
			.setName("Test Connection")
			.setDesc("Verify your token works");

		const statusEl = testSetting.descEl.createSpan({
			cls: "octo-connection-status",
		});

		testSetting.addButton((button) =>
			button.setButtonText("Test").onClick(async () => {
				const token = this.plugin.settings.token;
				if (!token) {
					statusEl.setText("No token configured");
					statusEl.addClass("octo-status-error");
					return;
				}

				statusEl.setText("Testing...");
				statusEl.removeClass("octo-status-error");
				statusEl.removeClass("octo-status-ok");

				try {
					const user = await testConnection(token);
					statusEl.empty();
					statusEl.addClass("octo-status-ok");
					statusEl.setText(` Connected as ${user.login}`);
					new Notice(`Octosidian: Connected as ${user.login}`);
				} catch (err) {
					statusEl.setText(
						` Failed: ${err instanceof Error ? err.message : "Unknown error"}`,
					);
					statusEl.addClass("octo-status-error");
					statusEl.removeClass("octo-status-ok");
				}
			}),
		);

		new Setting(containerEl)
			.setName("Polling Interval")
			.setDesc("How often to check for updates (uses ETags to avoid rate limits)")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("30000", "30 seconds")
					.addOption("60000", "1 minute")
					.addOption("120000", "2 minutes")
					.addOption("300000", "5 minutes")
					.setValue(String(this.plugin.settings.pollingInterval))
					.onChange(async (value) => {
						this.plugin.settings.pollingInterval = Number(value);
						await this.plugin.saveSettings();
					}),
			);
	}
}
