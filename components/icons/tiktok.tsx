// lucide-react has no TikTok mark — small inline glyph matching its icon style (24x24, currentColor).
export default function TikTokIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg" className={className}
    >
      <path
        d="M16.5 3c.4 2.2 1.9 3.7 4 4v3.1c-1.4 0-2.8-.4-4-1.2v6.6c0 3.4-2.8 6-6.2 5.7-3-.2-5.4-2.8-5.4-5.9 0-3.3 2.8-5.9 6.1-5.7v3.2a2.6 2.6 0 1 0 2.4 2.6V3h3.1Z"
        stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"
      />
    </svg>
  );
}
