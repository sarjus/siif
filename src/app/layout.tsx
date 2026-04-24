import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "SIIF | Launch Your Startup Journey",
  description: "SSCBS Innovation and Incubation Foundation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="font-sans antialiased min-h-screen flex flex-col"
      >
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
