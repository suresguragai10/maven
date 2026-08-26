const data = require('./data');
const { esc, safeUrl } = require('./escape');
const { icon, stampMark } = require('./icons');
const {
  button, sectionHead, pageHero, accordionItem, industryCard, industryDetail, ctaBand, bulletList, panelLabel,
} = require('./ui');

function documentsNeeded() {
  const h = data.pageHeader('documents-needed');
  const groupsHtml = data.documentGroups.map((g, i) => accordionItem({
    id: `doc-${i}`,
    headingHtml: esc(g.title),
    bodyHtml: bulletList(g.items),
    open: false,
    // Handbook Task 26: h2 -- no sectionHead() (which itself renders an
    // h2) precedes this accordion, so the default h3 would skip a level
    // straight from the page's h1.
    headingLevel: 'h2',
  })).join('');

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/documents-needed-hero-bg.jpg')}

  <section class="section-pad">
    <div class="container" style="max-width:760px">
      <div class="accordion-note reveal">
        ${icon('shield')}
        <p>${esc(data.documentsTopNote)}</p>
      </div>
      <div class="accordion">
        ${groupsHtml}
      </div>
      <div class="info-note reveal" style="margin-top:32px">${esc(data.documentsBottomNote)}</div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Custom Checklist',
    title: 'Get a document checklist made for your exact case',
    subtitle: 'Tell us your business type and what you need — we will confirm the exact list before you send anything.',
    buttons: [button('Get a Customized Document Checklist', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I would like a customized document checklist for my business.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function industries() {
  const h = data.pageHeader('industries');
  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/industries-hero-bg.jpg')}

  <section class="section-pad-sm">
    <div class="container" style="max-width:820px">
      <p class="text-center reveal">Every industry has different transaction flows, cash patterns, and reporting needs. Across all of them, Maven combines day-to-day bookkeeping with practical financial visibility — monitoring cash, collections, payments, costs, and budgets using clear records and owner-friendly reports.</p>
    </div>
  </section>

  <section class="section-pad" style="padding-top:0">
    <div class="container">
      <div class="industry-explorer">
        <ul class="industry-list" aria-label="Select an industry">
          ${data.industries.map(industryCard).join('')}
        </ul>
        <div class="industry-detail-stage" id="industry-detail-stage" aria-live="polite">
          <div class="industry-detail-placeholder" id="industry-detail-placeholder">
            ${panelLabel('Explore by industry')}
            <h2>Select an industry to see common needs and how Maven can help.</h2>
            <p>The list stays compact and scannable; detailed guidance opens here without pushing the page around.</p>
          </div>
          ${data.industries.map(industryDetail).join('')}
        </div>
      </div>
      <p class="text-center tag-note" style="margin-top:28px">Don't see your type of business listed? Reach out — Maven supports most business structures across Nepal.</p>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Tell Us About Your Business',
    title: 'Whatever your industry, we can help you stay organized and compliant',
    subtitle: 'Tell us how your business operates and what records you currently keep — we will recommend a practical mix of accounting, compliance, and reporting support.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button('View Services', 'services.html', 'ghost-light')],
  })}
  `;
}

function faq() {
  const h = data.pageHeader('faq');
  const items = data.faqs.map((f, i) => accordionItem({
    id: `faq-${i}`,
    headingHtml: esc(f.q),
    bodyHtml: `<p>${esc(f.a)}</p>`,
    open: false,
    // Handbook Task 26: same reasoning as documentsNeeded() above -- no
    // preceding h2 on this page.
    headingLevel: 'h2',
  })).join('');

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/faq-hero-bg.jpg')}

  <section class="section-pad">
    <div class="container" style="max-width:760px">
      <div class="accordion">${items}</div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Still Have Questions?',
    title: "We're happy to talk it through",
    subtitle: 'Book a free consultation or send us a message on WhatsApp.',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I have a question about your services.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function contact() {
  const h = data.pageHeader('contact');
  const b = data.brand;
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(b.mapQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle, '/images/contact-hero-bg.jpg')}

  <section class="section-pad-sm">
    <div class="container" style="max-width:760px">
      <div class="text-center reveal" style="margin-bottom:22px">
        <span class="service-icon" style="margin:0 auto 12px">${icon('shield')}</span>
        <h2 style="margin-bottom:8px">How document handling works</h2>
        <p class="tag-note" style="max-width:52ch;margin:0 auto">Your financial information deserves careful handling — see the note by the message field below before you write anything sensitive.</p>
      </div>
      <div class="flow-diagram reveal-stagger">
        ${['Initial Inquiry', 'Scope Confirmation', 'Appropriate Document Method Confirmed', 'Work Begins']
          .map((step, i, arr) => `<div class="flow-step"><span>${esc(step)}</span></div>${i < arr.length - 1 ? `<span class="flow-arrow" aria-hidden="true">${icon('chevronRight')}</span>` : ''}`).join('')}
      </div>
    </div>
  </section>

  <section class="section-pad">
    <div class="container two-col">
      <div class="reveal">
        ${sectionHead({ eyebrow: 'Get In Touch', title: 'Talk to us before submitting any documents', align: 'left' })}
        <div class="contact-info-list">
          <div class="contact-info-item">
            <span class="contact-info-icon">${icon('mapPin')}</span>
            <div><h3>Office</h3><p>${esc(b.addressLine)}<br><span class="tag-note">${esc(b.addressNote)}</span></p></div>
          </div>
          <div class="contact-info-item">
            <span class="contact-info-icon">${icon('phone')}</span>
            <div><h3>Call / WhatsApp</h3><p><a href="${esc(safeUrl(`tel:${b.mobile.replace(/[^\d+]/g, '')}`))}">${esc(b.mobile)}</a>${b.landline ? `<br>${esc(b.landline)} (office)` : ''}</p></div>
          </div>
          <div class="contact-info-item">
            <span class="contact-info-icon">${icon('mail')}</span>
            <div><h3>Email</h3><p><a href="${esc(safeUrl(`mailto:${b.email}`))}">${esc(b.email)}</a></p></div>
          </div>
          <div class="contact-info-item">
            <span class="contact-info-icon">${icon('clock')}</span>
            <div><h3>Hours</h3><p>${esc(b.hours)}</p></div>
          </div>
        </div>
        <div class="contact-whatsapp-cta">
          ${panelLabel('Fastest response')}
          <a class="btn btn-whatsapp" href="${data.whatsappHref('Hello Maven, I would like to send an inquiry.')}" target="_blank" rel="noopener">${icon('whatsapp')} Chat on WhatsApp</a>
        </div>
        <div class="contact-map" style="margin-top:28px">
          <iframe src="${mapSrc}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Maven Consultancy location map"></iframe>
        </div>
      </div>

      <div class="reveal">
        <div class="service-card contact-form-card">
          <h3 style="margin-bottom:6px">Send an Inquiry</h3>
          <p class="tag-note" style="margin-bottom:22px">We'll confirm exactly what your business needs before you send any documents.</p>
          <div id="formError" class="form-error" role="alert" tabindex="-1" hidden></div>
          <form id="inquiryForm" novalidate>
            <!-- Honeypot: hidden from humans, tempting to bots. Real users leave it empty. -->
            <div class="hp-field" aria-hidden="true">
              <label for="f-company-website">Company website</label>
              <input id="f-company-website" name="company_website" type="text" tabindex="-1" autocomplete="off">
            </div>
            <div class="form-grid">
              <div class="form-field">
                <label for="f-name">Full Name</label>
                <input id="f-name" name="name" type="text" autocomplete="name" required>
              </div>
              <div class="form-field">
                <label for="f-business">Business Name <span class="optional">(if any)</span></label>
                <input id="f-business" name="business" type="text" autocomplete="organization">
              </div>
              <div class="form-field">
                <label for="f-phone">Phone Number</label>
                <input id="f-phone" name="phone" type="tel" autocomplete="tel" required>
              </div>
              <div class="form-field">
                <label for="f-email">Email <span class="optional">(optional)</span></label>
                <input id="f-email" name="email" type="email" autocomplete="email">
              </div>
              <div class="form-field">
                <label for="f-service">Service Required</label>
                <select id="f-service" name="service" required>
                  <option value="">Select a service</option>
                  ${data.serviceOptions.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
                </select>
              </div>
              <div class="form-field">
                <label for="f-type">Business Type</label>
                <select id="f-type" name="businessType">
                  <option value="">Select business type</option>
                  ${data.businessTypeOptions.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
                </select>
              </div>
              <div class="form-field full">
                <label for="f-message">Message</label>
                <textarea id="f-message" name="message" required placeholder="Briefly describe what you need help with..."></textarea>
              </div>
            </div>
            <p class="form-hint">Your financial information deserves careful handling. Please do not send sensitive financial records, identification documents, or confidential business information through this general inquiry form. After understanding your requirements, Maven will confirm the appropriate method for document exchange.</p>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">${icon('send')} Send Inquiry</button>
              <span class="form-hint">We typically respond within one business day.</span>
            </div>
          </form>

          <div id="formResult" class="form-result" hidden>
            <h3>Your inquiry is ready to send</h3>
            <p class="tag-note">We couldn't confirm your inquiry was delivered automatically. Please send it using one of the options below so we don't miss it.</p>
            <div class="form-result-summary" id="formSummaryText"></div>
            <div class="form-result-actions">
              <a id="sendEmailLink" class="btn btn-outline" href="#">${icon('mail')} Send via Email</a>
              <a id="sendWhatsAppLink" class="btn btn-whatsapp" href="#" target="_blank" rel="noopener">${icon('whatsapp')} Send via WhatsApp</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
  `;
}

module.exports = { documentsNeeded, industries, faq, contact };
