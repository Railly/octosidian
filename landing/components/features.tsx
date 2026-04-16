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
			"All your PRs grouped by role: review requested, authored, assigned, mentioned. Sort, filter, and preview inline.",
	},
	{
		icon: IssueIcon,
		title: "Issues",
		description:
			"Triage open issues across your repos. Filter by label, author, or state. Read full markdown body with rendered formatting.",
	},
	{
		icon: InboxIcon,
		title: "Inbox",
		description:
			"GitHub notifications as a first-class view. Mark as read, archive, and stay focused on what needs attention.",
	},
	{
		icon: ReviewIcon,
		title: "Code Reviews",
		description:
			"Pending review requests at a glance. See PR details with stats, reviewers, and CI status checks.",
	},
	{
		icon: FileTreeIcon,
		title: "Repo Browser",
		description:
			"Navigate any repo's file tree inside Obsidian. View README, browse files, and read source with syntax highlighting.",
	},
	{
		icon: CommandIcon,
		title: "Command Palette",
		description:
			"Cmd+K to search GitHub globally. Navigate between tabs with G+P, G+I, G+R shortcuts. Never touch the mouse.",
	},
];

export function Features() {
	return (
		<section id="features" className="py-24 relative">
			<div className="mx-auto max-w-6xl px-6">
				<div className="max-w-2xl mb-16">
					<h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
						Everything you need to review code without leaving your vault.
					</h2>
					<p className="text-white/60 text-lg">
						Six focused views. Native Obsidian UI. Zero server dependencies.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{features.map((feature) => (
						<div
							key={feature.title}
							className="group relative rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/20 transition"
						>
							<div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#7c3aed]/20 to-[#ec4899]/20 border border-white/10 flex items-center justify-center mb-4 text-[#a855f7]">
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
