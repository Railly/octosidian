import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
	metadataBase: new URL("https://octosidian.railly.dev"),
	title: "Octosidian — GitHub activity inside Obsidian",
	description:
		"A design-first GitHub dashboard for pull requests, issues, and code reviews — inside Obsidian. Free and open-source.",
	keywords: [
		"obsidian",
		"github",
		"plugin",
		"pull requests",
		"issues",
		"code review",
		"octosidian",
	],
	icons: {
		icon: [
			{ url: "/favicon.ico", sizes: "any" },
			{ url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
			{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
		],
		apple: "/apple-touch-icon.png",
	},
	openGraph: {
		title: "Octosidian — GitHub activity inside Obsidian",
		description: "A design-first GitHub dashboard inside Obsidian",
		url: "https://octosidian.railly.dev",
		siteName: "Octosidian",
		type: "website",
		images: [{ url: "/og.png", width: 1200, height: 630 }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Octosidian",
		description: "GitHub activity inside Obsidian",
		creator: "@raillyhugo",
		images: ["/og.png"],
	},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
			<body className="min-h-full flex flex-col bg-[#0a0a0a] text-white">
				{children}
				<Analytics />
			</body>
		</html>
	);
}
