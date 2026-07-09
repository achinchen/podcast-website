export function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function excerpt(html, max = 120) {
  const text = stripHtml(html);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
