import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";
import { DocumentProvider } from "../contexts/DocumentContext";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "STIX Analyzer",
  description: "Analyze STIX documents and visualize threat intelligence",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthProvider>
          <DocumentProvider>
            <Navbar />
            {children}
          </DocumentProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
