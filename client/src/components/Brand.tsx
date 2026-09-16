import { useAuth } from "../lib/auth";
import { SignOut as LogOut } from "@phosphor-icons/react";

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

/**
 * Light header for the pre-app screens that DON'T use BrandPanel (role
 * select, pending approval, onboarding) so they match the same off-white/
 * white-header look the rest of the app uses once a startup is inside it.
 */
export function AuthHeader({ withSignOut = false }: { withSignOut?: boolean }) {
  const { logout } = useAuth();
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <img src="/logos/logo-navy.svg" alt="Open Startup Platform" className="h-6 w-auto" />
      {withSignOut && (
        <button
          onClick={() => logout()}
          className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-primary"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      )}
    </header>
  );
}

/**
 * Left-side panel: the real "Building The Science Road" pitch-deck slide
 * (client/public/brand-panel.svg, copied verbatim from Desktop/Picture2.svg),
 * rendered as-is and stretched to fill the tall narrow column.
 */
export function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden lg:flex lg:w-[42%]" style={{ background: "#0A193D" }}>
      <img
        src="/brand-panel.svg"
        alt=""
        className="h-full w-full object-cover"
      />
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

/**
 * The bare brand emblem, no wordmark — same official path geometry as
 * LogoMark (and favicon.svg), but sized and coloured via className/fill
 * (currentColor) instead of a fixed 26px turquoise, for places like
 * BrandPanel that want it large and on its own.
 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M665.953 140.192C677.26 205.188 628.904 253.97 553.384 247.001C472.673 239.535 396.513 172.548 388.691 100.228C381.082 30.3258 441.313 -11.843 518.398 2.94806C590.789 16.8858 655.002 77.2592 665.953 140.192Z" />
      <path d="M783.294 834.591C798.156 919.569 747.312 1003.76 663.898 1020.9C573.872 1039.39 486.405 972.831 475.809 874.626C465.569 780.262 531.845 701.969 617.392 696.777C697.107 691.871 769 752.6 783.294 834.591Z" />
      <path d="M921.171 415.452C874.664 447.737 797.935 425.266 752.638 363.043C707.269 300.608 715.233 228.146 767.358 202.972C816.14 179.434 885.9 206.599 925.935 262.065C965.758 317.39 964.691 385.23 921.1 415.452H921.171Z" />
      <path d="M333.156 814.476C244.125 876.2 112.57 860.911 46.9342 774.298C-18.9858 687.258 15.9297 573.694 116.125 525.338C207.574 481.249 320.854 508.485 375.965 582.582C430.863 656.325 414.365 758.085 333.156 814.476Z" />
      <path d="M871.613 759.355C802.422 725.506 765.444 638.822 790.262 571.124C813.586 507.48 882.422 487.711 943.08 522.413C1001.6 555.906 1035.67 630.715 1020.31 693.577C1004.02 760.209 938.102 791.853 871.613 759.355Z" />
      <path d="M108.301 382.965C7.39462 333.614 -29.7965 232.636 25.8835 164.512C77.5813 101.294 188.372 94.1831 273.208 142.681C354.417 189.188 389.617 274.45 352.639 338.521C313.101 407.143 204.301 429.97 108.23 382.965H108.301Z" />
    </svg>
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
