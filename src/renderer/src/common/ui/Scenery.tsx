import type { CSSProperties } from "react";

type Kind = "cloud" | "pipe" | "flower" | "coin" | "lock" | "flag" | "hill" | "platform";

const boxes: Record<Kind, string> = {
  cloud: "0 0 100 46",
  pipe: "0 0 56 90",
  flower: "0 0 40 64",
  coin: "0 0 24 32",
  lock: "0 0 58 70",
  flag: "0 0 100 160",
  hill: "0 0 130 95",
  platform: "0 0 100 48",
};

export function Sprite({ kind, className = "", style }: { kind: Kind; className?: string; style?: CSSProperties }) {
  return (
    <svg className={`sprite ${className}`} viewBox={boxes[kind]} style={style} aria-hidden="true">
      <use href={`#world-${kind}`} />
    </svg>
  );
}

export function WorldDefinitions() {
  return (
    <svg className="world-definitions" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pipe-shine">
          <stop stopColor="#075416" />
          <stop offset=".12" stopColor="#2bcc22" />
          <stop offset=".24" stopColor="#afff59" />
          <stop offset=".32" stopColor="#42dc20" />
          <stop offset=".67" stopColor="#109816" />
          <stop offset=".85" stopColor="#087713" />
          <stop offset="1" stopColor="#033d11" />
        </linearGradient>
        <linearGradient id="gold">
          <stop stopColor="#fff083" />
          <stop offset=".35" stopColor="#ffd129" />
          <stop offset="1" stopColor="#e59406" />
        </linearGradient>
        <linearGradient id="hill-green" x2="1" y2="1">
          <stop stopColor="#60ca55" />
          <stop offset="1" stopColor="#18754f" />
        </linearGradient>
        <pattern id="world-bricks" width="48" height="32" patternUnits="userSpaceOnUse">
          <rect width="48" height="32" fill="#814321" />
          <path d="M1 1h45v13H1zM-23 17h45v13h-45zM25 17h45v13H25z" fill="#ba6c32" stroke="#492b19" strokeWidth="2" />
          <path d="M3 3h41M3 19h17M27 19h19" stroke="#e49b57" strokeWidth="3" />
          <path d="M6 7h6v3H6zm24 16h6v3h-6z" fill="#d78641" />
        </pattern>
        <pattern id="world-grass" width="32" height="22" patternUnits="userSpaceOnUse">
          <path d="M0 0h32v12h-4v5h-4v5h-5v-9h-5v5H8v-6H0z" fill="#174b16" />
          <path d="M0 0h32v8h-5v6h-5v-6h-9v5H9V7H0z" fill="#49b71b" />
          <path d="M0 0h32v3H0zM3 3h6v5H3zm14 0h9v4h-9z" fill="#a5e62c" />
        </pattern>
        <g id="world-cloud" shapeRendering="crispEdges">
          <path d="M0 34h7v-8h12V16h10V8h10V2h17v5h9v8h10v11h13v7h9v9H0z" fill="#c2eaff" />
          <path d="M4 32h8v-9h12V13h12V5h18v6h9v12h10v9h13v6H4z" fill="#fff" />
          <path d="M16 33h11v-9h7v13H16zm38-20h7v18h13v5H53zM3 38h91v5H3z" fill="#d8f0ff" />
        </g>
        <g id="world-pipe" shapeRendering="crispEdges" stroke="#12391a" strokeWidth="2">
          <path d="M7 18h42v70H7z" fill="url(#pipe-shine)" />
          <path d="M2 2h52v19H2z" fill="url(#pipe-shine)" />
          <path d="M5 4h44M10 24v59" stroke="#bbff66" strokeWidth="3" />
          <path d="M4 18h48M46 25v60" stroke="#046316" />
          <path d="M5 6h4v9H5z" fill="#eaffb0" stroke="none" />
        </g>
        <g id="world-hill" shapeRendering="crispEdges">
          <path d="M0 95V77h10V59h12V38h13V23h13V9h15V2h16v11h14v19h13v21h12v23h12v19z" fill="#1e7952" />
          <path d="M5 95V77h10V59h12V39h14V23h12V11h22v12h14v22h12v23h12v27z" fill="url(#hill-green)" />
          <path d="M40 43h7v9h-7zm18-19h6v8h-6zm14 40h8v10h-8zm-45 9h7v8h-7z" fill="#94d75b" opacity=".5" />
        </g>
        <g id="world-platform" shapeRendering="crispEdges">
          <path d="M1 4h98v26H83v9H66v8H36v-8H20v-9H1z" fill="url(#world-bricks)" stroke="#432b19" strokeWidth="3" />
          <path d="M2 1h96v21H2z" fill="url(#world-grass)" />
        </g>
        <g id="world-flower" shapeRendering="crispEdges" stroke="#25331b" strokeWidth="2">
          <path d="M18 23h6v30h-6zM17 35H7v-5H3v10h7v4h9zm7 4h8v-5h5v11h-8v4h-6z" fill="#36aa19" />
          <path d="M14 1h12v5h6v6h4v13h-6v6H12v-5H6V12h5V6h3z" fill="#d52912" />
          <path d="M15 5h10v5h5v13h-5v5H14v-5h-4V13h5z" fill="#ff8914" stroke="none" />
          <path d="M17 10h8v13h-9v-4h-3v-5h4z" fill="#ffe249" stroke="none" />
          <path d="M17 10h4v7h-4z" fill="#fff9bc" stroke="none" />
          <path d="M5 52h29v11H5z" fill="#8e5827" />
          <path d="M2 50h9v-5h9v4h9v-4h6v6h3v8H2z" fill="#55bc19" />
          <path d="M7 51h9v3H7zm18-1h6v4h-6z" fill="#b4ed4e" stroke="none" />
        </g>
        <g id="world-coin" shapeRendering="crispEdges">
          <path d="M7 1h11v4h4v23h-5v3H6v-4H2V6h5z" fill="#f0a211" stroke="#684415" strokeWidth="2" />
          <path d="M8 4h8v3h3v18h-4v3H7V24H5V8h3z" fill="url(#gold)" />
          <path d="M9 7v16M16 8v14" stroke="#fff18a" strokeWidth="2" />
        </g>
        <g id="world-lock" shapeRendering="crispEdges">
          <path
            d="M10 29V12h5V5h9V1h14v4h8v7h4v19H39V15h-4V11H24v5h-4v15z"
            fill="url(#gold)"
            stroke="#49351b"
            strokeWidth="3"
          />
          <path d="M4 28h50v39H4z" fill="url(#gold)" stroke="#49351b" strokeWidth="3" />
          <path d="M8 32h4v29H8z" fill="#fff18c" />
          <path d="M26 38h10v9h-3v12h-5V47h-3z" fill="#442b18" />
        </g>
        <g id="world-flag" shapeRendering="crispEdges">
          <path d="M10 6h6v123h-6z" fill="url(#gold)" stroke="#553416" strokeWidth="2" />
          <path d="M8 2h9v9H8z" fill="url(#gold)" stroke="#553416" strokeWidth="2" />
          <path d="M18 12h34v5h41v16h-3v10h5v36H62v-4H18z" fill="#d92220" stroke="#902018" strokeWidth="2" />
          <path d="M20 16h26v3H20z" fill="#fa5b39" />
          <use href="#world-platform" x="0" y="100" width="95" height="45" />
        </g>
      </defs>
    </svg>
  );
}

export function Landscape({ variant = "session" }: { variant?: "session" | "settings" }) {
  return (
    <svg
      className={`landscape landscape-${variant}`}
      viewBox="0 0 300 180"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      <rect width="300" height="180" fill="#54b7fb" />
      <use href="#world-cloud" transform="translate(33 12) scale(.8)" />
      <use href="#world-cloud" transform="translate(218 94) scale(.6)" />
      <use href="#world-hill" transform="translate(100 105) scale(.6)" />
      <use href="#world-hill" transform="translate(181 110) scale(.5)" />
      <path d="M0 157h300v23H0z" fill="url(#world-bricks)" />
      <path d="M0 150h300v22H0z" fill="url(#world-grass)" />
      {variant === "session" && (
        <>
          <use href="#world-pipe" transform="translate(16 67)" />
          <rect x="144" y="35" width="110" height="40" fill="url(#world-bricks)" stroke="#382c1e" strokeWidth="3" />
          <path d="M180 35h37v39h-37z" fill="url(#gold)" stroke="#6c491b" strokeWidth="3" />
          <text
            x="198"
            y="67"
            fill="white"
            stroke="#aa7220"
            strokeWidth=".8"
            textAnchor="middle"
            fontFamily="Pixel"
            fontSize="38"
          >
            ?
          </text>
        </>
      )}
    </svg>
  );
}

export function WorldBackdrop() {
  return (
    <div className="world-backdrop" aria-hidden="true">
      <Sprite kind="cloud" className="cloud cloud-one" />
      <Sprite kind="cloud" className="cloud cloud-two" />
      <Sprite kind="cloud" className="cloud cloud-three" />
      <Sprite kind="cloud" className="cloud cloud-four" />
      <Sprite kind="cloud" className="cloud cloud-five" />
      <svg className="distant-land" viewBox="0 0 600 240" preserveAspectRatio="xMinYMax slice">
        <rect x="50" y="35" width="45" height="205" fill="#308dbc" />
        <path d="M50 35h45v10H50zM50 52h4v188h-4z" fill="#68b6d5" />
        <use href="#world-hill" transform="translate(-15 70) scale(1.8)" />
        <use href="#world-hill" transform="translate(180 95) scale(1.4)" />
        <path d="M0 215h600v25H0z" fill="#3dbeeb" />
        <path d="M0 220h600m-600 10h600" stroke="#8ee0f7" strokeWidth="3" />
      </svg>
    </div>
  );
}
