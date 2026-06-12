/** Convierte el markdown semi-HTML de Archives of Nethys a HTML mostrable. */

const AON = "https://2e.aonprd.com";

export function aonToHtml(md: string): string {
  if (!md) return "";
  let h = md;
  // títulos propios de AoN
  h = h.replace(/<title[^>]*>([\s\S]*?)<\/title>/g, (_m, inner) => `<h3 class="aon-title">${inner}</h3>`);
  h = h.replace(/<actions string="([^"]*)"\s*\/>/g, (_m, s) => ` <span class="action-badge">${s}</span>`);
  h = h.replace(/<trait label="([^"]*)"[^>]*\/>/g, (_m, t) => `<span class="trait-chip">${t}</span>`);
  h = h.replace(/<\/?traits>/g, "");
  h = h.replace(/<\/?(column|row|additional-info|summary)[^>]*>/g, "");
  // enlaces -> AoN legacy
  h = h.replace(/\[([^\]]+)\]\((\/[^)]+)\)/g, (_m, txt, url) =>
    `<a href="${AON}${url}${url.includes("?") ? "&" : "?"}NoRedirect=1" target="_blank" rel="noreferrer">${txt}</a>`);
  // markdown básico
  h = h.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  h = h.replace(/\*([^*\n]+)\*/g, "<i>$1</i>");
  h = h.replace(/^---$/gm, "<hr/>");
  h = h.replace(/\r\n/g, "\n").replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br/>");
  return `<p>${h}</p>`;
}

export function AonMarkdown({ md }: { md: string }) {
  return <div className="aon-md" dangerouslySetInnerHTML={{ __html: aonToHtml(md) }} />;
}
