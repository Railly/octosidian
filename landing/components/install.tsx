import { GitHubIcon } from "./icons";

export function Install() {
	return (
		<section id="install" className="py-24 relative border-t border-white/10">
			<div className="mx-auto max-w-4xl px-6">
				<div className="text-center mb-12">
					<h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
						Install in 30 seconds.
					</h2>
					<p className="text-white/60">
						Manual install for now. Community plugin submission pending review.
					</p>
				</div>

				<div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
					<div className="border-b border-white/10 px-6 py-4 text-sm text-white/60">
						Manual install
					</div>
					<div className="p-6 space-y-4">
						<Step number={1}>
							<p>Clone into your vault&apos;s plugins folder:</p>
							<CodeBlock>
								{`cd /path/to/your/vault/.obsidian/plugins\ngit clone https://github.com/Railly/octosidian.git\ncd octosidian/plugin && bun install && bun run build`}
							</CodeBlock>
						</Step>
						<Step number={2}>
							<p>
								Open Obsidian, go to Settings, Community plugins, and enable
								Octosidian.
							</p>
						</Step>
						<Step number={3}>
							<p>
								Create a{" "}
								<a
									href="https://github.com/settings/tokens/new?scopes=repo,notifications"
									target="_blank"
									rel="noopener noreferrer"
									className="text-[#a855f7] hover:underline"
								>
									GitHub personal access token
								</a>{" "}
								with{" "}
								<code className="text-xs bg-white/10 px-1.5 py-0.5 rounded">
									repo
								</code>{" "}
								and{" "}
								<code className="text-xs bg-white/10 px-1.5 py-0.5 rounded">
									notifications
								</code>{" "}
								scopes.
							</p>
						</Step>
						<Step number={4}>
							<p>
								Paste the token into Settings, Octosidian. Click the
								git-pull-request icon in the ribbon and you are in.
							</p>
						</Step>
					</div>
				</div>

				<div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
					<a
						href="https://github.com/Railly/octosidian"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 rounded-lg bg-white text-[#0a0a0a] px-5 py-2.5 text-sm font-semibold hover:bg-white/90 transition"
					>
						<GitHubIcon className="h-4 w-4" />
						Star on GitHub
					</a>
					<a
						href="https://github.com/Railly/octosidian/issues"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium hover:bg-white/10 transition"
					>
						Report an issue
					</a>
				</div>
			</div>
		</section>
	);
}

function Step({
	number,
	children,
}: {
	number: number;
	children: React.ReactNode;
}) {
	return (
		<div className="flex gap-4">
			<div className="flex-shrink-0 h-7 w-7 rounded-full bg-[#7c3aed] text-white text-xs font-semibold flex items-center justify-center">
				{number}
			</div>
			<div className="flex-1 space-y-2 pt-0.5 text-sm text-white/80">
				{children}
			</div>
		</div>
	);
}

function CodeBlock({ children }: { children: string }) {
	return (
		<pre className="bg-black/60 border border-white/10 rounded-lg px-4 py-3 text-xs font-mono text-white/90 overflow-x-auto">
			<code>{children}</code>
		</pre>
	);
}
