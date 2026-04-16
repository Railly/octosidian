import { Octokit } from "octokit";
import type { GitHubUserProfile } from "./types";

let octokitInstance: Octokit | null = null;

export function initClient(token: string): Octokit {
	octokitInstance = new Octokit({
		auth: token,
		userAgent: "octosidian",
	});
	return octokitInstance;
}

export function getClient(): Octokit | null {
	return octokitInstance;
}

export function destroyClient(): void {
	octokitInstance = null;
}

export async function testConnection(
	token: string,
): Promise<GitHubUserProfile> {
	const client = new Octokit({ auth: token, userAgent: "octosidian" });
	const { data } = await client.rest.users.getAuthenticated();
	return {
		login: data.login,
		name: data.name ?? null,
		avatarUrl: data.avatar_url,
		url: data.html_url,
	};
}
