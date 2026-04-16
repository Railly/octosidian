import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Octosidian — GitHub activity inside Obsidian",
	description:
		"A design-first GitHub dashboard for pull requests, issues, and code reviews — inside Obsidian. Free and open-source.",
	openGraph: {
		title: "Octosidian",
		description: "GitHub activity inside Obsidian",
		url: "https://octosidian.railly.dev",
		siteName: "Octosidian",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "Octosidian",
		description: "GitHub activity inside Obsidian",
		creator: "@raillyhugo",
	},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
			<body className="min-h-full flex flex-col bg-[#0a0a0a] text-white">{children}</body>
		</html>
	);
}
