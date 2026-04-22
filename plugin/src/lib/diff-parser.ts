export type DiffLine = {
	kind: "add" | "del" | "context" | "hunk-header";
	content: string;
	oldLineNumber: number | null;
	newLineNumber: number | null;
};

export type DiffHunk = {
	header: string;
	oldStart: number;
	oldLines: number;
	newStart: number;
	newLines: number;
	lines: DiffLine[];
};

/**
 * Parse a unified diff patch (as returned by GitHub's pulls.listFiles `patch`
 * field) into structured hunks with per-line old/new line numbers.
 *
 * Example input:
 *   @@ -10,6 +10,7 @@ function foo() {
 *    const x = 1;
 *   -  return x;
 *   +  const y = 2;
 *   +  return x + y;
 *    }
 */
export function parsePatch(patch: string): DiffHunk[] {
	const hunks: DiffHunk[] = [];
	if (!patch) return hunks;

	const lines = patch.split("\n");
	let current: DiffHunk | null = null;
	let oldLine = 0;
	let newLine = 0;

	for (const raw of lines) {
		if (raw.startsWith("@@")) {
			// @@ -oldStart,oldLines +newStart,newLines @@ optional-context
			const match = raw.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
			if (!match) continue;
			current = {
				header: raw,
				oldStart: Number(match[1]),
				oldLines: match[2] ? Number(match[2]) : 1,
				newStart: Number(match[3]),
				newLines: match[4] ? Number(match[4]) : 1,
				lines: [],
			};
			hunks.push(current);
			oldLine = current.oldStart;
			newLine = current.newStart;
			current.lines.push({
				kind: "hunk-header",
				content: raw,
				oldLineNumber: null,
				newLineNumber: null,
			});
			continue;
		}

		if (!current) continue;

		if (raw.startsWith("+")) {
			current.lines.push({
				kind: "add",
				content: raw.slice(1),
				oldLineNumber: null,
				newLineNumber: newLine,
			});
			newLine++;
		} else if (raw.startsWith("-")) {
			current.lines.push({
				kind: "del",
				content: raw.slice(1),
				oldLineNumber: oldLine,
				newLineNumber: null,
			});
			oldLine++;
		} else if (raw.startsWith(" ")) {
			current.lines.push({
				kind: "context",
				content: raw.slice(1),
				oldLineNumber: oldLine,
				newLineNumber: newLine,
			});
			oldLine++;
			newLine++;
		} else if (raw.startsWith("\\")) {
			// "\ No newline at end of file" — skip
		}
	}

	return hunks;
}

export function detectLanguage(filename: string): string {
	const ext = filename.split(".").pop()?.toLowerCase() ?? "";
	const map: Record<string, string> = {
		ts: "typescript", tsx: "typescript", mts: "typescript", cts: "typescript",
		js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
		py: "python",
		rs: "rust",
		go: "go",
		java: "java", kt: "kotlin", scala: "scala",
		c: "c", h: "c", cpp: "cpp", cc: "cpp", hpp: "cpp", hh: "cpp",
		cs: "csharp",
		swift: "swift",
		rb: "ruby",
		php: "php",
		sh: "bash", bash: "bash", zsh: "bash",
		yml: "yaml", yaml: "yaml",
		json: "json",
		toml: "toml",
		md: "markdown", mdx: "markdown",
		html: "html", htm: "html",
		css: "css", scss: "scss", sass: "sass", less: "less",
		sql: "sql",
		lua: "lua",
	};
	return map[ext] ?? "plain";
}
