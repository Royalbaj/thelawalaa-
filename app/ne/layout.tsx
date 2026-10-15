import { Mukta, Poppins } from "next/font/google";
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

// The Nepali homepage. Poppins has Devanagari letters (headings, same look as the
// English site); Nunito doesn't, so the text here is Mukta, made for Nepali.
const display = Poppins({ subsets: ["latin", "devanagari"], weight: ["500", "600", "700", "800"], variable: "--font-display", display: "swap" });
const body = Mukta({ subsets: ["latin", "devanagari"], weight: ["400", "500", "600", "700", "800"], variable: "--font-body", display: "swap" });

export default function NepaliLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="ne" className={`${display.variable} ${body.variable} font-body`}>
      <Navbar lang="ne" />
      <main>{children}</main>
      <Footer lang="ne" />
    </div>
  );
}
