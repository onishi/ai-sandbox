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

`-o` を付けない場合、出力先は自動で決まります。

- 全系統: `data/kyoto-city-route-stops-all.json`
- `206` を指定: `data/kyoto-city-route-stops-206.json`
- `46 206` を指定: `data/kyoto-city-route-stops-46-206.json`

全系統を取得する場合は、京都市サイトへの連続アクセスを避けるため、系統ページごとに 1 秒待ってから次のリクエストを送ります。

## JSON 集計コマンド

スクレイプ済みの JSON を読み取って集計する CLI もあります。入力ファイルはデフォルトで `data/kyoto-city-route-stops-all.json` を使い、読めない場合はエラーになります。

```bash
npm run stats:route-stops -- stop-routes
npm run stats:route-stops -- route-stops-count
npm run stats:route-stops -- reachable-stops-count
npm run stats:route-stops -- one-transfer-reachable-stops-count
npm run stats:route-stops -- routes-by-stop 京都駅前
npm run stats:route-stops -- stop-routes data/kyoto-city-route-stops-206.json
npm run stats:route-stops -- stop-routes -i data/routes.json
```

`stop-routes` は、停留所名とその停留所を通る路線一覧をタブ区切りで出力します。
`route-stops-count` は、停留所名とその停留所を通る路線数をタブ区切りで出力します。
`reachable-stops-count` は、停留所名とその停留所を通る路線で到達可能な停留所数をタブ区切りで出力します。停留所自身は件数に含めません。
`one-transfer-reachable-stops-count` は、停留所名と、同名停留所で 1 回乗り換えた場合に到達可能なユニーク停留所数をタブ区切りで出力します。停留所自身は件数に含めません。
`routes-by-stop` は、指定した停留所名に部分一致する停留所と、その停留所を含む路線一覧をタブ区切りで出力します。

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
