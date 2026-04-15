# Octosidian

A design-first GitHub dashboard for pull requests, issues, and code reviews — inside Obsidian.

## Features

- **Overview** — Dashboard with PR/issue/review counts and recent activity
- **Inbox** — GitHub notifications with unread/all filter
- **Pull Requests** — Grouped by role (review requested, authored, assigned, mentioned)
- **Issues** — Grouped by role with search and filters
- **Reviews** — Pending review requests at a glance
- **Detail View** — Full PR/issue body, labels, assignees, timeline, and comments rendered as markdown
- **Stale-While-Revalidate Cache** — Instant load from cache, fresh data fetched in background
- **Native Obsidian UI** — Adapts to your theme, opens as a tab like any file

## Install

1. Copy `main.js`, `manifest.json`, and `styles.css` to `.obsidian/plugins/octosidian/`
2. Enable "Octosidian" in Settings > Community plugins
3. Add your GitHub PAT (with `repo` scope) in Settings > Octosidian
4. Click the git-pull-request icon in the ribbon

## Credits

Inspired by [DiffKit](https://github.com/stylessh/diffkit) by [@stylesshDev](https://x.com/stylesshDev).

## License

MIT
