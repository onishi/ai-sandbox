import type { PrefectureCode, Zoo } from "./types";
import { zoos } from "./data";

const PREF_LABELS: Record<PrefectureCode, string> = {
  osaka: "大阪府",
  kyoto: "京都府",
  hyogo: "兵庫県",
  nara: "奈良県",
  shiga: "滋賀県",
  wakayama: "和歌山県",
};

const PREF_CODES = Object.keys(PREF_LABELS) as PrefectureCode[];

function isPrefectureCode(value: string): value is PrefectureCode {
  return PREF_CODES.includes(value as PrefectureCode);
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function notFound(message: string): Response {
  return jsonResponse({ error: message }, 404);
}

function filterZoos(pref?: string | null): Zoo[] {
  if (!pref) return zoos;
  if (!isPrefectureCode(pref)) return [];
  return zoos.filter((z) => z.prefecture === pref);
}

function renderZooCard(zoo: Zoo): string {
  const prefLabel = PREF_LABELS[zoo.prefecture];
  const features = zoo.features.map((f) => `<span class="tag">${f}</span>`).join("");
  return `
    <article class="zoo-card" id="${zoo.id}">
      <h2><a href="${zoo.website}" target="_blank" rel="noopener noreferrer">${zoo.name}</a></h2>
      <p class="kana">${zoo.nameKana}</p>
      <dl>
        <dt>都道府県</dt><dd>${prefLabel}</dd>
        <dt>住所</dt><dd>${zoo.address}</dd>
        <dt>開園時間</dt><dd>${zoo.openingHours}</dd>
        <dt>休園日</dt><dd>${zoo.closedDays}</dd>
        <dt>入園料</dt><dd>${zoo.admission}</dd>
      </dl>
      <div class="features">${features}</div>
    </article>`;
}

function renderPrefTab(code: PrefectureCode, label: string, active: boolean): string {
  const cls = active ? 'class="tab active"' : 'class="tab"';
  return `<a href="/?pref=${code}" ${cls}>${label}</a>`;
}

function renderHtml(filteredZoos: Zoo[], activePref: string | null): string {
  const cards = filteredZoos.map(renderZooCard).join("\n");
  const allTab = activePref ? '<a href="/" class="tab">すべて</a>' : '<a href="/" class="tab active">すべて</a>';
  const prefTabs = PREF_CODES.map((code) =>
    renderPrefTab(code, PREF_LABELS[code], code === activePref)
  ).join("\n");

  const count = filteredZoos.length;
  const prefLabel = activePref && isPrefectureCode(activePref) ? PREF_LABELS[activePref] : "近畿一円";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #f7f9fc; color: #333; }
    header { background: #2d6a4f; color: #fff; padding: 1rem 1.5rem; }
    header h1 { font-size: 1.5rem; }
    header p { font-size: 0.9rem; opacity: 0.85; margin-top: 0.25rem; }
    .tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 1rem 1.5rem; background: #fff; border-bottom: 1px solid #ddd; }
    .tab { padding: 0.4rem 0.9rem; border-radius: 999px; border: 1px solid #2d6a4f; color: #2d6a4f; text-decoration: none; font-size: 0.875rem; }
    .tab.active, .tab:hover { background: #2d6a4f; color: #fff; }
    .summary { padding: 0.75rem 1.5rem; font-size: 0.9rem; color: #666; }
    .zoo-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; padding: 1rem 1.5rem; }
    .zoo-card { background: #fff; border-radius: 8px; padding: 1rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .zoo-card h2 { font-size: 1.1rem; margin-bottom: 0.25rem; }
    .zoo-card h2 a { color: #2d6a4f; text-decoration: none; }
    .zoo-card h2 a:hover { text-decoration: underline; }
    .kana { font-size: 0.8rem; color: #888; margin-bottom: 0.75rem; }
    dl { display: grid; grid-template-columns: 5.5em 1fr; gap: 0.2rem 0.5rem; font-size: 0.85rem; }
    dt { color: #666; font-weight: bold; }
    .features { margin-top: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .tag { background: #e8f5e9; color: #2d6a4f; border-radius: 999px; padding: 0.2rem 0.6rem; font-size: 0.75rem; }
    .empty { padding: 2rem 1.5rem; color: #888; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
  </style>
</head>
<body>
  <header>
    <h1>🦁 近畿動物園情報</h1>
    <p>近畿一円の動物園・動物施設をまとめて調べられます</p>
  </header>
  <nav class="tabs">
    ${allTab}
    ${prefTabs}
  </nav>
  <p class="summary">${prefLabel} の動物園・施設: ${count} 件</p>
  ${count > 0 ? `<div class="zoo-list">${cards}</div>` : '<p class="empty">該当する施設が見つかりませんでした。</p>'}
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
</body>
</html>`;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // JSON API: /api/zoos
    if (pathname === "/api/zoos") {
      const pref = url.searchParams.get("pref");
      const result = filterZoos(pref);
      if (pref && !isPrefectureCode(pref)) {
        return notFound(`都道府県コード '${pref}' は無効です`);
      }
      return jsonResponse(result);
    }

    // JSON API: /api/zoos/:id
    const zooIdMatch = pathname.match(/^\/api\/zoos\/([^/]+)$/);
    if (zooIdMatch) {
      const id = zooIdMatch[1];
      const zoo = zoos.find((z) => z.id === id);
      if (!zoo) return notFound(`動物園 '${id}' が見つかりません`);
      return jsonResponse(zoo);
    }

    // HTML: /
    if (pathname === "/") {
      const pref = url.searchParams.get("pref");
      const activePref = pref && isPrefectureCode(pref) ? pref : null;
      const filtered = filterZoos(activePref);
      const html = renderHtml(filtered, activePref);
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return notFound("ページが見つかりません");
  },
};
