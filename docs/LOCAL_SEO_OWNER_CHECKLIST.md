# Local SEO Owner Checklist (Task 13)

This is an **owner action checklist**, not a status report — it doesn't claim any of these external accounts exist or are already configured, since that can't be verified from inside this repository. Everything on the site itself (structured data, Contact page, footer) was audited and fixed in this task; the items below are things only the business owner can do, using accounts outside this codebase.

## The one canonical NAP (Name, Address, Phone) to use everywhere

Copy this exactly, character for character, into every external listing. Consistency (not just correctness) is what search engines and directories check — a listing that spells the address slightly differently than another one is treated as a signal of *un*trustworthy data, even if both versions are individually accurate.

| Field | Exact value | Source in this repo |
|---|---|---|
| Legal name | `Maven Consultancy Services Pvt. Ltd.` | `content/site.yaml` → `brand.legalName` |
| Short/display name | `Maven Consultancy` | `brand.shortName` |
| Address | `Eyeplex Mall, New Baneshwor, Kathmandu, Nepal` | `brand.addressNote` + `brand.addressLine` (now combined this way in structured data too, see below) |
| Phone | `+977-98-4827-3802` | `brand.mobile` |
| Email | `info@mavennepal.com.np` | `brand.email` |
| Hours | Sunday–Friday, 10:00 AM–5:00 PM (Saturday closed) | `brand.hours` |
| Website | `https://mavennepal.com.np` | `brand.siteUrl` |

If any of these ever changes, update it **once** in `content/site.yaml` via Website Content Admin — the site itself will pick it up everywhere automatically (footer, Contact page, structured data all read from the same source, confirmed in this task's audit). But external listings (Google Business Profile, directories) do **not** auto-update — each one needs to be edited by hand whenever this table changes.

## Google Business Profile

- [ ] Confirm whether a Google Business Profile listing already exists for this business (search Google Maps/Search for the exact legal name above). If one exists but was set up by someone else or predates this checklist, claim/verify ownership through Google's standard process before editing it.
- [ ] If none exists, create one using the exact NAP table above — category should reflect real service scope (e.g. "Accounting firm," "Tax consultant," "Business management consultant" — pick from Google's own category list, don't invent a category that doesn't match what the business actually does).
- [ ] Complete Google's own address verification step (postcard, phone, or video — whichever Google offers) — this is Google's process, not something this checklist can do for you.
- [ ] Set the same hours, phone, and website URL as the table above.
- [ ] **Do not add reviews, ratings, or star counts yourself** — those must come from real customers through Google's own review flow. A business self-adding or soliciting fake reviews violates Google's policy and this task's explicit "do not invent reviews/ratings" instruction.
- [ ] **Do not list a second branch/location** unless one genuinely and separately exists — a single real office should have exactly one listing.
- [ ] Only use real, currently-held credentials in the profile (e.g. don't add a "Certified" or "Registered" badge/description unless it's an actual, current registration — see the "never invent... certifications" instruction this task and prior content-review tasks both carry).

## Google Search Console

- [ ] Verify domain ownership for `https://mavennepal.com.np` (DNS TXT record, HTML file, or meta tag — whichever method is easiest to set up with the current DNS/hosting provider).
- [ ] Submit the sitemap: `https://mavennepal.com.np/sitemap.xml` (already built and tested — confirmed well-formed, 18 URLs, no duplicates, `test/seo.test.js`).
- [ ] After verification, check the "Pages" report periodically for any pages Google flags as excluded/not indexed that should be indexable — cross-reference against the 18-page inventory in `docs/SEO_INTENT_MAP.md` if something looks wrong.
- [ ] Check the "Enhancements" → structured data report for any errors on the `AccountingService` or `FAQPage` blocks — both are validated locally (`test/seo.test.js`) but Search Console will confirm how Google itself actually parses them in practice.

## Professional directory NAP consistency

This is a discipline checklist, not a list of specific directories — this repo has no way to know which directories the business is or should be listed on. For every directory used (examples: Yellow Pages-style Nepal business directories, industry-specific accounting/consultancy directories, Nepal Chamber of Commerce-type listings, etc.):

- [ ] Use the exact NAP table above, not a paraphrased or abbreviated version.
- [ ] Only claim/create a listing for real, verifiable facts — do not add a registration number, license number, or professional certification to any directory profile unless it is a real, currently-valid one the business actually holds.
- [ ] Do not add a price range unless a directory requires one and a genuinely accurate range can be given — do not invent a price tier to fill in a required field.
- [ ] Periodically (e.g. every 6–12 months) re-check each listed directory against the NAP table above — directories occasionally get edited by third parties (data aggregators, previous listings) without the business's involvement, and drift is common.

## What this task deliberately did not do

Per this task's own "do not invent" instruction, nothing below was added anywhere in the codebase or this checklist:
- No GPS coordinates (`geo`/`latitude`/`longitude` in structured data) — none were configured, and none were guessed.
- No review/rating/aggregateRating structured data — no real reviews exist yet on the site (Testimonials page is still hidden pending real, approved content, per standing project rules).
- No second branch/location.
- No registration or license numbers.
- No certifications/credentials beyond what the site already states elsewhere (e.g. the existing "not a licensed audit firm" disclaimer already on every page's footer).
- No price ranges (Packages page already deliberately says "Quote after review," not a fixed price).
