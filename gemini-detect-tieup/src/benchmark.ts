import * as fs from "fs";
import { detectTieup, Options, Tieup } from "./index";

interface BenchmarkResult {
  song: string;
  artist: string;
  model: string;
  grounding: boolean;
  lyricist: string;
  composer: string;
  tieups: string;
  elapsedMs: number;
  error: string;
}

function formatTieups(tieups: Tieup[]): string {
  if (tieups.length === 0) return "";
  return tieups
    .map((t) => {
      let text = `${t.type}: ${t.title}`;
      if (t.year) text += ` (${t.year})`;
      if (t.description) text += ` - ${t.description}`;
      return text;
    })
    .join(" / ");
}

const MODEL_VERSIONS: Array<"2.0" | "2.5"> = ["2.0", "2.5"];
const GROUNDING_OPTIONS = [false, true];
const SLEEP_MS = 500; // API呼び出し間隔（ミリ秒）

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseTsv(content: string): Array<{ song: string; artist: string }> {
  const lines = content.trim().split("\n");
  const header = lines[0].split("\t");

  const songIndex = header.indexOf("song");
  const artistIndex = header.indexOf("artist");

  if (songIndex === -1 || artistIndex === -1) {
    throw new Error("TSVファイルには song と artist カラムが必要です");
  }

  return lines.slice(1).map((line) => {
    const cols = line.split("\t");
    return {
      song: cols[songIndex],
      artist: cols[artistIndex],
    };
  });
}

function formatTsvOutput(results: BenchmarkResult[]): string {
  const header = [
    "model",
    "grounding",
    "song",
    "artist",
    "lyricist",
    "composer",
    "tieups",
    "elapsed_ms",
    "error",
  ].join("\t");

  const rows = results.map((r) =>
    [
      r.model,
      r.grounding,
      r.song,
      r.artist,
      r.lyricist,
      r.composer,
      r.tieups,
      r.elapsedMs,
      r.error,
    ].join("\t")
  );

  return [header, ...rows].join("\n");
}

async function runBenchmark(
  songs: Array<{ song: string; artist: string }>
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = [];

  for (const { song, artist } of songs) {
    for (const modelVersion of MODEL_VERSIONS) {
      for (const grounding of GROUNDING_OPTIONS) {
        const options: Options = { model: modelVersion, grounding };

        console.error(
          `実行中: ${song} / ${artist} (model: ${modelVersion}, grounding: ${grounding})`
        );

        try {
          const result = await detectTieup(song, artist, options);
          results.push({
            song,
            artist,
            model: result.model,
            grounding: result.grounding,
            lyricist: result.lyricist || "",
            composer: result.composer || "",
            tieups: formatTieups(result.tieups),
            elapsedMs: result.elapsedMs,
            error: "",
          });
        } catch (error) {
          results.push({
            song,
            artist,
            model: modelVersion === "2.5" ? "gemini-2.5-flash" : "gemini-2.0-flash",
            grounding,
            lyricist: "",
            composer: "",
            tieups: "",
            elapsedMs: 0,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // API呼び出し間隔を空ける
        await sleep(SLEEP_MS);
      }
    }
  }

  return results;
}

function parseArgs(args: string[]): { inputFile: string; outputFile?: string } {
  let inputFile = "";
  let outputFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-o" || arg === "--output") {
      outputFile = args[++i];
    } else if (!arg.startsWith("-")) {
      inputFile = arg;
    }
  }

  if (!inputFile) {
    throw new Error("入力TSVファイルを指定してください");
  }

  return { inputFile, outputFile };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`使用法: npx ts-node src/benchmark.ts <input.tsv> [-o output.tsv]

オプション:
  -o, --output <file>  出力ファイルを指定（省略時は標準出力）
  -h, --help           ヘルプを表示

入力TSV形式:
  song	artist
  紅蓮華	LiSA
  残酷な天使のテーゼ	高橋洋子`);
    process.exit(0);
  }

  try {
    const { inputFile, outputFile } = parseArgs(args);
    const content = fs.readFileSync(inputFile, "utf-8");
    const songs = parseTsv(content);

    console.error(`${songs.length} 曲を読み込みました`);

    const results = await runBenchmark(songs);
    const output = formatTsvOutput(results);

    if (outputFile) {
      fs.writeFileSync(outputFile, output);
      console.error(`結果を ${outputFile} に保存しました`);
    } else {
      console.log(output);
    }
  } catch (error) {
    console.error("エラー:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
