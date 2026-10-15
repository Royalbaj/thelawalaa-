import Navbar from "@/components/navbar";
import Footer from "@/components/footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar lang="en" />
      <main>{children}</main>
      <Footer lang="en" />
    </>
  );
}
