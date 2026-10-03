import { BrandLoader } from "@/components/brand-loader";

// Inside the admin shell: the sidebar and header stay, the page area shows this.
export default function Loading() {
  return <BrandLoader className="py-28" />;
}
