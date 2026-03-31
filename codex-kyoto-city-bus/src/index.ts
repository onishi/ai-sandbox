import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";

type CsvRow = Record<string, string>;

interface StopResult {
  stopId: string;
  stopName: string;
  stopCode?: string;
  lat?: string;
  lon?: string;
}

interface RouteResult {
  routeId: string;
  shortName: string;
  longName: string;
}

interface TimetableRow {
  departureTime: string;
  routeShortName: string;
  routeLongName: string;
  headsign: string;
  serviceId: string;
}

const DATASET_PAGE_URL =
  "https://ckan.odpt.org/dataset/kyoto_municipal_transportation_kyoto_city_bus_gtfs";
const CACHE_DIR = path.resolve(__dirname, "../data/cache");
const CACHE_ZIP_PATH = path.join(CACHE_DIR, "kyoto-city-bus-gtfs.zip");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function printHelp(): void {
  console.log(`使用法: npx ts-node src/index.ts <command> [args]

command:
  download
      最新の京都市営バス GTFS をダウンロードしてキャッシュします

  stops <keyword>
      停留所名で検索します
      例: npx ts-node src/index.ts stops 京都駅

  routes [keyword]
      系統を一覧または絞り込み表示します
      例: npx ts-node src/index.ts routes 206

  timetable <stop-keyword> [route-keyword]
      停留所の時刻表を表示します（GTFS の静的データ）
      例: npx ts-node src/index.ts timetable 京都駅 206

環境変数:
  ODPT_ACCESS_TOKEN
      公共交通オープンデータセンターのアクセストークン`);
}

function ensureCacheDir(): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`取得に失敗しました: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ダウンロードに失敗しました: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function resolveToken(): string {
  const token = process.env.ODPT_ACCESS_TOKEN;
  if (!token) {
    throw new Error("ODPT_ACCESS_TOKEN 環境変数が設定されていません");
  }
  return token;
}

function extractDownloadUrl(html: string, token: string): string {
  const match = html.match(/https:\/\/api\.odpt\.org\/api\/v4\/files\/odpt\/KyotoMunicipalTransportation\/Kyoto_City_Bus_GTFS\.zip\?[^"'<\s]+/);
  if (!match) {
    throw new Error("GTFS ダウンロード URL を抽出できませんでした");
  }

  return match[0]
    .replace("[アクセストークン/YOUR_ACCESS_TOKEN]", encodeURIComponent(token))
    .replace(/&amp;/g, "&");
}

async function resolveLatestGtfsUrl(): Promise<string> {
  const token = resolveToken();
  const html = await fetchText(DATASET_PAGE_URL);
  return extractDownloadUrl(html, token);
}

function isCacheFresh(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const stat = fs.statSync(filePath);
  return Date.now() - stat.mtimeMs < CACHE_TTL_MS;
}

async function ensureGtfsZip(forceDownload = false): Promise<string> {
  ensureCacheDir();

  if (!forceDownload && isCacheFresh(CACHE_ZIP_PATH)) {
    return CACHE_ZIP_PATH;
  }

  const url = await resolveLatestGtfsUrl();
  const zipBuffer = await fetchBuffer(url);
  fs.writeFileSync(CACHE_ZIP_PATH, zipBuffer);
  return CACHE_ZIP_PATH;
}

function readZipEntry(zipPath: string, entryName: string): string {
  try {
    return execFileSync("unzip", ["-p", zipPath, entryName], {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
    });
  } catch (error) {
    throw new Error(
      `${entryName} を ZIP から読み出せませんでした: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    currentRow.push(currentField);
    currentField = "";
  };

  const pushRow = () => {
    if (currentRow.length > 0) {
      rows.push(currentRow);
    }
    currentRow = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        currentField += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      pushField();
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      pushField();
      pushRow();
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    pushField();
    pushRow();
  }

  if (rows.length === 0) {
    return [];
  }

  const [header, ...body] = rows;
  return body.map((row) => {
    const record: CsvRow = {};
    for (let i = 0; i < header.length; i++) {
      record[header[i]] = row[i] ?? "";
    }
    return record;
  });
}

function normalize(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }

  return result;
}

function parseGtfsFile(zipPath: string, fileName: string): CsvRow[] {
  return parseCsv(readZipEntry(zipPath, fileName));
}

function searchStops(stops: CsvRow[], keyword: string): StopResult[] {
  const normalizedKeyword = normalize(keyword);
  return uniqueBy(
    stops
      .filter((stop) => normalize(stop.stop_name || "").includes(normalizedKeyword))
      .map((stop) => ({
        stopId: stop.stop_id,
        stopName: stop.stop_name,
        stopCode: stop.stop_code,
        lat: stop.stop_lat,
        lon: stop.stop_lon,
      })),
    (stop) => stop.stopId
  );
}

function searchRoutes(routes: CsvRow[], keyword?: string): RouteResult[] {
  const normalizedKeyword = keyword ? normalize(keyword) : "";
  return routes
    .filter((route) => {
      if (!normalizedKeyword) {
        return true;
      }
      return (
        normalize(route.route_short_name || "").includes(normalizedKeyword) ||
        normalize(route.route_long_name || "").includes(normalizedKeyword)
      );
    })
    .map((route) => ({
      routeId: route.route_id,
      shortName: route.route_short_name || "",
      longName: route.route_long_name || "",
    }))
    .sort((a, b) => a.shortName.localeCompare(b.shortName, "ja"));
}

function compareGtfsTime(a: string, b: string): number {
  const parse = (value: string) => {
    const parts = value.split(":").map((part) => Number(part));
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  };
  return parse(a) - parse(b);
}

function buildTimetable(
  stopKeyword: string,
  routeKeyword: string | undefined,
  stops: CsvRow[],
  routes: CsvRow[],
  trips: CsvRow[],
  stopTimes: CsvRow[]
): { matchedStops: StopResult[]; rows: TimetableRow[] } {
  const matchedStops = searchStops(stops, stopKeyword);
  const stopIds = new Set(matchedStops.map((stop) => stop.stopId));

  const routeMap = new Map(routes.map((route) => [route.route_id, route]));
  const tripMap = new Map(trips.map((trip) => [trip.trip_id, trip]));
  const normalizedRouteKeyword = routeKeyword ? normalize(routeKeyword) : "";

  const rows = stopTimes
    .filter((stopTime) => stopIds.has(stopTime.stop_id))
    .map((stopTime) => {
      const trip = tripMap.get(stopTime.trip_id);
      if (!trip) {
        return undefined;
      }

      const route = routeMap.get(trip.route_id);
      if (!route) {
        return undefined;
      }

      const routeShortName = route.route_short_name || "";
      const routeLongName = route.route_long_name || "";

      if (
        normalizedRouteKeyword &&
        !normalize(routeShortName).includes(normalizedRouteKeyword) &&
        !normalize(routeLongName).includes(normalizedRouteKeyword)
      ) {
        return undefined;
      }

      return {
        departureTime: stopTime.departure_time,
        routeShortName,
        routeLongName,
        headsign: trip.trip_headsign || "",
        serviceId: trip.service_id || "",
      } satisfies TimetableRow;
    })
    .filter((row): row is TimetableRow => row !== undefined)
    .sort((a, b) => compareGtfsTime(a.departureTime, b.departureTime));

  return {
    matchedStops,
    rows,
  };
}

function printStops(results: StopResult[]): void {
  if (results.length === 0) {
    console.log("一致する停留所はありませんでした。");
    return;
  }

  for (const stop of results.slice(0, 20)) {
    console.log(
      `${stop.stopId}\t${stop.stopName}\t${stop.stopCode || ""}\t${stop.lat || ""},${stop.lon || ""}`
    );
  }
}

function printRoutes(results: RouteResult[]): void {
  if (results.length === 0) {
    console.log("一致する系統はありませんでした。");
    return;
  }

  for (const route of results.slice(0, 50)) {
    console.log(`${route.shortName}\t${route.routeId}\t${route.longName}`);
  }
}

function printTimetable(matchedStops: StopResult[], rows: TimetableRow[]): void {
  if (matchedStops.length === 0) {
    console.log("一致する停留所はありませんでした。");
    return;
  }

  console.log("対象停留所:");
  for (const stop of matchedStops.slice(0, 5)) {
    console.log(`- ${stop.stopName} (${stop.stopId})`);
  }

  console.log("");

  if (rows.length === 0) {
    console.log("一致する時刻表データはありませんでした。");
    return;
  }

  for (const row of rows.slice(0, 30)) {
    console.log(
      `${row.departureTime}\t${row.routeShortName}\t${row.headsign}\t${row.serviceId}\t${row.routeLongName}`
    );
  }
}

async function loadCoreGtfsFiles(): Promise<{
  zipPath: string;
  stops: CsvRow[];
  routes: CsvRow[];
  trips: CsvRow[];
  stopTimes: CsvRow[];
}> {
  const zipPath = await ensureGtfsZip();
  return {
    zipPath,
    stops: parseGtfsFile(zipPath, "stops.txt"),
    routes: parseGtfsFile(zipPath, "routes.txt"),
    trips: parseGtfsFile(zipPath, "trips.txt"),
    stopTimes: parseGtfsFile(zipPath, "stop_times.txt"),
  };
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  if (!command || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "download") {
    const zipPath = await ensureGtfsZip(true);
    console.log(`ダウンロードしました: ${zipPath}`);
    return;
  }

  if (command === "stops") {
    const keyword = args[0];
    if (!keyword) {
      throw new Error("stops コマンドには検索語が必要です");
    }
    const { stops } = await loadCoreGtfsFiles();
    printStops(searchStops(stops, keyword));
    return;
  }

  if (command === "routes") {
    const keyword = args[0];
    const { routes } = await loadCoreGtfsFiles();
    printRoutes(searchRoutes(routes, keyword));
    return;
  }

  if (command === "timetable") {
    const stopKeyword = args[0];
    const routeKeyword = args[1];
    if (!stopKeyword) {
      throw new Error("timetable コマンドには停留所名が必要です");
    }

    const { stops, routes, trips, stopTimes } = await loadCoreGtfsFiles();
    const { matchedStops, rows } = buildTimetable(
      stopKeyword,
      routeKeyword,
      stops,
      routes,
      trips,
      stopTimes
    );
    printTimetable(matchedStops, rows);
    return;
  }

  throw new Error(`不明なコマンドです: ${command}`);
}

main().catch((error) => {
  console.error("エラー:", error instanceof Error ? error.message : error);
  process.exit(1);
});
