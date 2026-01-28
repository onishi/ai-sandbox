# gemini-detect-tieup 設計書

## 概要

曲名とアーティスト名を入力として、Gemini API を使用してタイアップ情報（アニメ主題歌、ドラマ主題歌、CM曲など）および作詞者・作曲者情報を取得するスクリプト。

## 技術スタック

- 言語: TypeScript
- ランタイム: Node.js
- API: Google Gemini API (@google/generative-ai)

## ファイル構成

```
gemini-detect-tieup/
├── src/
│   ├── index.ts       # 単体実行用スクリプト
│   └── benchmark.ts   # ベンチマーク用スクリプト
├── data/
│   └── input.tsv      # ベンチマーク入力サンプル
├── package.json
├── tsconfig.json
└── .env.example
```

---

## index.ts

単一の曲に対してタイアップ情報を取得する。

### 使用方法

```bash
# 環境変数に Gemini API キーを設定
export GEMINI_API_KEY=your_api_key

# 基本的な使い方
npx ts-node src/index.ts "紅蓮華" "LiSA"

# モデルを指定 (2.0 または 2.5)
npx ts-node src/index.ts -m 2.5 "紅蓮華" "LiSA"

# Google検索グラウンディングを有効化
npx ts-node src/index.ts -g "紅蓮華" "LiSA"

# 組み合わせ
npx ts-node src/index.ts -m 2.5 -g "紅蓮華" "LiSA"

# ヘルプ
npx ts-node src/index.ts --help
```

### オプション

| オプション | 説明 |
|-----------|------|
| `-m, --model <version>` | モデルを指定 (2.0 または 2.5, デフォルト: 2.0) |
| `-g, --grounding` | Google検索グラウンディングを有効化 |
| `-h, --help` | ヘルプを表示 |

### 出力形式 (JSON)

```json
{
  "song": "紅蓮華",
  "artist": "LiSA",
  "lyricist": "LiSA",
  "composer": "草野華余子",
  "tieups": [
    {
      "type": "アニメOP",
      "title": "鬼滅の刃",
      "year": 2019,
      "description": "テレビアニメ版オープニングテーマ"
    }
  ],
  "model": "gemini-2.0-flash",
  "grounding": false,
  "elapsedMs": 1234
}
```

### エクスポート

`benchmark.ts` などから利用可能：

```typescript
import { detectTieup, Options, TieupInfo, Tieup } from "./index";
```

---

## benchmark.ts

複数の曲を複数のモデル設定で実行し、結果を比較するベンチマークスクリプト。

### 使用方法

```bash
# 標準出力に結果を表示
npx ts-node src/benchmark.ts data/input.tsv

# ファイルに出力
npx ts-node src/benchmark.ts data/input.tsv -o output/results.tsv

# ヘルプ
npx ts-node src/benchmark.ts --help
```

### オプション

| オプション | 説明 |
|-----------|------|
| `-o, --output <file>` | 出力ファイルを指定（省略時は標準出力） |
| `-h, --help` | ヘルプを表示 |

### 入力形式 (TSV)

```
song	artist
紅蓮華	LiSA
残酷な天使のテーゼ	高橋洋子
君の知らない物語	supercell
```

### 出力形式 (TSV)

各曲を 4パターン（2モデル × グラウンディング有無）で実行：

```
model	grounding	song	artist	lyricist	composer	tieups	elapsed_ms	error
gemini-2.0-flash	false	紅蓮華	LiSA	LiSA	草野華余子	アニメOP: 鬼滅の刃 (2019) - テレビアニメ版オープニングテーマ	1234
gemini-2.0-flash	true	紅蓮華	LiSA	LiSA	草野華余子	アニメOP: 鬼滅の刃 (2019) - テレビアニメ版オープニングテーマ	2456
gemini-2.5-flash	false	紅蓮華	LiSA	LiSA	草野華余子	アニメOP: 鬼滅の刃 (2019) - テレビアニメ版オープニングテーマ	1567
gemini-2.5-flash	true	紅蓮華	LiSA	LiSA	草野華余子	アニメOP: 鬼滅の刃 (2019) - テレビアニメ版オープニングテーマ	2890
```

### 出力カラム

| カラム | 説明 |
|--------|------|
| model | 使用モデル (gemini-2.0-flash / gemini-2.5-flash) |
| grounding | グラウンディング有無 (true/false) |
| song | 曲名 |
| artist | アーティスト名 |
| lyricist | 作詞者 |
| composer | 作曲者 |
| tieups | タイアップ情報（複数の場合 `/` 区切り） |
| elapsed_ms | API応答時間（ミリ秒） |
| error | エラーがあれば記録 |

---

## 注意事項

- Gemini API の回答は必ずしも正確ではない可能性がある（LLM の特性上）
- API キーは環境変数で管理し、コードにハードコードしない
- ベンチマーク実行時は API 呼び出し回数に注意（曲数 × 4回）
