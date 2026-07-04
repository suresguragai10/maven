const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { marked } = require('marked');

const BLOG_DIR = path.join(__dirname, 'content', 'blog');

function slugFromFilename(filename) {
  return filename.replace(/\.md$/i, '').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function formatDateLong(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Splits a file's text into {frontmatter, body} using leading --- ... --- markers.
function splitFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta = yaml.load(match[1]) || {};
  return { meta, body: match[2] || '' };
}

function loadPosts() {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const files = fs.readdirSync(BLOG_DIR).filter((f) => {
    if (!f.toLowerCase().endsWith('.md')) return false;
    if (f.toLowerCase() === 'readme.md') return false; // documentation file, not a post
    return true;
  });

  const posts = files.map((filename) => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, filename), 'utf8');
    const { meta, body } = splitFrontmatter(raw);
    const slug = meta.slug || slugFromFilename(filename);
    return {
      slug,
      title: meta.title || filename,
      date: meta.date || '',
      dateDisplay: meta.date ? formatDateLong(meta.date) : '',
      excerpt: meta.excerpt || '',
      contentHtml: marked.parse(body || ''),
      file: `blog-${slug}.html`,
    };
  });

  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return posts;
}

module.exports = { loadPosts };
