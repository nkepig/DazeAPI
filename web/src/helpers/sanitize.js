import DOMPurify from 'dompurify';

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('rel', 'noopener noreferrer');
    node.setAttribute('target', '_blank');
  }
});

export function safeHtml(html) {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'a', 'abbr', 'acronym', 'address', 'b', 'big', 'blockquote', 'br',
      'center', 'cite', 'code', 'col', 'colgroup', 'dd', 'del', 'dfn',
      'div', 'dl', 'dt', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'hr', 'i', 'img', 'ins', 'kbd', 'li', 'mark', 'ol', 'p', 'pre',
      's', 'samp', 'small', 'span', 'strike', 'strong', 'sub', 'sup',
      'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'tt', 'u',
      'ul', 'var', 'wbr', 'details', 'summary', 'figure', 'figcaption',
      'article', 'section', 'nav', 'aside', 'header', 'footer', 'main',
      'style', 'input',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id', 'style', 'target',
      'rel', 'name', 'value', 'type', 'width', 'height', 'colspan',
      'rowspan', 'align', 'valign', 'scope', 'start', 'reversed',
      'loading', 'decoding', 'data-*',
    ],
    ALLOW_DATA_ATTR: true,
  });
}