/**
 * Minimal syntax tokenizer — zero deps, ~200 LOC.
 *
 * Not a full parser; regex-based with priority order:
 *   1. block comment / line comment
 *   2. strings (single, double, backtick, triple)
 *   3. numbers
 *   4. keywords (language-specific)
 *   5. punctuation / operators (noop — left as plain)
 *
 * Returns an HTML string where each token is wrapped in <span class="octo-hl-{kind}">.
 * Good enough for diff viewing; not suitable for an editor.
 */

type TokenKind = "comment" | "string" | "keyword" | "number" | "plain";

const KEYWORDS: Record<string, Set<string>> = {
	typescript: new Set([
		"abstract","any","as","async","await","boolean","break","case","catch","class","const","continue","debugger","declare","default","delete","do","else","enum","export","extends","false","finally","for","from","function","get","if","implements","import","in","instanceof","interface","is","keyof","let","namespace","never","new","null","number","object","of","package","private","protected","public","readonly","return","set","static","string","super","switch","symbol","this","throw","true","try","type","typeof","undefined","union","unknown","var","void","while","with","yield",
	]),
	javascript: new Set([
		"async","await","break","case","catch","class","const","continue","debugger","default","delete","do","else","export","extends","false","finally","for","from","function","get","if","import","in","instanceof","let","new","null","of","return","set","static","super","switch","this","throw","true","try","typeof","undefined","var","void","while","with","yield",
	]),
	python: new Set([
		"False","None","True","and","as","assert","async","await","break","class","continue","def","del","elif","else","except","finally","for","from","global","if","import","in","is","lambda","nonlocal","not","or","pass","raise","return","try","while","with","yield",
	]),
	rust: new Set([
		"as","async","await","break","const","continue","crate","dyn","else","enum","extern","false","fn","for","if","impl","in","let","loop","match","mod","move","mut","pub","ref","return","self","Self","static","struct","super","trait","true","type","unsafe","use","where","while",
	]),
	go: new Set([
		"break","case","chan","const","continue","default","defer","else","fallthrough","for","func","go","goto","if","import","interface","map","package","range","return","select","struct","switch","type","var","nil","true","false",
	]),
	java: new Set([
		"abstract","boolean","break","byte","case","catch","char","class","const","continue","default","do","double","else","enum","extends","final","finally","float","for","goto","if","implements","import","instanceof","int","interface","long","native","new","null","package","private","protected","public","return","short","static","strictfp","super","switch","synchronized","this","throw","throws","transient","try","void","volatile","while","true","false",
	]),
	c: new Set([
		"auto","break","case","char","const","continue","default","do","double","else","enum","extern","float","for","goto","if","inline","int","long","register","restrict","return","short","signed","sizeof","static","struct","switch","typedef","union","unsigned","void","volatile","while",
	]),
	cpp: new Set([
		"alignas","alignof","and","asm","auto","bool","break","case","catch","char","class","const","constexpr","continue","decltype","default","delete","do","double","dynamic_cast","else","enum","explicit","extern","false","float","for","friend","goto","if","inline","int","long","mutable","namespace","new","noexcept","nullptr","operator","or","private","protected","public","register","reinterpret_cast","return","short","signed","sizeof","static","static_cast","struct","switch","template","this","thread_local","throw","true","try","typedef","typeid","typename","union","unsigned","using","virtual","void","volatile","while",
	]),
	csharp: new Set([
		"abstract","as","async","await","base","bool","break","byte","case","catch","char","checked","class","const","continue","decimal","default","delegate","do","double","else","enum","event","explicit","extern","false","finally","fixed","float","for","foreach","goto","if","implicit","in","int","interface","internal","is","lock","long","namespace","new","null","object","operator","out","override","params","private","protected","public","readonly","ref","return","sbyte","sealed","short","sizeof","stackalloc","static","string","struct","switch","this","throw","true","try","typeof","uint","ulong","unchecked","unsafe","ushort","using","var","virtual","void","volatile","while","yield",
	]),
	ruby: new Set([
		"BEGIN","END","alias","and","begin","break","case","class","def","defined?","do","else","elsif","end","ensure","false","for","if","in","module","next","nil","not","or","redo","rescue","retry","return","self","super","then","true","undef","unless","until","when","while","yield",
	]),
};

// Map from language id (from detectLanguage) to keyword set
function keywordsFor(lang: string): Set<string> {
	if (lang === "tsx") return KEYWORDS.typescript;
	return KEYWORDS[lang] ?? new Set();
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

/**
 * Tokenize a single line (no newline) for the given language.
 * Returns an HTML string with spans for comment/string/keyword/number.
 *
 * This is line-local — it does NOT handle multi-line block comments spanning
 * hunk lines (rare in code, and diff view splits by line anyway). That means
 * "/*" on line N doesn't color line N+1 as comment. Acceptable tradeoff.
 */
export function highlightLine(line: string, lang: string): string {
	if (lang === "plain" || !line) return escapeHtml(line);

	const kw = keywordsFor(lang);
	let result = "";
	let i = 0;
	const n = line.length;

	while (i < n) {
		const ch = line[i];
		const two = line.slice(i, i + 2);

		// Line comment: // or # or --
		if (
			(lang === "typescript" || lang === "javascript" || lang === "rust" || lang === "go" || lang === "java" || lang === "c" || lang === "cpp" || lang === "csharp" || lang === "swift" || lang === "kotlin" || lang === "scala") && two === "//"
		) {
			result += `<span class="octo-hl-comment">${escapeHtml(line.slice(i))}</span>`;
			break;
		}
		if ((lang === "python" || lang === "ruby" || lang === "bash" || lang === "yaml" || lang === "toml") && ch === "#") {
			result += `<span class="octo-hl-comment">${escapeHtml(line.slice(i))}</span>`;
			break;
		}
		if (lang === "sql" && two === "--") {
			result += `<span class="octo-hl-comment">${escapeHtml(line.slice(i))}</span>`;
			break;
		}

		// Block comment (on one line): /* ... */
		if (two === "/*") {
			const end = line.indexOf("*/", i + 2);
			const stop = end === -1 ? n : end + 2;
			result += `<span class="octo-hl-comment">${escapeHtml(line.slice(i, stop))}</span>`;
			i = stop;
			continue;
		}

		// String: ", ', `
		if (ch === '"' || ch === "'" || ch === "`") {
			const quote = ch;
			let j = i + 1;
			while (j < n) {
				if (line[j] === "\\" && j + 1 < n) { j += 2; continue; }
				if (line[j] === quote) { j++; break; }
				j++;
			}
			result += `<span class="octo-hl-string">${escapeHtml(line.slice(i, j))}</span>`;
			i = j;
			continue;
		}

		// Number
		if (ch >= "0" && ch <= "9") {
			let j = i + 1;
			while (j < n && /[0-9a-fA-FxXoObB._]/.test(line[j])) j++;
			result += `<span class="octo-hl-number">${escapeHtml(line.slice(i, j))}</span>`;
			i = j;
			continue;
		}

		// Word (identifier/keyword)
		if (/[A-Za-z_$]/.test(ch)) {
			let j = i + 1;
			while (j < n && /[A-Za-z0-9_$]/.test(line[j])) j++;
			const word = line.slice(i, j);
			if (kw.has(word)) {
				result += `<span class="octo-hl-keyword">${escapeHtml(word)}</span>`;
			} else {
				result += escapeHtml(word);
			}
			i = j;
			continue;
		}

		// Everything else: passthrough char (operators, punctuation, whitespace)
		result += escapeHtml(ch);
		i++;
	}

	return result;
}
