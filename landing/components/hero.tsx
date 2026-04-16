import Image from "next/image";
import { GitHubIcon } from "./icons";

export function Hero() {
	return (
		<section className="relative">
			<div className="mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-24 sm:pb-24">
				<div className="mx-auto max-w-3xl text-center">
					<div className="flex justify-center mb-8">
						<Image
							src="/brand/logo.png"
							alt="Octosidian"
							width={140}
							height={140}
							priority
						/>
					</div>
					<div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 mb-6">
						<span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
						Beta v0.1.0
					</div>
					<h1 className="text-5xl sm:text-6xl font-semibold tracking-tight text-white leading-[1.05]">
						Stop tab-switching to GitHub.
					</h1>
					<p className="mt-6 text-lg text-white/60 max-w-xl mx-auto leading-relaxed">
						Review pull requests, triage issues, and browse code without
						leaving Obsidian. Your vault is where you think. Now it is also
						where you ship.
					</p>
					<div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
						<a
							href="#install"
							className="inline-flex items-center gap-2 rounded-lg bg-white text-[#0a0a0a] px-5 py-2.5 text-sm font-semibold hover:bg-white/90 transition"
						>
							Install plugin
						</a>
						<a
							href="https://github.com/Railly/octosidian"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium hover:bg-white/10 transition"
						>
							<GitHubIcon className="h-4 w-4" />
							View source
						</a>
					</div>
				</div>

				<div className="mt-16 relative mx-auto max-w-5xl">
					<div className="rounded-xl border border-white/10 bg-[#0d0d0d] overflow-hidden shadow-2xl">
						<div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
							<span className="h-3 w-3 rounded-full bg-red-500/80" />
							<span className="h-3 w-3 rounded-full bg-yellow-500/80" />
							<span className="h-3 w-3 rounded-full bg-green-500/80" />
							<span className="ml-3 text-xs text-white/50 font-mono">
								Obsidian &middot; Octosidian
							</span>
						</div>
						<Image
							src="/preview-1920.png"
							alt="Octosidian overview tab inside Obsidian showing open pull requests, issues, and review counts"
							width={1920}
							height={1186}
							priority
							className="w-full h-auto block"
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
