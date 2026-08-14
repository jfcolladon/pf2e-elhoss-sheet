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

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const SAVE_RE = /^\*\s*(Critical Success|Success|Failure|Critical Failure|Éxito crítico|Éxito|Fallo crítico|Fallo)\s*:\s*(.*)$/i;

function inline(s: string): string {
  let h = esc(s);
  h = h.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  h = h.replace(/\[one-action\]/gi, '<span class="action-badge">1 acción</span>');
  h = h.replace(/\[two-actions\]/gi, '<span class="action-badge">2 acciones</span>');
  h = h.replace(/\[three-actions\]/gi, '<span class="action-badge">3 acciones</span>');
  h = h.replace(/\[reaction\]/gi, '<span class="action-badge">Reacción</span>');
  h = h.replace(/\[free-action\]/gi, '<span class="action-badge">Libre</span>');
  return h;
}

function splitRow(line: string): string[] {
  return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

function isSepRow(line: string): boolean {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c.replace(/\s/g, "")));
}

/** Renderiza texto del manual de house rules. No enlaza ni cita Archives of Nethys. */
export function houseRuleToHtml(text: string): string {
  if (!text) return "";
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("|") && i + 1 < lines.length && isSepRow(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|") && !isSepRow(lines[i])) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      html.push("<table><thead><tr>");
      for (const h of header) html.push(`<th>${inline(h)}</th>`);
      html.push("</tr></thead><tbody>");
      for (const row of rows) {
        html.push("<tr>");
        for (let c = 0; c < header.length; c += 1) html.push(`<td>${inline(row[c] ?? "")}</td>`);
        html.push("</tr>");
      }
      html.push("</tbody></table>");
      continue;
    }
    if (SAVE_RE.test(line.trim())) {
      html.push('<div class="save-ladder">');
      while (i < lines.length && SAVE_RE.test(lines[i].trim())) {
        const m = lines[i].trim().match(SAVE_RE);
        if (m) {
          html.push(`<div class="save-row"><span class="save-deg">${esc(m[1])}</span> ${inline(m[2])}</div>`);
        }
        i += 1;
      }
      html.push("</div>");
      continue;
    }
    if (line.trim().startsWith("* ")) {
      html.push("<ul>");
      while (i < lines.length && lines[i].trim().startsWith("* ")) {
        html.push(`<li>${inline(lines[i].trim().slice(2))}</li>`);
        i += 1;
      }
      html.push("</ul>");
      continue;
    }
    if (!line.trim()) {
      i += 1;
      continue;
    }
    html.push(`<p>${inline(line)}</p>`);
    i += 1;
  }
  return html.join("");
}

export function HouseRuleMarkdown({ md }: { md: string }) {
  return <div className="house-md" dangerouslySetInnerHTML={{ __html: houseRuleToHtml(md) }} />;
}
