import type { ReactNode } from "react";
const art: Record<string, ReactNode> = {
  youtube: (
    <>
      <rect y="4" width="32" height="24" rx="6" fill="#ff0808" />
      <path d="m13 10 10 6-10 6z" fill="white" />
    </>
  ),
  facebook: (
    <>
      <rect width="32" height="32" rx="5" fill="#2382f4" />
      <path d="M19 32V19h5l1-6h-6v-3q0-3 3-3h3V1h-5q-8 0-8 9v3H8v6h4v13z" fill="white" />
    </>
  ),
  x: (
    <>
      <rect width="32" height="32" rx="5" fill="#080808" />
      <path d="M6 5h6l14 22h-6zM24 5h3L8 27H5z" fill="white" />
      <path d="M9 7h2l12 18h-2z" fill="#080808" />
    </>
  ),
  telegram: (
    <>
      <rect width="32" height="32" rx="6" fill="#00aceb" />
      <path d="m4 15 24-9-5 23-8-7-4 4v-7z" fill="white" />
      <path d="m11 19 13-10-9 13-4 4z" fill="#c0e4f1" />
    </>
  ),
  discord: (
    <>
      <rect width="32" height="32" rx="6" fill="#5865f2" />
      <path d="m8 9 5-2 1 2h4l1-2 5 2 4 15-6 3-2-3h-8l-2 3-6-3z" fill="white" />
      <ellipse cx="12" cy="18" rx="2" ry="3" fill="#5865f2" />
      <ellipse cx="20" cy="18" rx="2" ry="3" fill="#5865f2" />
      <path d="m10 23 6 2 6-2" fill="none" stroke="#5865f2" />
    </>
  ),
  spotify: (
    <>
      <circle cx="16" cy="16" r="16" fill="#08ce63" />
      <path
        d="M6 11q11-4 21 2M8 17q9-3 17 2M10 23q7-2 13 1"
        fill="none"
        stroke="#102923"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  ),
  reddit: (
    <>
      <rect width="32" height="32" rx="5" fill="#ff4d12" />
      <path d="m17 12 2-7 7 2" fill="none" stroke="white" strokeWidth="2" />
      <circle cx="26" cy="7" r="3" fill="white" />
      <circle cx="6" cy="16" r="4" fill="white" />
      <circle cx="27" cy="16" r="4" fill="white" />
      <ellipse cx="16" cy="20" rx="12" ry="9" fill="white" />
      <circle cx="11" cy="19" r="2" fill="#ff4d12" />
      <circle cx="21" cy="19" r="2" fill="#ff4d12" />
      <path d="M11 24q5 4 10 0" fill="none" stroke="#ff4d12" strokeWidth="1.5" />
    </>
  ),
  whatsapp: (
    <>
      <rect width="32" height="32" rx="7" fill="#29c663" />
      <path d="M7 25 4 29l7-2a12 12 0 1 0-4-2" fill="none" stroke="white" strokeWidth="2" />
      <path d="m11 8 4 5-2 3q2 4 5 4l2-2 5 3q-1 6-7 3Q7 20 8 11z" fill="white" />
    </>
  ),
  home: <path d="M2 14 16 2l14 12-4 4-2-2v14h-7V20h-5v10H5V16z" fill="currentColor" />,
  monitor: (
    <>
      <path d="M2 3h27v21H2z" fill="#81c8e9" stroke="currentColor" strokeWidth="3" />
      <path d="M5 6h19v13H5z" fill="#4c9dd2" />
      <path d="m6 7 13-1L6 17z" fill="#b6e8fd" />
      <path d="M13 24h6v4h7v3H6v-3h7z" fill="currentColor" />
    </>
  ),
  globe: (
    <>
      <circle cx="16" cy="16" r="14" fill="#73bbd7" stroke="currentColor" strokeWidth="2" />
      <ellipse cx="16" cy="16" rx="7" ry="14" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M2 11h28M2 21h28M16 2v28" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  gamepad: (
    <>
      <path d="M8 5h5l2 3h3l2-3h5l5 9 2 12-5 3-8-8h-7l-7 8-5-3 2-12z" fill="currentColor" />
      <path d="M8 10v10M3 15h10" stroke="#f5ecd8" strokeWidth="3" />
      <circle cx="24" cy="12" r="2" fill="#f5ecd8" />
      <circle cx="27" cy="17" r="2" fill="#f5ecd8" />
    </>
  ),
  settings: (
    <>
      <path
        d="m12 0 8 0 1 5 4 2 4-1 3 7-4 3 1 5 2 3-6 6-4-2-5 1-3 3-7-3 1-5-3-4-4-1 1-8 5-1 3-3z"
        fill="currentColor"
      />
      <circle cx="16" cy="16" r="7" fill="#fff2cf" />
    </>
  ),
  clock: (
    <>
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M16 6v11l6 4" fill="none" stroke="currentColor" strokeWidth="3" />
    </>
  ),
};
export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <svg className={`pixel-icon ${className}`} viewBox="0 0 32 32" aria-hidden="true">
      {art[name.toLowerCase()] ?? (
        <>
          <rect width="32" height="32" rx="5" fill="#4875ee" />
          <text x="16" y="24" textAnchor="middle" fill="white" fontSize="24" fontFamily="Pixel">
            {name.slice(0, 1)}
          </text>
        </>
      )}
    </svg>
  );
}
