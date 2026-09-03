/** OST wordmark + reusable brand bits, matching "The Science Road" prototype. */
export function Logo({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <div className="min-w-0 leading-tight">
        <div className={`truncate font-bold text-primary ${compact ? "text-sm" : "text-base"}`}>Open Startup Platform</div>
        <div className="text-[11px] font-normal uppercase tracking-wide text-slate-400">
          The Science Road
        </div>
      </div>
    </div>
  );
}

/** Left-side decorative panel echoing the website's hero gradient. */
export function BrandPanel() {
  return (
    <div
      className="relative hidden overflow-hidden lg:flex lg:w-[42%] lg:flex-col lg:justify-between lg:p-12"
      style={{ background: "linear-gradient(160deg, #0A193D, #16265a)" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(255,61,130,0.35), transparent 45%), radial-gradient(circle at 85% 75%, rgba(98,221,209,0.25), transparent 40%)",
        }}
      />
      <RoadGlow
        viewBox="0 0 600 500"
        path="M20,460 C120,420 100,320 220,300 C340,280 360,380 480,340 C540,320 560,280 590,220"
        className="pointer-events-none absolute inset-0 opacity-70"
      />
      <div className="relative z-10">
        <Logo className="[&_*]:text-white" />
      </div>
      <div className="relative z-10 space-y-6">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-secondary-300">
          A new journey has begun
        </span>
        <h1 className="text-4xl font-extrabold leading-tight text-white">
          Fostering innovation across Africa and beyond.
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-white/70">
          One platform for the whole program: onboarding, mentorship, data
          rooms, and progress, kept live and in real time.
        </p>
        <div className="flex flex-wrap gap-x-8 gap-y-4 pt-4 text-white">
          <Stat value="+1000" label="Startups supported" />
          <Stat value="+20" label="Countries served" />
          <Stat value="10 yrs" label="Of building" />
        </div>
      </div>
      <div className="relative z-10 text-xs text-white/40">
        © {new Date().getFullYear()} Open Startup International
      </div>
    </div>
  );
}

/**
 * The glowing pink-to-turquoise winding road, echoing the event stage
 * visual of "Africa's science, in motion." Purely decorative.
 */
export function RoadGlow({
  viewBox,
  path,
  className = "",
}: {
  viewBox: string;
  path: string;
  className?: string;
}) {
  const gid = `roadGlow-${path.length}`;
  return (
    <svg viewBox={viewBox} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF3D82" />
          <stop offset="100%" stopColor="#62DDD1" />
        </linearGradient>
        <filter id={`${gid}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <path d={path} fill="none" stroke={`url(#${gid})`} strokeWidth="3" strokeLinecap="round" filter={`url(#${gid}-blur)`} opacity="0.9" />
      <path d={path} fill="none" stroke={`url(#${gid})`} strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-extrabold text-secondary-300">{value}</div>
      <div className="text-xs text-white/60">{label}</div>
    </div>
  );
}

/** The "Science Road" six-petal mark, straight from the prototype. */
function LogoMark() {
  return (
    <svg viewBox="0 0 1024 1024" className="h-[26px] w-[26px] shrink-0" xmlns="http://www.w3.org/2000/svg">
      <path d="M665.953 140.192C677.26 205.188 628.904 253.97 553.384 247.001C472.673 239.535 396.513 172.548 388.691 100.228C381.082 30.3258 441.313 -11.843 518.398 2.94806C590.789 16.8858 655.002 77.2592 665.953 140.192Z" fill="#62DDD1" />
      <path d="M783.294 834.591C798.156 919.569 747.312 1003.76 663.898 1020.9C573.872 1039.39 486.405 972.831 475.809 874.626C465.569 780.262 531.845 701.969 617.392 696.777C697.107 691.871 769 752.6 783.294 834.591Z" fill="#62DDD1" />
      <path d="M921.171 415.452C874.664 447.737 797.935 425.266 752.638 363.043C707.269 300.608 715.233 228.146 767.358 202.972C816.14 179.434 885.9 206.599 925.935 262.065C965.758 317.39 964.691 385.23 921.1 415.452H921.171Z" fill="#62DDD1" />
      <path d="M333.156 814.476C244.125 876.2 112.57 860.911 46.9342 774.298C-18.9858 687.258 15.9297 573.694 116.125 525.338C207.574 481.249 320.854 508.485 375.965 582.582C430.863 656.325 414.365 758.085 333.156 814.476Z" fill="#62DDD1" />
      <path d="M871.613 759.355C802.422 725.506 765.444 638.822 790.262 571.124C813.586 507.48 882.422 487.711 943.08 522.413C1001.6 555.906 1035.67 630.715 1020.31 693.577C1004.02 760.209 938.102 791.853 871.613 759.355Z" fill="#62DDD1" />
      <path d="M108.301 382.965C7.39462 333.614 -29.7965 232.636 25.8835 164.512C77.5813 101.294 188.372 94.1831 273.208 142.681C354.417 189.188 389.617 274.45 352.639 338.521C313.101 407.143 204.301 429.97 108.23 382.965H108.301Z" fill="#62DDD1" />
    </svg>
  );
}
