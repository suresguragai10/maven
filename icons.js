// Simple line-icon set, 24x24 viewBox, stroke-based (currentColor), Feather-style but original.
// Usage: icon('phone', 'ic ic-sm')

const paths = {
  // UI
  check: '<circle cx="12" cy="12" r="9.2" stroke-dasharray="1 2.4" opacity="0.55"/><path d="M8 12.3l2.6 2.6L16.2 9"/>',
  chevronDown: '<path d="M5 8.5l7 7 7-7"/>',
  chevronRight: '<path d="M8.5 5l7 7-7 7"/>',
  arrowRight: '<path d="M4 12h15.5"/><path d="M13.5 6l6 6-6 6"/>',
  arrowUp: '<path d="M12 19V5"/><path d="M6 10l6-6 6 6"/>',
  menu: '<path d="M3.5 6.5h17"/><path d="M3.5 12h17"/><path d="M3.5 17.5h17"/>',
  close: '<path d="M5.5 5.5l13 13"/><path d="M18.5 5.5l-13 13"/>',
  phone: '<path d="M6.6 3.5h3l1.6 4.2-2 1.7a12.6 12.6 0 0 0 5.4 5.4l1.7-2 4.2 1.6v3a2 2 0 0 1-2.1 2C11.7 19 5 12.3 4.6 5.6a2 2 0 0 1 2-2.1z"/>',
  mail: '<rect x="3.2" y="5.5" width="17.6" height="13" rx="1.8"/><path d="M4 6.8l8 6.4 8-6.4"/>',
  mapPin: '<path d="M12 21.5s7-6.3 7-11.6A7 7 0 0 0 5 9.9c0 5.3 7 11.6 7 11.6z"/><circle cx="12" cy="9.8" r="2.4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.2V12l3.6 2.1"/>',
  shield: '<path d="M12 3.4l7.5 2.7v6c0 5-3.2 8.2-7.5 9.9-4.3-1.7-7.5-4.9-7.5-9.9v-6z"/><path d="M8.7 12.2l2.3 2.3 4.3-4.6"/>',
  whatsapp: '<path d="M12 3.6a8.4 8.4 0 0 0-7.2 12.7L3.6 20.4l4.2-1.1A8.4 8.4 0 1 0 12 3.6z"/><path d="M8.7 8.9c.2-.7.9-.6 1.4-.5.3.1.5.6.7 1 .2.4.5.9.2 1.3-.5.7-1 .5-.8 1.1.4 1 1.6 2.1 2.6 2.5.6.3.5-.3 1.1-.7.4-.3.9 0 1.3.2.4.2.9.4 1 .7.2.5-.1 1.2-.6 1.5-1.1.7-2.5.4-3.9-.3-1.6-.8-3.1-2.2-3.7-3.7-.3-.7-.4-1.5.2-2.1z"/>',
  facebook: '<circle cx="12" cy="12" r="9"/><path d="M13.6 21v-6.4h2.1l.3-2.5h-2.4V10.4c0-.7.2-1.2 1.3-1.2h1.3V7c-.6-.1-1.4-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v1.6H8.6v2.5h2v6.3"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="2.4"/><path d="M7.6 10.2v6.4"/><circle cx="7.6" cy="7.4" r="0.9" fill="currentColor" stroke="none"/><path d="M11.3 16.6v-3.8c0-1.4.9-2.4 2.2-2.4 1.3 0 2 .9 2 2.4v3.8"/><path d="M11.3 10.2v6.4"/>',
  tiktok: '<path d="M14 4c.3 2.1 1.6 3.7 3.8 4v2.3c-1.4 0-2.7-.4-3.8-1.2v5.3c0 2.7-2 4.8-4.6 4.8S4.8 21 4.8 18.4c0-2.5 2-4.5 4.5-4.5.3 0 .6 0 .9.1v2.4c-.3-.1-.6-.2-.9-.2-1.2 0-2.1.9-2.1 2.1s.9 2.1 2.1 2.1c1.2 0 2.2-.9 2.2-2.4V4H14z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>',
  upload: '<path d="M12 15.5V5.3"/><path d="M8 8.7L12 4.6l4 4.1"/><path d="M4.5 15.5v2.7a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.7"/>',
  send: '<path d="M4 11.6L20 4l-6.6 16-2.9-7-6.5-1.4z"/>',
  external: '<path d="M9 6H5.5A2 2 0 0 0 3.5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V15"/><path d="M10 14L20.5 3.5"/><path d="M14.5 3.5H20.5V9.5"/>',
  // Service categories
  building: '<path d="M5 21V6.6L12 3l7 3.6V21"/><path d="M9 21v-5.4h6V21"/><path d="M9 10h1.4M13.6 10H15M9 13.4h1.4M13.6 13.4H15"/>',
  ledger: '<rect x="4.5" y="3.6" width="15" height="16.8" rx="1.6"/><path d="M8 8h8M8 11.4h8M8 14.8h5"/>',
  percent: '<circle cx="8.2" cy="8.2" r="2.4"/><circle cx="15.8" cy="15.8" r="2.4"/><path d="M17.5 6.5L6.5 17.5"/>',
  users: '<circle cx="9" cy="8.6" r="3"/><path d="M3.6 19c.6-3 2.7-4.6 5.4-4.6s4.8 1.6 5.4 4.6"/><circle cx="17" cy="9.4" r="2.3"/><path d="M15.8 14.6c2 .2 3.6 1.6 4.1 4"/>',
  barChart: '<path d="M4.5 20V10.5"/><path d="M11.3 20V4.5"/><path d="M18.1 20v-7.4"/><path d="M3.2 20h17.6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.2 8.8l-2 4.4-4.4 2 2-4.4z"/>',
  link2: '<path d="M10 14.2l4-4.2"/><path d="M9.3 7.4l1.4-1.5a3.4 3.4 0 0 1 5 4.7l-1.5 1.6"/><path d="M14.7 16.6l-1.4 1.5a3.4 3.4 0 0 1-5-4.7l1.5-1.6"/>',
  // Industries
  rocket: '<path d="M12 3.5c2.6 1.4 4.3 4.3 4.3 8.3 0 2-1 4.3-2 5.6l-2.3 1.6-2.3-1.6c-1-1.3-2-3.6-2-5.6 0-4 1.7-6.9 4.3-8.3z"/><circle cx="12" cy="10.6" r="1.7"/><path d="M9.4 16.6L7 19.4M14.6 16.6l2.4 2.8M10.4 19.9l1.6 1.6 1.6-1.6"/>',
  briefcase: '<rect x="3.3" y="7.6" width="17.4" height="11.5" rx="1.8"/><path d="M8.3 7.6V6a2 2 0 0 1 2-2h3.4a2 2 0 0 1 2 2v1.6"/><path d="M3.3 12.4h17.4"/>',
  store: '<path d="M4 9.6L5.3 4h13.4l1.3 5.6"/><path d="M4.6 9.6v10h14.8v-10"/><path d="M4 9.6a2.4 2.4 0 0 0 4.8.3 2.4 2.4 0 0 0 4.8 0 2.4 2.4 0 0 0 4.8 0 2.5 2.5 0 0 0 .1-.3"/>',
  coffee: '<path d="M5.5 9h11.8v5.4a4.6 4.6 0 0 1-4.6 4.6H10a4.6 4.6 0 0 1-4.5-4.6z"/><path d="M17.3 10.4h1.4a2.3 2.3 0 0 1 0 4.6h-1.6"/><path d="M8.4 5.2c-.6.6-.6 1 0 1.7M12 5.2c-.6.6-.6 1 0 1.7"/>',
  hardHat: '<path d="M4 16.2a8 8 0 0 1 16 0z"/><path d="M12 8V5.4"/><path d="M2.8 16.2h18.4"/><path d="M9 5.6a3 3 0 0 1 6 0"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.4 2.4 3.6 5.7 3.6 9s-1.2 6.6-3.6 9c-2.4-2.4-3.6-5.7-3.6-9s1.2-6.6 3.6-9z"/>',
  laptop: '<rect x="4" y="5.4" width="16" height="10.2" rx="1.4"/><path d="M2.6 18.6h18.8"/>',
  graduationCap: '<path d="M2.8 9.6L12 5.4l9.2 4.2L12 13.8z"/><path d="M6.4 11.4v4c0 1.4 2.5 3 5.6 3s5.6-1.6 5.6-3v-4"/>',
  heart: '<path d="M12 20s-7.8-4.6-7.8-10.2A4.4 4.4 0 0 1 12 7.1a4.4 4.4 0 0 1 7.8 2.7C19.8 15.4 12 20 12 20z"/>',
  plane: '<path d="M13.5 6.2L3.4 10l3.5 1.4M13.5 6.2L20.6 3.4 17.8 10.5m-4.3-4.3L11 17.4l-1.4-3.5-3.6-1.4M17.8 10.5L11 17.4M17.8 10.5l-4.3-4.3"/>',
};

function icon(name, cls) {
  const inner = paths[name] || paths.check;
  return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
}

// The site "signature" mark — an organic, slightly hand-stamped seal-check used as
// a recurring bullet / watermark motif (see styles.css .stamp / .bullet-stamp).
function stampMark(cls) {
  return `<svg class="stamp${cls ? ' ' + cls : ''}" viewBox="0 0 40 40" fill="none" aria-hidden="true" focusable="false">
    <circle cx="20" cy="20" r="16.4" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3.2 3.4" opacity="0.75"/>
    <circle cx="20" cy="20" r="12.4" stroke="currentColor" stroke-width="1.1" opacity="0.5"/>
    <path d="M13.6 20.6l4.3 4.3 8.4-9.4" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

module.exports = { icon, stampMark };
