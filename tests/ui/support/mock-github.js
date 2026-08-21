// Handbook Task 30: admin.js talks directly to api.github.com (no bundler,
// no SDK) — this intercepts those calls via Playwright's page.route(),
// the same "fake the network boundary, run the real app code unmodified"
// approach as mock-supabase.js, so admin.js/index.html run completely
// unchanged against fixture data instead of a real repo.

const yaml = require('js-yaml');

// Minimal-but-complete content/site.yaml shape — every top-level key
// renderForm() reads WITHOUT a defensive fallback must be present here
// (see admin.js), or the form crashes on render before a test can even
// reach the Save button. Sections admin.js defensively initializes on
// its own (nfrsIfrs, internationalHub, internationalAccounting,
// virtualCfo, teamMembers, testimonials, usefulLinks, seo, privacySections)
// are deliberately omitted — proving those fallbacks work is not this
// file's job.
function buildFixtureContent(overrides) {
  const base = {
    brand: {
      legalName: 'Test Consultancy Pvt. Ltd.',
      shortName: 'Test Co',
      mobile: '+977-98-0000-0000',
      whatsappDigits: '9779800000000',
      landline: '',
      email: 'test@example.com',
      addressLine: 'Test Address, Kathmandu, Nepal',
      addressNote: '',
      hours: 'Sunday - Friday',
      mapQuery: 'Kathmandu',
      foundedYear: '2022',
      clientsServed: '100+',
      tagline: 'Test tagline',
      altTagline: '',
      formspreeId: '',
      siteUrl: '',
      cloudflareAnalyticsToken: '',
      googleSiteVerification: '',
      social: { facebook: '', instagram: '', tiktok: '', linkedin: '' },
    },
    trustPoints: ['Point one'],
    pages: [
      { key: 'blog', label: 'Blog', href: 'blog.html', hidden: true },
      { key: 'testimonials', label: 'Testimonials', href: 'testimonials.html', hidden: true },
    ],
    pageHeaders: {},
    aboutText: 'About text', aboutClosing: 'Closing text',
    aboutFacts: ['Fact one'],
    values: [{ title: 'Value', text: 'Text' }],
    serviceCategories: [{ key: 'registration', letter: 'A', title: 'Category A', tagline: 'Tag', icon: 'building', items: ['Item one'] }],
    outsourced: { title: 'Outsourced', paragraph: 'Para', cta: 'CTA', benefits: ['Benefit'] },
    packages: [{ name: 'Package One', audience: 'For X', items: ['Item'] }],
    packagesFeeNote: 'Fee note',
    documentsTopNote: 'Top note', documentGroups: [{ title: 'Group', items: ['Doc'] }], documentsBottomNote: 'Bottom note',
    industries: [{ name: 'Startups', icon: 'rocket', description: 'Desc' }],
    teamMembers: [],
    testimonials: [],
    usefulLinks: [{ name: 'IRD', url: 'https://ird.gov.np/', description: 'desc' }],
    resourcesHub: {
      intro: 'Resources intro',
      tiles: [
        { title: 'Documents Checklist', text: 'Checklist text', cta: 'View Documents Checklist', href: 'documents-needed.html', icon: 'upload' },
        { title: 'Financial Calculators', text: 'Calculators text', cta: 'Use Financial Calculators', href: 'calculators.html', icon: 'percent' },
        { title: 'Useful Links', text: 'Links text', cta: 'View Useful Links', href: 'useful-links.html', icon: 'globe' },
        { title: 'FAQ', text: 'FAQ text', cta: 'Read FAQs', href: 'faq.html', icon: 'shield' },
      ],
    },
    whyChoose: [{ title: 'Reason', text: 'Text' }],
    process: [{ step: 1, title: 'Step', text: 'Text' }],
    faqs: [{ q: 'Question?', a: 'Answer.' }],
    privacySections: [], privacyIntro: 'Intro', privacyLastReviewed: 'August 2026',
    calculators: {
      incomeTaxFYHint: 'hint', deductionCapRetirement: 500000, deductionCapLife: 40000, deductionCapHealth: 20000,
      taxTables: [{
        key: '2082', label: 'FY 2082/83', hasCouple: false, disclaimer: 'disc',
        single: [{ width: 500000, rate: 1, sst: true }, { width: null, rate: 39 }],
        couple: [],
      }],
      vatRate: 13, vatNote: 'note',
      tdsTypes: [{ label: 'Rent (10%)', rate: 10, note: 'note' }],
      tdsNote: 'note',
    },
    seo: {},
    footerDisclaimer: 'Disclaimer', partnerNote: 'Partner note',
    serviceOptions: ['Option 1'],
    businessTypeOptions: ['Type 1'],
  };
  return Object.assign({}, base, overrides);
}

async function installGithubMock(page, opts) {
  opts = opts || {};
  const owner = 'testuser';
  const repo = 'testrepo';
  const contentPath = `/repos/${owner}/${repo}/contents/content/site.yaml`;
  const blogDirPath = `/repos/${owner}/${repo}/contents/content/blog`;

  const state = {
    fixtureContent: opts.fixtureContent || buildFixtureContent(),
    sha: 'fixture-sha-1',
    putCalls: [],
    conflictOnSave: !!opts.conflictOnSave,
    blogFiles: opts.blogFiles || [],
    blogPutCalls: [],
  };

  await page.route('https://api.github.com/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const p = url.pathname;

    if (p === contentPath && method === 'GET') {
      const text = yaml.dump(state.fixtureContent, { lineWidth: 100 });
      const b64 = Buffer.from(text, 'utf8').toString('base64');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sha: state.sha, content: b64, encoding: 'base64' }) });
      return;
    }
    if (p === contentPath && method === 'PUT') {
      let body = {};
      try { body = JSON.parse(request.postData() || '{}'); } catch (e) { /* ignore */ }
      state.putCalls.push(body);
      if (state.conflictOnSave) {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'content/site.yaml does not match the current sha of the branch' }) });
        return;
      }
      state.sha = 'fixture-sha-' + (state.putCalls.length + 1);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: state.sha } }) });
      return;
    }
    if (p === blogDirPath && method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.blogFiles) });
      return;
    }
    if (p.indexOf(blogDirPath + '/') === 0 && method === 'PUT') {
      let body = {};
      try { body = JSON.parse(request.postData() || '{}'); } catch (e) { /* ignore */ }
      state.blogPutCalls.push(body);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'blog-sha-' + state.blogPutCalls.length } }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not mocked in test fixture: ' + method + ' ' + p }) });
  });

  return { owner, repo, token: 'ghp_faketoken1234567890abcdef', state };
}

module.exports = { installGithubMock, buildFixtureContent };
