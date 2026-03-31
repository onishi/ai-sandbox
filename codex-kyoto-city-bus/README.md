# codex-kyoto-city-bus

京都市営バスに関する情報を取得する TypeScript CLI です。GTFS を使った検索に加えて、京都市の系統番号検索ページをスクレイプして、系統ごとの停留所一覧を JSON 化するプロトタイプも含みます。

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

## トークン不要のプロトタイプ

京都市公式の系統番号検索ページ `https://www2.city.kyoto.lg.jp/kotsu/busdia/keitou/keitou.htm` をたどって、系統ごとの停留所一覧を JSON に保存できます。こちらは `ODPT_ACCESS_TOKEN` 不要です。

```bash
npm run scrape:route-stops
npm run scrape:route-stops -- 206
npm run scrape:route-stops -- 快速 -o data/rapid-routes.json
```

このディレクトリでは `.npmrc` で `loglevel=silent` を設定しているため、`npm run ...` でも npm 自体のヘッダは通常表示されません。詳細ログが必要な場合だけ `--verbose` を付けてください。

`-o` を付けない場合、出力先は自動で決まります。

- 全系統: `data/kyoto-city-route-stops-all.json`
- `206` を指定: `data/kyoto-city-route-stops-206.json`
- `46 206` を指定: `data/kyoto-city-route-stops-46-206.json`

全系統を取得する場合は、京都市サイトへの連続アクセスを避けるため、系統ページごとに 1 秒待ってから次のリクエストを送ります。

## JSON 集計コマンド

スクレイプ済みの JSON を読み取る集計 CLI です。入力ファイルはデフォルトで `data/kyoto-city-route-stops-all.json` を使い、`-i` で差し替えます。停留所名の絞り込みは `--match` に統一しています。

```bash
npm run stats:route-stops -- stops:routes
npm run stats:route-stops -- stops:routes --match 京都駅前
npm run stats:route-stops -- stops:route-count
npm run stats:route-stops -- stops:direct-reachable-count
npm run stats:route-stops -- stops:one-transfer-reachable-count --match 西賀茂車庫
npm run stats:route-stops -- stops:route-reachable --match 京都駅前
npm run stats:route-stops -- stops:routes -i data/kyoto-city-route-stops-206.json
```

- `stops:routes`: `停留所<TAB>系列` を 1 行ずつ出力
- `stops:route-count`: `停留所<TAB>系列数` を出力
- `stops:direct-reachable-count`: `停留所<TAB>直通到達可能停留所数` を出力
- `stops:one-transfer-reachable-count`: `停留所<TAB>1回乗り換え到達可能停留所数` を出力
- `stops:route-reachable`: `乗車停留所<TAB>系列<TAB>到達可能停留所` を 1 行ずつ出力

共通オプション:

- `-i, --input <file>`: 入力 JSON ファイルを指定
- `--match <keyword>`: 停留所名で部分一致フィルタ
- `--verbose`: 入力ファイルやフィルタを stderr に表示

出力例:

```json
{
  "generatedAt": "2026-03-31T00:00:00.000Z",
  "sourceUrl": "https://www2.city.kyoto.lg.jp/kotsu/busdia/keitou/keitou.htm",
  "routeCount": 1,
  "routes": [
    {
      "routeName": "206",
      "title": "206 号系統の停車停留所",
      "url": "https://www2.city.kyoto.lg.jp/kotsu/busdia/keitou/kto/20600.htm",
      "stops": ["京都駅前", "七条大宮・京都水族館前"]
    }
  ]
}
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
