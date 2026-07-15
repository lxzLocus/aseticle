import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "ASEticle",
  description:
    "Academic paper search across arXiv & Google Scholar — ranked, cited, translatable.",
};

// Set the theme before first paint so light-mode users don't flash dark.
const themeInit = `(function(){try{var m=localStorage.getItem('themeMode');if(m!=='light'&&m!=='dark')m='dark';document.documentElement.setAttribute('data-theme',m);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
