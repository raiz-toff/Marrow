/** One icon language for all chrome: Lucide geometry — a 24-unit grid,
 *  stroke 2, round caps/joins — rendered at 16px (12–14px in dense spots). */
const ic = (paths: string, size = 16): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const I = {
  panelLeft: ic('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>', 18),
  magnifier: ic('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 14),
  moon: ic('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  moon13: ic('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>', 13),
  sun: ic(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    13,
  ),
  tag: ic(
    '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
  ),
  plug: ic('<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>'),
  pulse: ic(
    '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  ),
  map: ic(
    '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  ),
  image: ic(
    '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  ),
  vector: ic('<circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><path d="M5 17A12 12 0 0 1 17 5"/>'),
  network: ic(
    '<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="m5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>',
    18,
  ),
  layers: ic(
    '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    18,
  ),
  panelRight: ic('<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/>', 18),
  magnifier18: ic('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>', 18),
  home: ic(
    '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  ),
  building: ic(
    '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
  ),
  list: ic('<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/>'),
  /* The Marrow mark: the "rr" of the wordmark, the second shoulder resolving
     into an arrowhead. Monochrome here — the accent colour the docs logo uses
     can't survive in chrome that inherits currentColor. */
  logo: ic('<path d="M5 20V10a4 4 0 0 1 4-4"/><path d="M13 20V10"/><path d="M13 10a4 4 0 0 1 4-4h2"/><path d="m17.2 4.2 1.8 1.8-1.8 1.8"/>', 18),
  github: ic(
    '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
    14,
  ),
  pin: ic(
    '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  ),
  x: ic('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  plus: ic('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  minus: ic('<path d="M5 12h14"/>'),
  maximize: ic(
    '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  ),
  chevronRight: ic('<path d="m9 18 6-6-6-6"/>', 12),
  command: ic('<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>'),
};

export const NAV_ICON: Record<string, string> = {
  overview: I.home,
  zone: I.building,
  inventory: I.list,
};
