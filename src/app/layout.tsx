import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/customer/cart-provider";

export const metadata: Metadata = {
  metadataBase: new URL("https://hardwareonlinepasal.com"),
  title: {
    default: "Hardware Online Pasal",
    template: "%s | Hardware Online Pasal",
  },
  description:
    "Find hardware products from nearby independent shops across Nepal.",
  openGraph: {
    title: "Hardware Online Pasal",
    description:
      "Find hardware products from nearby independent shops across Nepal.",
    url: "https://hardwareonlinepasal.com",
    siteName: "Hardware Online Pasal",
    locale: "en_NP",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
