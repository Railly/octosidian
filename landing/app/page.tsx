import { GitHubIcon, ObsidianIcon } from "@/components/icons";
import { Hero } from "@/components/hero";
import { Features } from "@/components/features";
import { Install } from "@/components/install";
import { Footer } from "@/components/footer";

export default function Home() {
	return (
		<main className="flex flex-col min-h-screen">
			<nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md">
				<div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<ObsidianIcon className="h-5 w-5 text-[#7c3aed]" />
						<span className="font-semibold">Octosidian</span>
					</div>
					<div className="flex items-center gap-4 text-sm">
						<a href="#features" className="text-white/60 hover:text-white transition">
							Features
						</a>
						<a href="#install" className="text-white/60 hover:text-white transition">
							Install
						</a>
						<a
							href="https://github.com/Railly/octosidian"
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-1.5 text-white/60 hover:text-white transition"
						>
							<GitHubIcon className="h-4 w-4" />
							GitHub
						</a>
					</div>
				</div>
			</nav>
			<Hero />
			<Features />
			<Install />
			<Footer />
		</main>
	);
}
