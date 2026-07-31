# How to add a blog post

The blog is currently **built but hidden** — it's not linked from the menu or
footer yet, so visitors won't stumble onto it, but the whole system works.
When you're ready to launch it publicly, see "Making it public" at the bottom.

## Easiest way: the admin panel

Open `admin/index.html`, connect with your GitHub token, and go to the
**Blog Posts** section in the sidebar. Click **+ Write New Post**, fill in
the title, date, excerpt, and body (Markdown), then click **Publish Post** —
it commits the file straight to GitHub and the site rebuilds automatically.
You can also **Edit** or **Delete** any existing post from the same list.

## Adding a post manually (without the admin panel)

Create a new file in this folder named `content/blog/your-post-slug.md`
(the filename becomes the post's URL, so keep it short, lowercase, and
hyphenated — e.g. `5-common-vat-filing-mistakes.md`).

Paste this at the top, filled in, followed by your post written in Markdown:

```
---
title: "5 Common VAT Filing Mistakes Nepali Businesses Make"
date: "2026-07-15"
excerpt: "A short one or two sentence summary shown on the blog listing page."
---

Write your post here using normal Markdown formatting.

## A subheading

- Bullet points work
- **Bold** and *italic* work
- [Links work too](https://example.com)
```

Commit it (same as any other content change) — the site rebuilds
automatically and the post appears at `blog-your-post-slug.html`.

## Making it public

Right now, two things are deliberately keeping this section hidden:

1. It's **not in the navigation menu or footer** — ask for this to be added
   to `data.js` (the `nav` array) when you're ready.
2. Every blog page has `<meta name="robots" content="noindex, nofollow">` in
   `pages4.js` and `build.js` — this tells search engines to ignore it for
   now. Remove those tags when you want the blog indexed by Google.

Both are quick changes — just ask when you're ready to go live with it.
