import { notebookFixture } from '../fixtures/notebook-snapshot.js';

// Synthetic 5,000-record product-shaped fixture shared by isolated capacity probes.
export function fullCapacityFixture() {
  const value = notebookFixture(); const template = value.notes.n1; value.notes = {};
  const quote = '引😀'.repeat(3000); // 6000 Unicode code points, within default 8000.
  for (let index = 0; index < 5000; index++) {
    const id = `n${index}`;
    value.notes[id] = { ...structuredClone(template), id,
      bodyMarkdown: 'Markdown评论\r\n'.repeat(180),
      quote: { format: 'plain_text', content: quote },
      anchor: { exact: quote, prefix: 'before', suffix: 'after', startOffset: 0, endOffset: quote.length },
    };
  }
  return value;
}
