// Wraps the demo page's html fences marked `preview` in <code-preview>, after poops has
// rendered the markup. Runs on every markup rebuild, so it has to be a no-op the second
// time: the `preview` class is taken off the fence it wraps, and a fence without it no
// longer matches.
import { readFile, writeFile } from 'node:fs/promises';

const page = new URL('../_site/index.html', import.meta.url);
const html = await readFile(page, 'utf8');

const fence = /<pre><code class="hljs language-html preview"([^>]*)>([\s\S]*?)<\/code><\/pre>/g;

const wrapped = html.replace(fence, (_, attributes, code) => {
  const options = / data-tab="options"/.test(attributes) ? ' tab="options"' : '';
  // `head` replaces the frame's default body padding: a background sample is a box that
  // fills the frame, not a paragraph with a margin around it
  return `<code-preview head="<style>body{margin:0}</style>" css="video-background-controls.min.css preview.css" js="video-background.min.js video-background-controls.min.js" manifest="custom-elements.json"${options}>` +
    `<pre><code class="hljs language-html"${attributes.replace(/ data-tab="[^"]*"/, '')}>${code}</code></pre></code-preview>`;
});

if (wrapped !== html) await writeFile(page, wrapped);
