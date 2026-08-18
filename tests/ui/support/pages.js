// Shared fixtures for the public-site smoke and responsive QA suites.
// Keep route/viewport coverage centralized so individual specs do not drift.

const PUBLIC_QA_PAGES = [
  '/',
  '/about',
  '/services',
  '/outsourced-accounting',
  '/global-outsourcing',
  '/international-accounting',
  '/virtual-cfo',
  '/nfrs-ifrs',
  '/packages',
  '/documents-needed',
  '/industries',
  '/resources',
  '/useful-links',
  '/calculators',
  '/faq',
  '/contact',
  '/team',
  '/testimonials',
  '/privacy',
  '/blog',
];

module.exports = {
  // Batch 2C broadens the old representative overflow slice to every
  // generated public route, including the deliberately hidden/noindex Blog
  // and Testimonials pages. Hidden pages still need robust responsive layout
  // when opened directly by an editor or reviewer.
  PUBLIC_QA_PAGES,
  OVERFLOW_PAGES: PUBLIC_QA_PAGES,

  // Exact responsive matrix required by the professional handbook / Task 13.
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
