import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "TutorTalk — Your 24/7 AI Voice Tutor",
  description:
    "AI-powered Socratic voice tutor. Speak your doubts, get guided to answers. Sessions end with a downloadable PDF report.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} ${poppins.variable} h-full antialiased`}>
        <body
          className="min-h-full flex flex-col"
          style={{ backgroundColor: "var(--tt-bg)" }}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
