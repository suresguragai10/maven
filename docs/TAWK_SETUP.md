# Tawk.to live chat setup

The Maven public site now loads the supplied Tawk.to widget from `client.js` and the public Content Security Policy in `build.js` allows the resources required by the widget. Admin and staff CSPs remain unchanged.

## Already implemented in the repo

- Widget URL: `https://embed.tawk.to/6aaececb3c4ce434465d8a67/1k2tdfjf3`
- CSP-safe loading from the existing external client bundle (no `unsafe-inline` added to `script-src`)
- Tawk CSP allow-list for scripts, styles, fonts, frames, forms, HTTPS connections and WebSockets
- Privacy Policy disclosure for chat content, Tawk.to processing, cookies/local storage/session storage, and sensitive-document guidance
- Cookie notice disclosure for Tawk.to
- Removed the duplicate floating WhatsApp bubble; WhatsApp remains available in normal site CTAs
- Back-to-top control reserves the bottom-right chat-launcher area
- Tawk z-index set below Maven navigation/cookie UI

## Required one-time Tawk dashboard settings

These settings live in the Tawk.to account and cannot be changed from this repository.

1. **Disable file uploads**
   - Administration -> Chat Widget -> Widget Behavior -> Feature Settings
   - Enable **Disable file upload**
   - This is important for a finance/tax/accounting firm so visitors do not send bank statements, IDs, payroll files, tax records, or other confidential documents through general live chat.

2. **Enable the Tawk consent form**
   - Administration -> Chat Widget -> Consent Form -> Configure
   - Configure the European/GDPR form and, if appropriate for your audience, select **All visitors**.
   - Add the website Privacy Policy link.
   - Tawk states that when its consent form is enabled, widget cookies and local storage are not set until the visitor accepts.

3. **Match Maven branding**
   - Administration -> Chat Widget -> Widget Appearance -> Advanced
   - Use a restrained circular launcher.
   - Recommended primary/header color: `#102A4C`
   - Recommended accent: `#C79A3E` where the Tawk editor allows it
   - Keep the Attention Grabber disabled for a calmer professional presentation.

4. **Set realistic availability**
   - Configure the Widget Scheduler or set the widget offline when all agents are offline.
   - Keep offline messaging concise and invite visitors to leave contact details rather than confidential financial information.

5. **Suggested chat safety message**

   `Please do not send confidential financial, tax, payroll, banking, or identity documents through website chat. Our team will provide appropriate document-sharing instructions when required.`

## Verification after deployment

- Open the production site in a private/incognito window.
- Confirm the Tawk launcher appears on desktop and mobile.
- Open browser developer tools and confirm there are no Content Security Policy errors.
- Test online, away, and offline states.
- Confirm file upload is unavailable.
- Confirm the consent form behaves as configured.
- Test the footer area and the back-to-top button at 320px, 390px, 768px, and desktop widths.
