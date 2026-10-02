"use client";
import { useState } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const RULES = [
  { label: "8+ characters", test: (p: string) => p.length >= 8 },
  { label: "An uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "A number", test: (p: string) => /[0-9]/.test(p) },
  { label: "A symbol (!@#…)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

/** Password field with show/hide; `showRules` adds the live checklist used on sign-up and reset. */
export default function PasswordInput({ id, name, label, value, onChange, showRules = false, autoComplete = "current-password" }: {
  id: string; name: string; label: string; value?: string; onChange?: (v: string) => void; showRules?: boolean; autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [own, setOwn] = useState("");
  const v = value ?? own;
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input id={id} name={name} type={visible ? "text" : "password"} required autoComplete={autoComplete} maxLength={72}
          value={v} onChange={(e) => { setOwn(e.target.value); onChange?.(e.target.value); }} className="input !pr-12" />
        <button type="button" onClick={() => setVisible((x) => !x)} aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-stone-400 hover:text-brand-brown">
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {showRules && (
        <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
          {RULES.map((r) => {
            const ok = r.test(v);
            return (
              <li key={r.label} className={cn("flex items-center gap-1.5 text-xs font-bold transition", ok ? "text-green-700" : "text-stone-400")}>
                <Check size={13} className={ok ? "opacity-100" : "opacity-30"} /> {r.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
