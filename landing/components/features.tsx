import {
	PullRequestIcon,
	IssueIcon,
	InboxIcon,
	ReviewIcon,
	FileTreeIcon,
	CommandIcon,
} from "./icons";

const features = [
	{
		icon: PullRequestIcon,
		title: "Pull Requests",
		description:
			"Everything grouped the way you actually work. Review requested, authored, assigned, mentioned. Sort, filter, preview without leaving the list.",
	},
	{
		icon: IssueIcon,
		title: "Issues",
		description:
			"Triage across repos. Filter by label, state, or author. Read the full markdown body the same way Obsidian renders notes.",
	},
	{
		icon: InboxIcon,
		title: "Inbox",
		description:
			"GitHub notifications as a first-class view. Mark read, archive, focus on what actually needs you. Zero inbox without opening another tab.",
	},
	{
		icon: ReviewIcon,
		title: "Code Reviews",
		description:
			"Pending review requests at a glance. Open any PR to see stats, labels, reviewers, and CI checks. Comment inline and merge when ready.",
	},
	{
		icon: FileTreeIcon,
		title: "Repo Browser",
		description:
			"Click any repo name from a PR or issue. File tree on the left, README or source on the right. Syntax highlighting follows your Obsidian theme.",
	},
	{
		icon: CommandIcon,
		title: "Command Palette",
		description:
			"Cmd+K to jump anywhere. Search GitHub globally, navigate tabs with g-p, g-i, g-r. Built for keyboard-first workflows.",
	},
];

export function Features() {
	return (
		<section id="features" className="py-24 relative border-t border-white/10">
			<div className="mx-auto max-w-6xl px-6">
				<div className="max-w-2xl mb-16">
					<h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
						Six views. One place. Zero server.
					</h2>
					<p className="text-white/60 text-lg">
						Native Obsidian components. Reads your GitHub via a personal access
						token. Nothing runs in the cloud.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{features.map((feature) => (
						<div
							key={feature.title}
							className="group relative rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/20 transition"
						>
							<div className="h-10 w-10 rounded-lg border border-white/10 bg-white/[0.04] flex items-center justify-center mb-4 text-[#a855f7]">
								<feature.icon className="h-5 w-5" />
							</div>
							<h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
							<p className="text-sm text-white/60 leading-relaxed">
								{feature.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
