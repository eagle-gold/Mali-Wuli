"use client";

import { useId, useState, type KeyboardEvent, type ReactNode, type SVGProps } from "react";
import { COUNTRIES, PEOPLE, MALI_PEOPLE, type LandingPerson } from "./landing-data";
import { clamp, ease, LEAF, LEAF_COLORS, point, segment, spring, tangent, taper } from "./tree-geometry";
import styles from "./LandingArbre.module.css";

export type TreeSelection = { type: "country"; index: number } | { type: "person"; person: LandingPerson } | { type: "mali" };

type Props = {
  progress: number;
  intro: number;
  selected: TreeSelection | null;
  onSelect: (selection: TreeSelection) => void;
  onClose: () => void;
  onSignup: () => void;
  signupDisabled?: boolean;
  signupLabel?: string;
};

// Stable serialized SVG coordinates avoid server/browser floating-point hydration differences.
const svgNumber = (value: number) => Number(value.toFixed(3));

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

export default function LandingTree({ progress: p, intro, selected, onSelect, onClose, onSignup, signupDisabled = false, signupLabel = "Vous ? Ajouter ma feuille et créer mon profil" }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const prefix = useId().replace(/:/g, "");
  const trunkId = `${prefix}-trunk`;
  const textureId = `${prefix}-texture`;
  const grown = Math.max(intro, clamp(p / 0.03));
  const opacity = clamp(grown * 2);

  const interaction = (label: string, selection: TreeSelection | "signup", visible = true, key?: string): SVGProps<SVGGElement> => ({
    role: "button",
    tabIndex: visible && !(selection === "signup" && signupDisabled) ? 0 : -1,
    "aria-disabled": selection === "signup" && signupDisabled || undefined,
    "aria-label": label,
    "aria-hidden": !visible,
    className: styles.treeControl,
    style: { pointerEvents: visible ? "auto" : "none" },
    onClick: (event) => { event.stopPropagation(); if (selection === "signup") { if (!signupDisabled) onSignup(); } else onSelect(selection); },
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); if (selection === "signup") { if (!signupDisabled) onSignup(); } else onSelect(selection); }
    },
    onMouseEnter: key ? () => setHover(key) : undefined,
    onMouseLeave: key ? () => setHover(null) : undefined,
    onFocus: key ? () => setHover(key) : undefined,
    onBlur: key ? () => setHover(null) : undefined,
  });
  const isPerson = (person: LandingPerson) => selected?.type === "person" && selected.person.name === person.name && selected.person.country === person.country;
  const wood: ReactNode[] = [];
  const leaves: ReactNode[] = [];
  const labels: ReactNode[] = [];

  COUNTRIES.forEach((branch, index) => {
    const growth = ease(clamp(grown * 1.4 - index * 0.05));
    const active = (selected?.type === "country" && selected.index === index) || (selected?.type === "person" && selected.person.country === branch.name);
    wood.push(
      <g key={`branch-${index}`} {...interaction(`Découvrir la branche ${branch.name}`, { type: "country", index }, growth > 0.5, `branch-${index}`)}>
        <path d={taper(branch, Math.max(growth, 0.001), 34, 7)} fill={hover === `branch-${index}` ? "#5A4130" : "#6A4D37"} stroke={active ? "#0F5C33" : "none"} strokeWidth={3} />
      </g>,
    );
    [0.55, 0.78].forEach((progress, twigIndex) => {
      const start = point(branch, progress);
      const direction = tangent(branch, progress);
      const side = twigIndex ? -1 : 1;
      const end = { x: start.x - direction.y * side * 34 + direction.x * 26, y: start.y + direction.x * side * 34 + direction.y * 26 };
      const twigGrowth = ease(clamp((growth - 0.7) / 0.3));
      wood.push(<path key={`twig-${index}-${twigIndex}`} d={taper(segment(start, end, 0.18 * side), Math.max(twigGrowth, 0.001), 10, 2.5)} fill="#6A4D37" pointerEvents="none" />);
    });
    const tip = point(branch, 1);
    const tipDirection = tangent(branch, 1);
    const forkGrowth = ease(clamp((growth - 0.85) / 0.15));
    [-0.6, 0.55].forEach((angle, forkIndex) => {
      const dx = tipDirection.x * Math.cos(angle) - tipDirection.y * Math.sin(angle);
      const dy = tipDirection.x * Math.sin(angle) + tipDirection.y * Math.cos(angle);
      wood.push(<path key={`fork-${index}-${forkIndex}`} d={taper(segment(tip, { x: tip.x + dx * 40, y: tip.y + dy * 40 }, 0.12), Math.max(forkGrowth, 0.001), 7, 1.8)} fill="#6A4D37" pointerEvents="none" />);
    });
    [0.5, 0.72, 0.93].forEach((position, leafIndex) => {
      const personIndex = index * 3 + leafIndex;
      const person = PEOPLE[personIndex];
      const order = leafIndex * 8 + index;
      const start = point(branch, position);
      const direction = tangent(branch, position);
      let nx = -direction.y;
      let ny = direction.x;
      const outside = branch.ex < 600 ? -1 : 1;
      if (nx * outside < 0 || (Math.abs(nx) < 0.2 && ny > 0)) { nx = -nx; ny = -ny; }
      const growthProgress = clamp((p - 0.26 - order * 0.013) / 0.06);
      const scale = spring(growthProgress);
      const key = `leaf-${personIndex}`;
      const activePerson = isPerson(person);
      const angle = (leafIndex % 2 ? -1 : 1) * 12;
      leaves.push(
        <g key={key} transform={`translate(${svgNumber(start.x + nx * 30)} ${svgNumber(start.y + ny * 30)}) scale(${svgNumber(scale * 1.3 * (hover === key || activePerson ? 1.1 : 1))})`} {...interaction(`${person.name}, ${person.job}, ${person.city}.`, { type: "person", person }, growthProgress > 0.5, key)}>
          <path d={LEAF} fill={LEAF_COLORS[(personIndex * 2 + index) % LEAF_COLORS.length]} transform={`rotate(${angle})`} stroke={activePerson ? "#FDFAF3" : "none"} strokeWidth={3} />
          <path d="M-36,0 L36,0" stroke="rgba(253,250,243,0.22)" strokeWidth={1.5} transform={`rotate(${angle})`} />
          <text textAnchor="middle" y={4.5} fontSize={15} fontWeight={700} fill="#FDFAF3" className={styles.svgBody}>{person.name}</text>
        </g>,
      );
    });
    [0.62, 0.85, 1].forEach((position, leafIndex) => {
      const start = point(branch, position);
      const direction = tangent(branch, position);
      const side = leafIndex % 2 ? 1 : -1;
      const x = start.x - direction.y * 22 * side * (leafIndex === 2 ? 0 : 1) + (leafIndex === 2 ? direction.x * 20 : 0);
      const y = start.y + direction.x * 22 * side * (leafIndex === 2 ? 0 : 1) + (leafIndex === 2 ? direction.y * 20 : 0);
      const scale = ease(clamp((p - 0.24 - (index + leafIndex) * 0.012) / 0.05)) * 0.42;
      leaves.push(<path key={`small-${index}-${leafIndex}`} d={LEAF} fill={LEAF_COLORS[(index + leafIndex + 2) % LEAF_COLORS.length]} opacity={0.75} transform={`translate(${svgNumber(x)} ${svgNumber(y)}) rotate(${svgNumber(Math.atan2(direction.y, direction.x) * 57.3)}) scale(${svgNumber(scale)})`} pointerEvents="none" />);
    });
    const labelOpacity = ease(clamp((p - 0.03 - index * 0.018) / 0.05));
    const width = 30 + branch.name.length * 10.4;
    labels.push(
      <g key={`label-${index}`} transform={`translate(${svgNumber(branch.ex + tipDirection.x * 62)} ${svgNumber(branch.ey + tipDirection.y * 62 + (1 - labelOpacity) * 8)})`} opacity={labelOpacity} {...interaction(`Découvrir la branche ${branch.name}`, { type: "country", index }, labelOpacity > 0.5)}>
        <rect x={-width / 2} y={-17} width={width} height={34} rx={17} fill={active ? "#0F5C33" : "#FDFAF3"} stroke={active ? "#0F5C33" : "#D8C9B1"} />
        <text textAnchor="middle" y={4.5} fontSize={16} fontWeight={700} letterSpacing={1} fill={active ? "#FDFAF3" : "#1A1410"} className={styles.svgBody}>{branch.name.toLocaleUpperCase("fr")}</text>
      </g>,
    );
  });

  const invitationProgress = clamp((p - 0.64) / 0.08);
  const invitationStart = point(COUNTRIES[4], 0.6);

  return (
    <svg viewBox="70 -45 1060 765" preserveAspectRatio="xMidYMid meet" className={styles.treeSvg} aria-label="L’arbre de la diaspora : le Mali, les pays et leurs feuilles" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <title>L’arbre de la diaspora</title>
      <desc>Le tronc représente le Mali, les branches les pays, et les feuilles des profils. Activez une branche ou une feuille pour la découvrir.</desc>
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
      <ellipse cx={600} cy={712} rx={230} ry={12} fill="rgba(62,46,30,0.16)" pointerEvents="none" />
      <g filter={`url(#${textureId})`}>
        {ROOTS.map((path, index) => <path key={index} d={path} fill={`url(#${trunkId})`} opacity={opacity} pointerEvents="none" />)}
        <g {...interaction("Découvrir le Mali, le tronc du réseau", { type: "mali" }, opacity > 0.5)} opacity={opacity}>
          <path d="M455,705 C480,640 466,560 480,500 C490,455 505,430 515,412 L685,412 C695,430 710,455 720,500 C734,560 720,640 745,705 Z" fill={`url(#${trunkId})`} stroke={selected?.type === "mali" ? "#0F5C33" : "none"} strokeWidth={4} />
        </g>
        {FOLDS.map((path, index) => <path key={index} d={path} fill="none" stroke={index < 3 ? "#2E2016" : "#A5846A"} strokeWidth={index < 3 ? 3 : 2} strokeLinecap="round" opacity={0.35 * opacity} pointerEvents="none" />)}
        {wood}
      </g>
      <text x={600} y={672} textAnchor="middle" fontSize={36} fontWeight={700} letterSpacing={7} fill="#EAD7B9" className={styles.svgHeading} pointerEvents="none">MALI</text>
      {TRUNK_LEAVES.map(([x, y, side], index) => {
        const person = MALI_PEOPLE[index];
        const growth = clamp((p - 0.1 - index * 0.02) / 0.05);
        const key = `trunk-leaf-${index}`;
        const active = isPerson(person);
        return (
          <g key={key} transform={`translate(${x} ${y}) scale(${svgNumber(spring(growth) * 1.3 * (hover === key || active ? 1.1 : 1))})`} {...interaction(`${person.name}, ${person.job}, ${person.city}.`, { type: "person", person }, growth > 0.5, key)}>
            <path d={LEAF} fill={index % 2 ? "#B85C2E" : "#0F5C33"} stroke={active ? "#FDFAF3" : "#F5EEDF"} strokeWidth={active ? 3 : 1.5} transform={`rotate(${side * 10})`} />
            <text textAnchor="middle" y={4.5} fontSize={15} fontWeight={700} fill="#FDFAF3" className={styles.svgBody}>{person.name}</text>
          </g>
        );
      })}
      {leaves}{labels}
      <path d={`M${svgNumber(invitationStart.x)},${svgNumber(invitationStart.y)} Q745,190 782,126`} fill="none" stroke="#6B4A2F" strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - ease(clamp(invitationProgress * 1.5))} pointerEvents="none" />
      <g transform={`translate(792 110) scale(${svgNumber(spring(invitationProgress) * 1.3)})`} {...interaction(signupLabel, "signup", invitationProgress > 0.5)}>
        <circle r={62} fill="#D9A21B" className={styles.halo} pointerEvents="none" />
        <path d={LEAF} fill="#E7B634" stroke="#1A1410" strokeWidth={2} strokeDasharray="5 4" transform="rotate(-14) scale(1.15)" />
        <text textAnchor="middle" y={5.5} fontSize={16} fontWeight={800} fill="#1A1410" className={styles.svgBody}>Vous ?</text>
      </g>
    </svg>
  );
}
