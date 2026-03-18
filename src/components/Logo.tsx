export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      {/* TV + Football icon */}
      <svg
        viewBox="0 0 44 40"
        className="w-9 h-9 shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* TV body */}
        <rect x="1" y="1" width="42" height="28" rx="5" fill="#162232" stroke="#22c55e" strokeWidth="2" />
        {/* Screen — dark field */}
        <rect x="5" y="5" width="34" height="20" rx="3" fill="#0a2210" />
        {/* Field center line */}
        <line x1="22" y1="5" x2="22" y2="25" stroke="#22c55e" strokeWidth="1" strokeOpacity="0.45" />
        {/* Field center circle */}
        <circle cx="22" cy="15" r="5" fill="none" stroke="#22c55e" strokeWidth="1" strokeOpacity="0.45" />
        {/* Football */}
        <circle cx="22" cy="15" r="5.5" fill="white" />
        {/* Ball pentagons hint */}
        <path
          d="M22 10.5 L24.5 12.5 L23.5 15.5 L20.5 15.5 L19.5 12.5 Z"
          fill="#1a1a2e"
          opacity="0.22"
        />
        {/* Ball seams */}
        <path d="M17.5 12.5 Q22 10 26.5 12.5" stroke="#555" strokeWidth="0.7" fill="none" />
        <path d="M17.5 17.5 Q22 20 26.5 17.5" stroke="#555" strokeWidth="0.7" fill="none" />
        <line x1="19.5" y1="10.2" x2="18.5" y2="19.8" stroke="#555" strokeWidth="0.7" />
        <line x1="24.5" y1="10.2" x2="25.5" y2="19.8" stroke="#555" strokeWidth="0.7" />
        {/* TV stand */}
        <line x1="17" y1="29" x2="15" y2="36" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
        <line x1="27" y1="29" x2="29" y2="36" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
        <line x1="13" y1="36" x2="31" y2="36" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" />
      </svg>

      {/* Wordmark */}
      <span className="text-xl sm:text-2xl font-black tracking-tight leading-none">
        <span className="text-base-content">MyFut</span>
        <span className="text-primary">TV</span>
      </span>
    </div>
  );
}
