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

const DEFAULT_INPUT_PATH = "data/kyoto-city-route-stops-all.json";

function logVerbose(verbose: boolean, message: string): void {
  if (verbose) {
    console.error(message);
  }
}

function printHelp(): void {
  console.log(`使用法: npx ts-node src/route-stops-stats.ts <command> [options] [input.json]

command:
  stop-routes
      停留所ごとに通っている路線をタブ区切りで出力します
  route-stops-count
      停留所ごとに通っている路線数をタブ区切りで出力します
  reachable-stops-count
      停留所ごとに、その停留所を通る路線で行ける停留所数をタブ区切りで出力します
  one-transfer-reachable-stops-count
      停留所ごとに、1回乗り換えで到達可能なユニーク停留所数をタブ区切りで出力します
  routes-by-stop <stop-name>
      指定した停留所を含む路線一覧を表示します
  stop-route-reachable-stops [stop-name]
      乗車停留所・系列・到達可能停留所をタブ区切りで出力します

options:
  -i, --input <file>  入力 JSON ファイル。省略時は data/kyoto-city-route-stops-all.json
  --verbose           詳細ログを stderr に表示
  -h, --help          ヘルプを表示

examples:
  npx ts-node src/route-stops-stats.ts stop-routes
  npx ts-node src/route-stops-stats.ts route-stops-count
  npx ts-node src/route-stops-stats.ts reachable-stops-count
  npx ts-node src/route-stops-stats.ts one-transfer-reachable-stops-count
  npx ts-node src/route-stops-stats.ts routes-by-stop 京都駅前
  npx ts-node src/route-stops-stats.ts stop-route-reachable-stops
  npx ts-node src/route-stops-stats.ts stop-route-reachable-stops 京都駅前
  npx ts-node src/route-stops-stats.ts stop-routes data/kyoto-city-route-stops-206.json
  npx ts-node src/route-stops-stats.ts stop-routes -i data/routes.json`);
}

function parseArgs(args: string[]): {
  command: string;
  inputPath: string;
  commandArgs: string[];
  verbose: boolean;
} {
  const command = args[0];
  if (!command || command === "-h" || command === "--help") {
    printHelp();
    process.exit(0);
  }

  let inputPath = DEFAULT_INPUT_PATH;
  const commandArgs: string[] = [];
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
    if (arg === "--verbose") {
      verbose = true;
      continue;
    }
    commandArgs.push(arg);
  }

  return { command, inputPath, commandArgs, verbose };
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

function printStopRoutes(data: RouteStopsFile): void {
  const rows = [...buildStopToRoutes(data).entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "ja"))
    .map(([stop, routeNames]) => `${stop}\t${[...routeNames].sort((a, b) => a.localeCompare(b, "ja")).join(",")}`);

  for (const row of rows) {
    console.log(row);
  }
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

function printRouteStopsCount(data: RouteStopsFile): void {
  const rows = [...buildStopToRoutes(data).entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "ja"))
    .map(([stop, routeNames]) => `${stop}\t${routeNames.size}`);

  for (const row of rows) {
    console.log(row);
  }
}

function buildRouteToStops(data: RouteStopsFile): Map<string, Set<string>> {
  const routeToStops = new Map<string, Set<string>>();

  for (const route of data.routes) {
    routeToStops.set(route.routeName, new Set(route.stops));
  }

  return routeToStops;
}

function printReachableStopsCount(data: RouteStopsFile): void {
  const stopToRoutes = buildStopToRoutes(data);
  const routeToStops = buildRouteToStops(data);

  const rows = [...stopToRoutes.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "ja"))
    .map(([stop, routeNames]) => {
      const reachableStops = new Set<string>();

      for (const routeName of routeNames) {
        const stops = routeToStops.get(routeName);
        if (!stops) {
          continue;
        }
        for (const reachableStop of stops) {
          if (reachableStop !== stop) {
            reachableStops.add(reachableStop);
          }
        }
      }

      return `${stop}\t${reachableStops.size}`;
    });

  for (const row of rows) {
    console.log(row);
  }
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

function printOneTransferReachableStopsCount(data: RouteStopsFile): void {
  const stopToRoutes = buildStopToRoutes(data);
  const routeToStops = buildRouteToStops(data);

  const rows = [...stopToRoutes.keys()]
    .sort((a, b) => a.localeCompare(b, "ja"))
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

function normalizeForSearch(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function printRoutesByStop(data: RouteStopsFile, stopQuery: string): void {
  const normalizedQuery = normalizeForSearch(stopQuery);
  const matchedStops = [...buildStopToRoutes(data).entries()]
    .filter(([stop]) => normalizeForSearch(stop).includes(normalizedQuery))
    .sort((a, b) => a[0].localeCompare(b[0], "ja"));

  if (matchedStops.length === 0) {
    throw new Error(`一致する停留所が見つかりません: ${stopQuery}`);
  }

  for (const [stop, routeNames] of matchedStops) {
    for (const routeName of [...routeNames].sort((a, b) => a.localeCompare(b, "ja"))) {
      console.log(`${stop}\t${routeName}`);
    }
  }
}

function printStopRouteReachableStops(data: RouteStopsFile, stopQuery?: string): void {
  const normalizedQuery = stopQuery ? normalizeForSearch(stopQuery) : "";
  const rows: string[] = [];

  for (const route of [...data.routes].sort((a, b) => a.routeName.localeCompare(b.routeName, "ja"))) {
    const reachableStops = [...new Set(route.stops)].sort((a, b) => a.localeCompare(b, "ja"));

    for (const originStop of reachableStops) {
      if (normalizedQuery && !normalizeForSearch(originStop).includes(normalizedQuery)) {
        continue;
      }
      for (const reachableStop of reachableStops) {
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
  const { command, inputPath, commandArgs, verbose } = parseArgs(process.argv.slice(2));

  let resolvedInputPath = inputPath;

  if (command === "stop-routes") {
    if (commandArgs.length >= 1) {
      resolvedInputPath = commandArgs[0];
    }
  } else if (command === "route-stops-count") {
    if (commandArgs.length >= 1) {
      resolvedInputPath = commandArgs[0];
    }
  } else if (command === "reachable-stops-count") {
    if (commandArgs.length >= 1) {
      resolvedInputPath = commandArgs[0];
    }
  } else if (command === "one-transfer-reachable-stops-count") {
    if (commandArgs.length >= 1) {
      resolvedInputPath = commandArgs[0];
    }
  } else if (command === "routes-by-stop") {
    if (commandArgs.length >= 2) {
      resolvedInputPath = commandArgs[1];
    }
  } else if (command === "stop-route-reachable-stops") {
    if (commandArgs.length >= 2) {
      resolvedInputPath = commandArgs[1];
    }
  }

  logVerbose(verbose, `入力ファイル: ${resolvedInputPath}`);
  const data = readRouteStopsFile(resolvedInputPath);

  if (command === "stop-routes") {
    printStopRoutes(data);
    return;
  }

  if (command === "route-stops-count") {
    printRouteStopsCount(data);
    return;
  }

  if (command === "reachable-stops-count") {
    printReachableStopsCount(data);
    return;
  }

  if (command === "one-transfer-reachable-stops-count") {
    printOneTransferReachableStopsCount(data);
    return;
  }

  if (command === "routes-by-stop") {
    const stopQuery = commandArgs[0];
    if (!stopQuery) {
      throw new Error("停留所名を指定してください");
    }
    printRoutesByStop(data, stopQuery);
    return;
  }

  if (command === "stop-route-reachable-stops") {
    printStopRouteReachableStops(data, commandArgs[0]);
    return;
  }

  throw new Error(`不明なコマンドです: ${command}`);
}

try {
  main();
} catch (error) {
  console.error("エラー:", error instanceof Error ? error.message : error);
  process.exit(1);
}
