import type { Metadata } from "next";
import { Poppins, Nunito } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const display = Poppins({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--font-display", display: "swap" });
const body = Nunito({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  title: "Thelawalaa Accounts",
  description: "Internal accounts, stock, and reporting tool.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NP" className={`${display.variable} ${body.variable}`}>
      <body>
        {children}
        <Toaster position="top-center" toastOptions={{ style: { borderRadius: "999px", fontWeight: 700 } }} />
      </body>
    </html>
  );
}
