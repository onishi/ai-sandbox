# Repository Guidelines

## AI エージェント向け運用方針
この文書は、Claude、Codex、ChatGPT など複数の AI エージェントが共通で参照する作業ガイドです。特定ツール固有の挙動に依存せず、リポジトリ全体で一貫した変更を行ってください。

- 各実験・検証は独立したディレクトリで管理する
- 新しい実験を追加したら `README.md` の一覧も更新する
- 変更は対象ディレクトリに閉じ、無関係な実験へ波及させない
- 作業が一区切りついたら、関連する変更を必ずコミットする

## プロジェクト構成
このリポジトリは、AI を使ったタイアップ情報取得の実験用 TypeScript CLI を 2 つ含みます。

- `chatgpt-detect-tieup/`: OpenAI API 版
- `gemini-detect-tieup/`: Gemini API 版

各パッケージは `src/` に実装、`data/input.tsv` にベンチマーク入力を置いています。単発実行の入口は `src/index.ts`、複数曲の評価は `src/benchmark.ts` です。共通ライブラリはまだないため、修正は原則として対象パッケージ内に閉じてください。

## ビルド・テスト・開発コマンド
コマンドは対象パッケージのディレクトリで実行します。

- `npm install`: 依存関係をインストール
- `npm start -- "紅蓮華" "LiSA"`: 1 曲分の CLI を実行
- `npx ts-node src/benchmark.ts data/input.tsv -o result.tsv`: TSV 入力でベンチマークを実行し、結果を保存
- `npx tsc --noEmit`: `dist/` を出力せず型チェックのみ実行

環境変数は `chatgpt-detect-tieup` で `OPENAI_API_KEY`、`gemini-detect-tieup` で `GEMINI_API_KEY` を使用します。

## コーディング規約と命名
TypeScript は `strict` 有効、CommonJS 出力です。専用の formatter / linter は未導入なので、既存コードに合わせた簡潔な書き方を維持してください。命名は以下を基本とします。

- 関数・変数は `camelCase`
- インターフェースは `PascalCase` (`TieupInfo` など)
- CLI オプションは `--model`、`--grounding` のように意味が明確な名前

再利用する処理は `src/index.ts` から export し、エラーメッセージは短く具体的にしてください。

## テスト方針
現時点では専用テストフレームワークはありません。変更時は最低限以下を確認してください。

- `npx tsc --noEmit` で型エラーがないこと
- CLI を代表的な引数で 1 回実行すること
- TSV 解析やモデル選択を変更した場合は `src/benchmark.ts` も実行すること

今後テストを追加する場合は、`src/` 直下または各パッケージの `test/` に配置し、対象機能が分かる名前を付けてください。

## コミットと Pull Request
コミットメッセージは、既存履歴のように短く内容が分かる形式を推奨します。例: `Gemini でアニソンタイアップを調べるスクリプト`

Pull Request では、変更対象パッケージ、確認に使ったコマンド、必要な API キーやモデル指定、挙動が変わる場合は CLI 出力例を記載してください。
