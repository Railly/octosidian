import { GitHubIcon } from "./icons";

export function Footer() {
	return (
		<footer className="border-t border-white/10 py-12 mt-auto">
			<div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-white/50">
				<div className="flex items-center gap-2">
					<span>
						Built by{" "}
						<a
							href="https://railly.dev"
							target="_blank"
							rel="noopener noreferrer"
							className="text-white hover:text-[#a855f7] transition"
						>
							Railly Hugo
						</a>
					</span>
					<span>·</span>
					<span>MIT License</span>
				</div>

				<div className="flex items-center gap-6">
					<a
						href="https://github.com/Railly/octosidian"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1.5 hover:text-white transition"
					>
						<GitHubIcon className="h-4 w-4" />
						GitHub
					</a>
					<a
						href="https://x.com/raillyhugo"
						target="_blank"
						rel="noopener noreferrer"
						className="hover:text-white transition"
					>
						@raillyhugo
					</a>
				</div>
			</div>

			<div className="mx-auto max-w-6xl px-6 mt-8 pt-6 border-t border-white/5 text-xs text-white/40 text-center">
				Inspired by{" "}
				<a
					href="https://github.com/stylessh/diffkit"
					target="_blank"
					rel="noopener noreferrer"
					className="text-white/60 hover:text-white transition"
				>
					DiffKit
				</a>{" "}
				by{" "}
				<a
					href="https://x.com/stylesshDev"
					target="_blank"
					rel="noopener noreferrer"
					className="text-white/60 hover:text-white transition"
				>
					@stylesshDev
				</a>
			</div>
		</footer>
	);
}
