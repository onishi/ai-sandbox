import OpenAI from "openai";

export interface Tieup {
  type: string;
  title: string;
  year?: number;
  description?: string;
}

export interface TieupInfo {
  song: string;
  artist: string;
  lyricist?: string;
  composer?: string;
  tieups: Tieup[];
  model: string;
  elapsedMs: number;
}

export interface Options {
  model: "4o" | "4o-mini";
}

function parseArgs(args: string[]): { song: string; artist: string; options: Options } {
  const options: Options = {
    model: "4o-mini",
  };

  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--model" || arg === "-m") {
      const value = args[++i];
      if (value === "4o" || value === "4o-mini") {
        options.model = value;
      } else {
        throw new Error("モデルは 4o または 4o-mini を指定してください");
      }
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  if (positional.length < 2) {
    throw new Error("曲名とアーティスト名を指定してください");
  }

  return {
    song: positional[0],
    artist: positional[1],
    options,
  };
}

export async function detectTieup(song: string, artist: string, options: Options): Promise<TieupInfo> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 環境変数が設定されていません");
  }

  const modelName = options.model === "4o" ? "gpt-4o" : "gpt-4o-mini";

  const openai = new OpenAI({ apiKey });

  const prompt = `以下の曲の情報を教えてください。
曲名: ${song}
アーティスト: ${artist}

作詞者、作曲者、およびタイアップ情報（アニメ主題歌、ドラマ主題歌、映画主題歌、CM曲など）を以下のJSON形式で返してください。
タイアップ情報がない場合は、tieups を空配列にしてください。

{
  "lyricist": "作詞者名",
  "composer": "作曲者名",
  "tieups": [
    {
      "type": "アニメOP",
      "title": "作品名",
      "year": 2020,
      "description": "補足情報（あれば）"
    }
  ]
}

JSON のみを返してください。説明文は不要です。`;

  const startTime = Date.now();
  const response = await openai.chat.completions.create({
    model: modelName,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  const elapsedMs = Date.now() - startTime;

  const text = response.choices[0]?.message?.content || "";

  // JSON を抽出（```json ... ``` で囲まれている場合に対応）
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("レスポンスから JSON を抽出できませんでした");
  }

  const jsonStr = jsonMatch[1] || jsonMatch[0];
  const parsed = JSON.parse(jsonStr);

  return {
    song,
    artist,
    lyricist: parsed.lyricist,
    composer: parsed.composer,
    tieups: parsed.tieups || [],
    model: modelName,
    elapsedMs,
  };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`使用法: npx ts-node src/index.ts [オプション] <曲名> <アーティスト名>

オプション:
  -m, --model <version>  モデルを指定 (4o または 4o-mini, デフォルト: 4o-mini)
  -h, --help             ヘルプを表示

例:
  npx ts-node src/index.ts "紅蓮華" "LiSA"
  npx ts-node src/index.ts -m 4o "紅蓮華" "LiSA"`);
    process.exit(0);
  }

  try {
    const { song, artist, options } = parseArgs(args);
    const result = await detectTieup(song, artist, options);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("エラー:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
