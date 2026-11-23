import { h, panel } from './dom';

const DOCS = [
  { file: 'physics.pdf', title: 'Physics notes', blurb: 'models, forces, assumptions' },
  { file: 'math.pdf', title: 'Math notes', blurb: 'numerical methods and their errors' },
  { file: 'code.pdf', title: 'Code notes', blurb: 'architecture and design' },
];

/** Links to the living documents (PDFs served from docs/ next to the app). */
export function createDocsPanel(): HTMLElement {
  const p = panel(
    'Documentation',
    h(
      'ul',
      { class: 'doc-links' },
      ...DOCS.map((d) =>
        h('li', {}, h('a', { href: `docs/${d.file}`, target: '_blank', rel: 'noopener', text: d.title }), h('span', { class: 'muted', text: ` · ${d.blurb}` })),
      ),
    ),
  );
  p.open = false; // collapsed by default to keep the sidebar short
  return p;
}
