import Image from "next/image";
import { GitHubIcon } from "./icons";

export function Hero() {
	return (
		<section className="relative overflow-hidden">
			<div className="absolute inset-0 bg-gradient-to-b from-[#7c3aed]/10 via-transparent to-transparent pointer-events-none" />
			<div className="relative mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-24 sm:pb-24">
				<div className="mx-auto max-w-3xl text-center">
					<div className="flex justify-center mb-8">
						<Image
							src="/brand/logo.png"
							alt="Octosidian"
							width={140}
							height={140}
							priority
							className="drop-shadow-[0_0_40px_rgba(168,85,247,0.35)]"
						/>
					</div>
					<div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 mb-6">
						<span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
						Beta — v0.1.0
					</div>
					<h1 className="text-5xl sm:text-6xl font-semibold tracking-tight text-white">
						GitHub activity,
						<br />
						<span className="bg-gradient-to-r from-[#7c3aed] via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent">
							inside Obsidian.
						</span>
					</h1>
					<p className="mt-6 text-lg text-white/60 max-w-xl mx-auto leading-relaxed">
						A design-first dashboard for pull requests, issues, reviews, and code browsing — without leaving your vault.
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
					<div className="absolute -inset-px bg-gradient-to-r from-[#7c3aed]/30 via-[#a855f7]/30 to-[#ec4899]/30 rounded-xl blur-2xl" />
					<div className="relative rounded-xl border border-white/10 bg-[#0d0d0d] overflow-hidden shadow-2xl">
						<div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
							<span className="h-3 w-3 rounded-full bg-red-500/80" />
							<span className="h-3 w-3 rounded-full bg-yellow-500/80" />
							<span className="h-3 w-3 rounded-full bg-green-500/80" />
							<span className="ml-3 text-xs text-white/50 font-mono">Obsidian — Octosidian</span>
						</div>
						<div className="aspect-[16/10] bg-gradient-to-br from-[#1a0a2e] via-[#0d0d0d] to-[#0a0a0a] flex items-center justify-center">
							<div className="text-white/30 text-sm">Screenshot coming soon</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
