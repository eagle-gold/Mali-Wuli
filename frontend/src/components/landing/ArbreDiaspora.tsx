"use client";

import { useEffect, useId, useState } from "react";
import { BRANCHES } from "./landing-data";
import { clamp, ease, LEAF, LEAF_COLORS, point, segment, spring, tangent, taper } from "./tree-geometry";

/*
 * Baobab illustratif de l'accueil : le tronc est le Mali, chaque branche un
 * pays de la diaspora, chaque feuille un membre. Purement décoratif : aucune
 * feuille ne représente une personne réelle et aucun effectif n'est affiché.
 * L'arbre pousse une fois au chargement (sauf mouvement réduit).
 */

// Coordonnées sérialisées stables : pas d'écart d'hydratation serveur/navigateur.
const svgNumber = (value: number) => Number(value.toFixed(3));
const DUREE_POUSSE_MS = 2600;

const ROOTS = [
  "M470,660 C455,688 420,700 372,710 C428,714 472,712 505,700 Z",
  "M730,660 C745,688 780,700 828,710 C772,714 728,712 695,700 Z",
  "M535,690 C522,702 505,710 486,716 C518,718 545,715 565,705 Z",
  "M665,690 C678,702 695,710 714,716 C682,718 655,715 635,705 Z",
];
const FOLDS = [
  "M540,430 C528,520 522,610 500,700", "M602,424 C608,520 598,612 604,708",
  "M658,430 C672,520 680,610 698,700", "M570,440 C562,520 556,612 546,706",
  "M630,440 C638,520 642,612 652,706",
];
const TRUNK_LEAVES = [[535, 475, -1], [665, 505, 1], [535, 565, -1], [665, 595, 1], [430, 688, -1]] as const;

function usePousse() {
  const [progression, setProgression] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setProgression(1); return; }
    let frame = 0;
    const debut = performance.now();
    const avancer = (maintenant: number) => {
      const suivant = clamp((maintenant - debut) / DUREE_POUSSE_MS);
      setProgression(suivant);
      if (suivant < 1) frame = requestAnimationFrame(avancer);
    };
    frame = requestAnimationFrame(avancer);
    return () => cancelAnimationFrame(frame);
  }, []);
  return progression;
}

export default function ArbreDiaspora({ className = "" }: { className?: string }) {
  const p = usePousse();
  const prefix = useId().replace(/:/g, "");
  const trunkId = `${prefix}-trunk`;
  const textureId = `${prefix}-texture`;
  // Phases : tronc et branches (0 → 0,35), étiquettes, feuilles (0,3 → 0,85), feuille « Vous ? ».
  const bois = ease(clamp(p / 0.35));
  const opacity = clamp(bois * 2);
  const wood: JSX.Element[] = [];
  const leaves: JSX.Element[] = [];
  const labels: JSX.Element[] = [];

  BRANCHES.forEach((branch, index) => {
    const growth = ease(clamp(bois * 1.4 - index * 0.05));
    wood.push(<path key={`branch-${index}`} d={taper(branch, Math.max(growth, 0.001), 34, 7)} fill="#6A4D37" />);
    [0.55, 0.78].forEach((position, twigIndex) => {
      const start = point(branch, position);
      const direction = tangent(branch, position);
      const side = twigIndex ? -1 : 1;
      const end = { x: start.x - direction.y * side * 34 + direction.x * 26, y: start.y + direction.x * side * 34 + direction.y * 26 };
      const twigGrowth = ease(clamp((growth - 0.7) / 0.3));
      wood.push(<path key={`twig-${index}-${twigIndex}`} d={taper(segment(start, end, 0.18 * side), Math.max(twigGrowth, 0.001), 10, 2.5)} fill="#6A4D37" />);
    });
    const tip = point(branch, 1);
    const tipDirection = tangent(branch, 1);
    const forkGrowth = ease(clamp((growth - 0.85) / 0.15));
    [-0.6, 0.55].forEach((angle, forkIndex) => {
      const dx = tipDirection.x * Math.cos(angle) - tipDirection.y * Math.sin(angle);
      const dy = tipDirection.x * Math.sin(angle) + tipDirection.y * Math.cos(angle);
      wood.push(<path key={`fork-${index}-${forkIndex}`} d={taper(segment(tip, { x: tip.x + dx * 40, y: tip.y + dy * 40 }, 0.12), Math.max(forkGrowth, 0.001), 7, 1.8)} fill="#6A4D37" />);
    });
    [0.5, 0.72, 0.93].forEach((position, leafIndex) => {
      const order = leafIndex * 8 + index;
      const start = point(branch, position);
      const direction = tangent(branch, position);
      let nx = -direction.y;
      let ny = direction.x;
      const outside = branch.ex < 600 ? -1 : 1;
      if (nx * outside < 0 || (Math.abs(nx) < 0.2 && ny > 0)) { nx = -nx; ny = -ny; }
      const scale = spring(clamp((p - 0.36 - order * 0.012) / 0.12));
      const angle = (leafIndex % 2 ? -1 : 1) * 12;
      leaves.push(
        <g key={`leaf-${index}-${leafIndex}`} transform={`translate(${svgNumber(start.x + nx * 30)} ${svgNumber(start.y + ny * 30)}) scale(${svgNumber(scale * 1.15)}) rotate(${angle})`}>
          <path d={LEAF} fill={LEAF_COLORS[(index * 3 + leafIndex + index) % LEAF_COLORS.length]} />
          <path d="M-36,0 L36,0" stroke="rgba(253,250,243,0.25)" strokeWidth={1.5} />
        </g>,
      );
    });
    [0.62, 0.85, 1].forEach((position, leafIndex) => {
      const start = point(branch, position);
      const direction = tangent(branch, position);
      const side = leafIndex % 2 ? 1 : -1;
      const x = start.x - direction.y * 22 * side * (leafIndex === 2 ? 0 : 1) + (leafIndex === 2 ? direction.x * 20 : 0);
      const y = start.y + direction.x * 22 * side * (leafIndex === 2 ? 0 : 1) + (leafIndex === 2 ? direction.y * 20 : 0);
      const scale = ease(clamp((p - 0.34 - (index + leafIndex) * 0.012) / 0.1)) * 0.42;
      leaves.push(<path key={`small-${index}-${leafIndex}`} d={LEAF} fill={LEAF_COLORS[(index + leafIndex + 2) % LEAF_COLORS.length]} opacity={0.75} transform={`translate(${svgNumber(x)} ${svgNumber(y)}) rotate(${svgNumber(Math.atan2(direction.y, direction.x) * 57.3)}) scale(${svgNumber(scale)})`} />);
    });
    const labelOpacity = ease(clamp((p - 0.22 - index * 0.015) / 0.1));
    const width = 30 + branch.name.length * 10.4;
    labels.push(
      <g key={`label-${index}`} transform={`translate(${svgNumber(branch.ex + tipDirection.x * 62)} ${svgNumber(branch.ey + tipDirection.y * 62 + (1 - labelOpacity) * 8)})`} opacity={labelOpacity}>
        <rect x={-width / 2} y={-17} width={width} height={34} rx={17} fill="#FDFAF3" stroke="#D8C9B1" />
        <text textAnchor="middle" y={5} fontSize={15} fontWeight={700} letterSpacing={1} fill="#2E261F" fontFamily="var(--font-inter), system-ui, sans-serif">{branch.name.toLocaleUpperCase("fr")}</text>
      </g>,
    );
  });

  const invitation = clamp((p - 0.82) / 0.14);

  return (
    <svg viewBox="70 -45 1060 765" preserveAspectRatio="xMidYMid meet" className={`block h-auto w-full overflow-visible ${className}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={trunkId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#3F2C1E" /><stop offset="0.28" stopColor="#6E5039" /><stop offset="0.45" stopColor="#8C6B4F" /><stop offset="0.62" stopColor="#6E5039" /><stop offset="1" stopColor="#3A281B" />
        </linearGradient>
        <filter id={textureId} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.16" numOctaves={3} seed={4} result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.14  0 0 0 0 0.09  0 0 0 0 0.05  0 0 0 1.7 -0.66" result="grain" />
          <feComposite in="grain" in2="SourceGraphic" operator="in" result="texture" />
          <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="texture" /></feMerge>
        </filter>
      </defs>
      <ellipse cx={600} cy={712} rx={230} ry={12} fill="rgba(62,46,30,0.16)" />
      <g filter={`url(#${textureId})`}>
        {ROOTS.map((path, index) => <path key={index} d={path} fill={`url(#${trunkId})`} opacity={opacity} />)}
        <path d="M455,705 C480,640 466,560 480,500 C490,455 505,430 515,412 L685,412 C695,430 710,455 720,500 C734,560 720,640 745,705 Z" fill={`url(#${trunkId})`} opacity={opacity} />
        {FOLDS.map((path, index) => <path key={index} d={path} fill="none" stroke={index < 3 ? "#2E2016" : "#A5846A"} strokeWidth={index < 3 ? 3 : 2} strokeLinecap="round" opacity={0.35 * opacity} />)}
        {wood}
      </g>
      <text x={600} y={672} textAnchor="middle" fontSize={36} fontWeight={700} letterSpacing={7} fill="#EAD7B9" opacity={opacity} fontFamily="var(--font-playfair), Georgia, serif">MALI</text>
      {TRUNK_LEAVES.map(([x, y, side], index) => (
        <path key={`trunk-leaf-${index}`} d={LEAF} fill={index % 2 ? "#B85C2E" : "#0F5C33"} stroke="#F5EEDF" strokeWidth={1.5} transform={`translate(${x} ${y}) scale(${svgNumber(spring(clamp((p - 0.3 - index * 0.03) / 0.12)) * 1.1)}) rotate(${side * 10})`} />
      ))}
      {leaves}{labels}
      <path d="M600,412 C596,330 606,230 600,150" fill="none" stroke="#6B4A2F" strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - ease(clamp(invitation * 1.5))} />
      <g transform={`translate(600 92) scale(${svgNumber(spring(invitation) * 1.3)})`}>
        <circle r={62} fill="#F4B400" opacity={0.18} />
        <path d={LEAF} fill="#F4B400" stroke="#2E261F" strokeWidth={2} strokeDasharray="5 4" transform="rotate(-14) scale(1.15)" />
        <text textAnchor="middle" y={5.5} fontSize={16} fontWeight={800} fill="#2E261F" fontFamily="var(--font-inter), system-ui, sans-serif">Vous ?</text>
      </g>
    </svg>
  );
}
