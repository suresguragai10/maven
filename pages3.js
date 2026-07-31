const data = require('./data');
const { esc } = require('./escape');
const { icon, stampMark } = require('./icons');
const {
  button, sectionHead, pageHero, accordionItem, industryBadge, ctaBand, bulletList,
} = require('./ui');

function documentsNeeded() {
  const h = data.pageHeader('documents-needed');
  const groupsHtml = data.documentGroups.map((g, i) => accordionItem({
    id: `doc-${i}`,
    headingHtml: esc(g.title),
    bodyHtml: bulletList(g.items),
    open: i === 0,
  })).join('');

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle)}

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
    buttons: [button('Get a Customized Document Checklist', 'contact.html', 'primary'), button(`${icon('whatsapp')} Ask on WhatsApp`, data.whatsappHref('Hello Maven, I would like a customized document checklist for my business.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function industries() {
  const h = data.pageHeader('industries');
  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle)}

  <section class="section-pad">
    <div class="container">
      <div class="grid grid-4">
        ${data.industries.map(industryBadge).join('')}
      </div>
      <p class="text-center tag-note" style="margin-top:28px">Don't see your type of business listed? Reach out — Maven supports most business structures across Nepal.</p>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Tell Us About Your Business',
    title: 'Whatever your industry, we can help you stay organized and compliant',
    buttons: [button('Book a Free Initial Consultation', 'contact.html', 'primary'), button('View Services', 'services.html', 'outline')],
  })}
  `;
}

function faq() {
  const h = data.pageHeader('faq');
  const items = data.faqs.map((f, i) => accordionItem({
    id: `faq-${i}`,
    headingHtml: esc(f.q),
    bodyHtml: `<p>${esc(f.a)}</p>`,
    open: i === 0,
  })).join('');

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle)}

  <section class="section-pad">
    <div class="container" style="max-width:760px">
      <div class="accordion">${items}</div>
    </div>
  </section>

  ${ctaBand({
    eyebrow: 'Still Have Questions?',
    title: "We're happy to talk it through",
    subtitle: 'Book a free consultation or send us a message on WhatsApp.',
    buttons: [button('Contact Maven Today', 'contact.html', 'primary'), button(`${icon('whatsapp')} WhatsApp Us`, data.whatsappHref('Hello Maven, I have a question about your services.'), 'whatsapp', 'target="_blank" rel="noopener"')],
  })}
  `;
}

function contact() {
  const h = data.pageHeader('contact');
  const b = data.brand;
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(b.mapQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return `
  ${pageHero(h.eyebrow, h.title, h.subtitle)}

  <section class="section-pad">
    <div class="container two-col">
      <div class="reveal">
        ${sectionHead({ eyebrow: 'Get In Touch', title: 'Talk to us before submitting any documents', align: 'left' })}
        <div class="contact-info-list">
          <div class="contact-info-item">
            <span class="contact-info-icon">${icon('mapPin')}</span>
            <div><h4>Office</h4><p>${esc(b.addressLine)}<br><span class="tag-note">${esc(b.addressNote)}</span></p></div>
          </div>
          <div class="contact-info-item">
            <span class="contact-info-icon">${icon('phone')}</span>
            <div><h4>Call / WhatsApp</h4><p>${esc(b.mobile)}${b.landline ? `<br>${esc(b.landline)} (office)` : ''}</p></div>
          </div>
          <div class="contact-info-item">
            <span class="contact-info-icon">${icon('mail')}</span>
            <div><h4>Email</h4><p>${esc(b.email)}</p></div>
          </div>
          <div class="contact-info-item">
            <span class="contact-info-icon">${icon('clock')}</span>
            <div><h4>Hours</h4><p>${esc(b.hours)}</p></div>
          </div>
        </div>
        <a class="btn btn-whatsapp" href="${data.whatsappHref('Hello Maven, I would like to send an inquiry.')}" target="_blank" rel="noopener">${icon('whatsapp')} Chat on WhatsApp</a>
        <div class="contact-map" style="margin-top:28px">
          <iframe src="${mapSrc}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Maven Consultancy location map"></iframe>
        </div>
      </div>

      <div class="reveal">
        <div class="service-card" style="padding:32px">
          <h3 style="margin-bottom:6px">Send an Inquiry</h3>
          <p class="tag-note" style="margin-bottom:22px">We'll confirm exactly what your business needs before you send any documents.</p>
          <div id="formError" class="form-error" hidden></div>
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
              <div class="form-field full">
                <label for="f-file">Upload Document <span class="optional">(optional)</span></label>
                <input id="f-file" name="attachment" type="file">
                <span class="form-hint">This form can't attach files yet — after sending, please email or WhatsApp the document to us directly so we receive it.</span>
              </div>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary">${icon('send')} Send Inquiry</button>
              <span class="form-hint">We typically respond within one business day.</span>
            </div>
          </form>

          <div id="formResult" class="form-result" hidden>
            <h3>Your inquiry is ready to send</h3>
            <p class="tag-note">We couldn't confirm your inquiry was delivered automatically. Please send it using one of the options below so we don't miss it.</p>
            <p class="tag-note" id="formFileNote" hidden><strong>Remember to attach your file</strong> — it isn't included automatically in the email or WhatsApp draft.</p>
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
