import { Toaster } from "@/components/ui/toaster";
import { SafeClerkProvider } from "@/components/providers/SafeClerkProvider";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "RadBooks Platform for Nonprofits",
    template: "%s | RadBooks Platform",
  },
  description:
    "See where every dollar goes. Nonprofits publish real-time financial data. Donors give with complete confidence. Verified 501(c)(3) organizations showing radical transparency.",
  keywords: [
    "nonprofit transparency",
    "501c3 financial transparency",
    "charitable giving",
    "nonprofit financial dashboard",
    "donor trust",
    "nonprofit accountability",
    "real-time nonprofit finances",
  ],
  authors: [{ name: "Peter Hayes" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://radbooks.org",
    siteName: "RadBooks",
    title: "RadBooks Platform for Nonprofits",
    description:
      "See where every dollar goes. Build unprecedented trust through complete financial transparency for 501(c)(3) organizations.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "RadBooks Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RadBooks Platform for Nonprofits",
    description:
      "See where every dollar goes. Build unprecedented trust through complete financial transparency.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );

  return <SafeClerkProvider>{content}</SafeClerkProvider>;
}
