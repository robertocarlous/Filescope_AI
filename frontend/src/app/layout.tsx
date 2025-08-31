import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "./client-layout";

export const metadata: Metadata = {
  title: "FileScope AI - Decentralized Dataset Intelligence",
  description: "Upload datasets, get instant AI analysis with anomaly detection, bias assessment, and quality scoring. Everything stored permanently on Filecoin for complete transparency.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
