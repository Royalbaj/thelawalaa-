import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** Nepali rupees — "Rs 1,250" */
export const npr = (n: number) => `Rs ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n)}`;
