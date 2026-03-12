import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppToaster } from "@/components/ui/AppToaster";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ClientWrapper } from "@/components/ClientWrapper";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "CMP App",
  description: "Compliance Management Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ClientWrapper>
            {children}
          </ClientWrapper>
          <AppToaster />
        </AuthProvider>
      </body>
    </html>
  );
}
