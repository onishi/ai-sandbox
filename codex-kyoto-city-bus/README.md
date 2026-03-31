# codex-kyoto-city-bus

京都市営バスの GTFS データを取得して、停留所・系統・静的時刻表を検索する TypeScript CLI です。

## GTFS とは

GTFS は、公共交通の停留所、系統、運行便、時刻表などを共通形式で配布するための標準フォーマットです。通常は `stops.txt`、`routes.txt`、`trips.txt`、`stop_times.txt` などを含む ZIP ファイルとして提供されます。

このツールは、公共交通オープンデータセンターが公開している京都市営バスの GTFS を取得し、その静的データを検索します。

## `ODPT_ACCESS_TOKEN` とは

`ODPT_ACCESS_TOKEN` は、公共交通オープンデータセンターの開発者向けアクセストークンです。京都市営バス GTFS のダウンロード URL にはこのトークンが必要です。

取得手順:

1. 公共交通オープンデータセンターの開発者サイト `https://developer.odpt.org/` でユーザ登録する
2. ログイン後に自分のアクセストークンを確認する
3. シェルの環境変数 `ODPT_ACCESS_TOKEN` に設定する

設定例:

```bash
export ODPT_ACCESS_TOKEN=YOUR_ACCESS_TOKEN
```

## セットアップ

```bash
npm install
```

## 使い方

公共交通オープンデータセンターのアクセストークンを `ODPT_ACCESS_TOKEN` に設定して実行します。

```bash
ODPT_ACCESS_TOKEN=YOUR_TOKEN npm start -- stops 京都駅
ODPT_ACCESS_TOKEN=YOUR_TOKEN npm start -- routes 206
ODPT_ACCESS_TOKEN=YOUR_TOKEN npm start -- timetable 京都駅 206
ODPT_ACCESS_TOKEN=YOUR_TOKEN npm start -- download
```

`download` コマンドを使うと、最新版 GTFS を `data/cache/kyoto-city-bus-gtfs.zip` に保存します。

## 情報源

- 公共交通オープンデータセンター「京都市営バス / Kyoto City Bus」
- 開発者サイト: `https://developer.odpt.org/`
