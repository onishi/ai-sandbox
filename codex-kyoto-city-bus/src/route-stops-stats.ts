import * as fs from "fs";
import * as path from "path";

interface RouteStops {
  routeName: string;
  title: string;
  url: string;
  stops: string[];
}

interface RouteStopsFile {
  generatedAt: string;
  sourceUrl: string;
  routeCount: number;
  routes: RouteStops[];
}

interface CliOptions {
  command: string;
  inputPath: string;
  match?: string;
  verbose: boolean;
}

const DEFAULT_INPUT_PATH = "data/kyoto-city-route-stops-all.json";

function logVerbose(verbose: boolean, message: string): void {
  if (verbose) {
    console.error(message);
  }
}

function printHelp(): void {
  console.log(`使用法: npx ts-node src/route-stops-stats.ts <command> [options]

command:
  stops:routes
      停留所と、その停留所を通る系列を 1 行ずつタブ区切りで出力します
  stops:route-count
      停留所ごとの系列数をタブ区切りで出力します
  stops:direct-reachable-count
      停留所ごとの直通到達可能停留所数をタブ区切りで出力します
  stops:one-transfer-reachable-count
      停留所ごとの 1 回乗り換え到達可能停留所数をタブ区切りで出力します
  stops:route-reachable
      乗車停留所・系列・到達可能停留所を 1 行ずつタブ区切りで出力します

options:
  -i, --input <file>  入力 JSON ファイル。省略時は data/kyoto-city-route-stops-all.json
  --match <keyword>   停留所名で部分一致フィルタ
  --verbose           詳細ログを stderr に表示
  -h, --help          ヘルプを表示

examples:
  npx ts-node src/route-stops-stats.ts stops:routes
  npx ts-node src/route-stops-stats.ts stops:routes --match 京都駅前
  npx ts-node src/route-stops-stats.ts stops:route-count
  npx ts-node src/route-stops-stats.ts stops:direct-reachable-count --match 西賀茂車庫
  npx ts-node src/route-stops-stats.ts stops:one-transfer-reachable-count
  npx ts-node src/route-stops-stats.ts stops:route-reachable --match 西賀茂車庫
  npx ts-node src/route-stops-stats.ts stops:routes -i data/kyoto-city-route-stops-206.json`);
}

function parseArgs(args: string[]): CliOptions {
  const command = args[0];
  if (!command || command === "-h" || command === "--help") {
    printHelp();
    process.exit(0);
  }

  let inputPath = DEFAULT_INPUT_PATH;
  let match: string | undefined;
  let verbose = false;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    }
    if (arg === "-i" || arg === "--input") {
      inputPath = args[++i];
      if (!inputPath) {
        throw new Error("入力ファイルを指定してください");
      }
      continue;
    }
    if (arg === "--match") {
      match = args[++i];
      if (!match) {
        throw new Error("停留所名の検索語を指定してください");
      }
      continue;
    }
    if (arg === "--verbose") {
      verbose = true;
      continue;
    }
    throw new Error(`不明な引数です: ${arg}`);
  }

  return { command, inputPath, match, verbose };
}

function readRouteStopsFile(inputPath: string): RouteStopsFile {
  const resolvedPath = path.resolve(process.cwd(), inputPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`入力ファイルが見つかりません: ${resolvedPath}`);
  }

  let raw: string;
  try {
    raw = fs.readFileSync(resolvedPath, "utf8");
  } catch (error) {
    throw new Error(
      `入力ファイルを読み取れませんでした: ${resolvedPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `入力ファイルの JSON を解析できませんでした: ${resolvedPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as Partial<RouteStopsFile>).routes)
  ) {
    throw new Error(`入力ファイルの形式が不正です: ${resolvedPath}`);
  }

  return parsed as RouteStopsFile;
}

function normalizeForSearch(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function matchesStop(stop: string, match?: string): boolean {
  if (!match) {
    return true;
  }
  return normalizeForSearch(stop).includes(normalizeForSearch(match));
}

function buildStopToRoutes(data: RouteStopsFile): Map<string, Set<string>> {
  const stopToRoutes = new Map<string, Set<string>>();

  for (const route of data.routes) {
    for (const stop of route.stops) {
      const routeNames = stopToRoutes.get(stop) ?? new Set<string>();
      routeNames.add(route.routeName);
      stopToRoutes.set(stop, routeNames);
    }
  }

  return stopToRoutes;
}

function buildRouteToStops(data: RouteStopsFile): Map<string, Set<string>> {
  const routeToStops = new Map<string, Set<string>>();

  for (const route of data.routes) {
    routeToStops.set(route.routeName, new Set(route.stops));
  }

  return routeToStops;
}

function buildDirectReachableStops(
  originStop: string,
  stopToRoutes: Map<string, Set<string>>,
  routeToStops: Map<string, Set<string>>
): Set<string> {
  const reachableStops = new Set<string>();
  const routeNames = stopToRoutes.get(originStop) ?? new Set<string>();

  for (const routeName of routeNames) {
    const stops = routeToStops.get(routeName);
    if (!stops) {
      continue;
    }
    for (const stop of stops) {
      if (stop !== originStop) {
        reachableStops.add(stop);
      }
    }
  }

  return reachableStops;
}

function printStopRoutes(data: RouteStopsFile, match?: string): void {
  const rows: string[] = [];

  for (const [stop, routeNames] of [...buildStopToRoutes(data).entries()].sort((a, b) =>
    a[0].localeCompare(b[0], "ja")
  )) {
    if (!matchesStop(stop, match)) {
      continue;
    }
    for (const routeName of [...routeNames].sort((a, b) => a.localeCompare(b, "ja"))) {
      rows.push(`${stop}\t${routeName}`);
    }
  }

  for (const row of rows) {
    console.log(row);
  }
}

function printStopRouteCount(data: RouteStopsFile, match?: string): void {
  const rows = [...buildStopToRoutes(data).entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "ja"))
    .filter(([stop]) => matchesStop(stop, match))
    .map(([stop, routeNames]) => `${stop}\t${routeNames.size}`);

  for (const row of rows) {
    console.log(row);
  }
}

function printStopDirectReachableCount(data: RouteStopsFile, match?: string): void {
  const stopToRoutes = buildStopToRoutes(data);
  const routeToStops = buildRouteToStops(data);

  const rows = [...stopToRoutes.keys()]
    .sort((a, b) => a.localeCompare(b, "ja"))
    .filter((stop) => matchesStop(stop, match))
    .map((stop) => `${stop}\t${buildDirectReachableStops(stop, stopToRoutes, routeToStops).size}`);

  for (const row of rows) {
    console.log(row);
  }
}

function printStopOneTransferReachableCount(data: RouteStopsFile, match?: string): void {
  const stopToRoutes = buildStopToRoutes(data);
  const routeToStops = buildRouteToStops(data);

  const rows = [...stopToRoutes.keys()]
    .sort((a, b) => a.localeCompare(b, "ja"))
    .filter((stop) => matchesStop(stop, match))
    .map((originStop) => {
      const reachableStops = buildDirectReachableStops(originStop, stopToRoutes, routeToStops);
      const transferStops = new Set<string>(reachableStops);
      transferStops.add(originStop);

      for (const transferStop of transferStops) {
        const transferRouteNames = stopToRoutes.get(transferStop) ?? new Set<string>();
        for (const routeName of transferRouteNames) {
          const stops = routeToStops.get(routeName);
          if (!stops) {
            continue;
          }
          for (const stop of stops) {
            if (stop !== originStop) {
              reachableStops.add(stop);
            }
          }
        }
      }

      return `${originStop}\t${reachableStops.size}`;
    });

  for (const row of rows) {
    console.log(row);
  }
}

function printStopRouteReachable(data: RouteStopsFile, match?: string): void {
  const rows: string[] = [];

  for (const route of [...data.routes].sort((a, b) => a.routeName.localeCompare(b.routeName, "ja"))) {
    const routeStops = [...new Set(route.stops)].sort((a, b) => a.localeCompare(b, "ja"));

    for (const originStop of routeStops) {
      if (!matchesStop(originStop, match)) {
        continue;
      }
      for (const reachableStop of routeStops) {
        if (reachableStop === originStop) {
          continue;
        }
        rows.push(`${originStop}\t${route.routeName}\t${reachableStop}`);
      }
    }
  }

  rows.sort((a, b) => a.localeCompare(b, "ja"));

  for (const row of rows) {
    console.log(row);
  }
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  logVerbose(options.verbose, `入力ファイル: ${options.inputPath}`);
  if (options.match) {
    logVerbose(options.verbose, `停留所フィルタ: ${options.match}`);
  }

  const data = readRouteStopsFile(options.inputPath);

  if (options.command === "stops:routes") {
    printStopRoutes(data, options.match);
    return;
  }

  if (options.command === "stops:route-count") {
    printStopRouteCount(data, options.match);
    return;
  }

  if (options.command === "stops:direct-reachable-count") {
    printStopDirectReachableCount(data, options.match);
    return;
  }

  if (options.command === "stops:one-transfer-reachable-count") {
    printStopOneTransferReachableCount(data, options.match);
    return;
  }

  if (options.command === "stops:route-reachable") {
    printStopRouteReachable(data, options.match);
    return;
  }

  throw new Error(`不明なコマンドです: ${options.command}`);
}

try {
  main();
} catch (error) {
  console.error("エラー:", error instanceof Error ? error.message : error);
  process.exit(1);
}
