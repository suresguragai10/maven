// Shared fixtures for the public-site smoke suite: the page set and
// viewport widths used by the overflow check, plus the desktop nav's
// expected top-level structure (kept here once so home.spec.js and
// hidden-links.spec.js don't duplicate it and drift apart).

module.exports = {
  // A representative slice of the site, not every page: enough variety
  // (hero, cards, forms, long content) to catch layout overflow without
  // multiplying every width by all ~20 pages.
  OVERFLOW_PAGES: ['/', '/faq', '/industries', '/contact', '/services', '/documents-needed'],

  // Matches the task's required breakpoint set exactly.
  OVERFLOW_WIDTHS: [320, 360, 390, 430, 768, 1024, 1280, 1440],

  // href, label pairs as rendered by layout.js's navStructure -> desktop
  // <nav class="main-nav">. Order matters (mirrors the visual order).
  DESKTOP_TOP_LEVEL_NAV: [
    { label: 'About', href: '/about' },
    { label: 'Services', href: '/services' },
    { label: 'Industries', href: '/industries' },
    { label: 'International', href: '/global-outsourcing' },
    { label: 'Resources', href: '/resources' },
    { label: 'Contact', href: '/contact' },
  ],
};
