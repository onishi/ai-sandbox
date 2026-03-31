import * as fs from "fs";
import * as path from "path";

interface RouteStops {
  routeName: string;
  title: string;
  url: string;
  stops: string[];
}

interface OutputShape {
  generatedAt: string;
  sourceUrl: string;
  routeCount: number;
  routes: RouteStops[];
}

const ROUTE_INDEX_URL =
  "https://www2.city.kyoto.lg.jp/kotsu/busdia/keitou/keitou.htm";
const DEFAULT_OUTPUT_PREFIX = "data/kyoto-city-route-stops";
const REQUEST_INTERVAL_MS = 1000;

function logVerbose(verbose: boolean, message: string): void {
  if (verbose) {
    console.error(message);
  }
}

function printHelp(): void {
  console.log(`使用法: npx ts-node src/scrape-route-stops.ts [options] [route...]

京都市バスの系統番号検索ページをたどって、系統ごとの停留所一覧を JSON 化します。

options:
  -o, --output <file>  出力先ファイル。省略時は系統名入りのファイル名を自動生成
  --verbose            詳細ログを stderr に表示
  -h, --help           ヘルプを表示

examples:
  npx ts-node src/scrape-route-stops.ts
  npx ts-node src/scrape-route-stops.ts 1 205
  npx ts-node src/scrape-route-stops.ts -o data/routes.json 快速 206`);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]+>/g, " "));
}

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForMatch(value: string): string {
  return normalizeSpace(value).replace(/\s+/g, "").toLowerCase();
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`取得に失敗しました: ${response.status} ${response.statusText} (${url})`);
  }
  return response.text();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugifyFilter(value: string): string {
  return normalizeSpace(value)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-");
}

function buildDefaultOutputPath(filters: string[]): string {
  const suffix = filters.length === 0 ? "all" : filters.map(slugifyFilter).join("-");
  return `${DEFAULT_OUTPUT_PREFIX}-${suffix}.json`;
}

function extractRouteUrls(indexHtml: string): string[] {
  const matches = [...indexHtml.matchAll(/href="([^"]*\/kto\/[^"]+\.htm)"/gi)];
  const urls = matches.map((match) => new URL(match[1], ROUTE_INDEX_URL).toString());
  return unique(urls);
}

function extractTitle(routeHtml: string): string {
  const h1Match = routeHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!h1Match) {
    throw new Error("系統タイトルを抽出できませんでした");
  }
  return normalizeSpace(stripTags(h1Match[1]));
}

function extractRouteName(title: string): string {
  const match = title.match(/^(.+?)\s*号系統の停車停留所$/);
  return match ? normalizeSpace(match[1]) : title;
}

function isReadingToken(token: string): boolean {
  return /^[\p{Script=Hiragana}\p{Script=Katakana}ー・･\/／\s（）()]+$/u.test(token);
}

function isDirectionText(text: string): boolean {
  return /行き?/.test(text) || /のりば/.test(text);
}

function extractJapaneseStopName(anchorText: string): string | undefined {
  const text = normalizeSpace(anchorText);
  if (!/[A-Za-z]/.test(text)) {
    return undefined;
  }
  if (isDirectionText(text)) {
    return undefined;
  }
  if (text.includes("行き")) {
    return undefined;
  }

  const tokens = text.split(" ");
  const firstAsciiIndex = tokens.findIndex((token) => /[A-Za-z"]/.test(token));
  if (firstAsciiIndex === -1) {
    return undefined;
  }

  const japaneseTokens = tokens
    .slice(0, firstAsciiIndex)
    .filter((token) => token && !isReadingToken(token));
  const stopName = japaneseTokens.join(" ").trim();
  if (!stopName) {
    return undefined;
  }

  if (/^(Menu|全て閉じる|全て開く)$/i.test(stopName)) {
    return undefined;
  }

  return stopName;
}

function extractStops(routeHtml: string): string[] {
  const anchorMatches = [...routeHtml.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)];
  const stops: string[] = [];

  for (const match of anchorMatches) {
    const stopName = extractJapaneseStopName(stripTags(match[1]));
    if (!stopName) {
      continue;
    }

    if (stops[stops.length - 1] === stopName) {
      continue;
    }
    stops.push(stopName);
  }

  return unique(stops);
}

function parseArgs(args: string[]): { outputPath?: string; filters: string[]; verbose: boolean } {
  let outputPath: string | undefined;
  const filters: string[] = [];
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-o" || arg === "--output") {
      outputPath = args[++i];
      if (!outputPath) {
        throw new Error("出力先ファイルを指定してください");
      }
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--verbose") {
      verbose = true;
      continue;
    }
    filters.push(arg);
  }

  return { outputPath, filters, verbose };
}

function matchesFilter(route: RouteStops, filters: string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  const haystacks = [
    normalizeForMatch(route.routeName),
    normalizeForMatch(route.title),
    normalizeForMatch(route.url),
  ];

  return filters.some((filter) => {
    const needle = normalizeForMatch(filter);
    return haystacks.some((haystack) => haystack.includes(needle));
  });
}

async function scrapeAllRouteStops(withThrottle: boolean): Promise<RouteStops[]> {
  const indexHtml = await fetchHtml(ROUTE_INDEX_URL);
  const routeUrls = extractRouteUrls(indexHtml);

  const routes: RouteStops[] = [];
  for (let i = 0; i < routeUrls.length; i++) {
    if (withThrottle && i > 0) {
      await sleep(REQUEST_INTERVAL_MS);
    }

    const url = routeUrls[i];
    const routeHtml = await fetchHtml(url);
    const title = extractTitle(routeHtml);
    const routeName = extractRouteName(title);
    const stops = extractStops(routeHtml);
    routes.push({ routeName, title, url, stops });
  }

  return routes.sort((a, b) => a.routeName.localeCompare(b.routeName, "ja"));
}

async function main(): Promise<void> {
  const { outputPath, filters, verbose } = parseArgs(process.argv.slice(2));
  const resolvedOutputPath = outputPath ?? buildDefaultOutputPath(filters);
  const withThrottle = filters.length === 0;
  const routes = (await scrapeAllRouteStops(withThrottle)).filter((route) =>
    matchesFilter(route, filters)
  );

  const output: OutputShape = {
    generatedAt: new Date().toISOString(),
    sourceUrl: ROUTE_INDEX_URL,
    routeCount: routes.length,
    routes,
  };

  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  fs.writeFileSync(resolvedOutputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  logVerbose(verbose, `保存しました: ${resolvedOutputPath}`);
  logVerbose(verbose, `系統数: ${routes.length}`);
}

main().catch((error) => {
  console.error("エラー:", error instanceof Error ? error.message : error);
  process.exit(1);
});
