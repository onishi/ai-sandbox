# kinki-zoo

近畿一円の動物園情報を提供する Web サービスです。TypeScript + Cloudflare Workers で実装し、ローカル開発は `wrangler dev` で行います。

## 仕様

### 概要

- 近畿地方（大阪・京都・兵庫・奈良・滋賀・和歌山）の動物園・動物施設を一覧表示
- 都道府県での絞り込みが可能
- ブラウザで見やすい HTML ページと、アプリ連携向けの JSON API を提供

### エンドポイント

| パス | 説明 |
|------|------|
| `GET /` | 動物園一覧 HTML（都道府県タブで絞り込み可） |
| `GET /api/zoos` | 全動物園を JSON で返す |
| `GET /api/zoos?pref=osaka` | 都道府県コードで絞り込んだ動物園を返す |
| `GET /api/zoos/:id` | 特定の動物園の詳細を JSON で返す |

### 都道府県コード

| コード | 都道府県 |
|--------|---------|
| `osaka` | 大阪府 |
| `kyoto` | 京都府 |
| `hyogo` | 兵庫県 |
| `nara` | 奈良県 |
| `shiga` | 滋賀県 |
| `wakayama` | 和歌山県 |

### 動物園データ構造（JSON）

```json
{
  "id": "tennoji-zoo",
  "name": "天王寺動物園",
  "nameKana": "てんのうじどうぶつえん",
  "prefecture": "osaka",
  "address": "大阪府大阪市天王寺区茶臼山町1-108",
  "lat": 34.6494,
  "lon": 135.5063,
  "openingHours": "9:30〜17:00（入園は16:00まで）",
  "closedDays": "毎週月曜日（祝日の場合は翌平日）、年末年始",
  "admission": "大人500円、中学生以下無料",
  "website": "https://www.tennojizoo.jp/",
  "features": ["パンダ", "大型類人猿", "夜行性動物館"]
}
```

## 開発計画

### フェーズ 1（このPR）: ローカルで動く MVP

- [x] README.md（本ファイル）
- [x] 動物園データ（`src/data.ts`）— 近畿の主要施設をハードコード
- [x] TypeScript 型定義（`src/types.ts`）
- [x] Cloudflare Worker エントリポイント（`src/index.ts`）
  - HTML 一覧ページ（都道府県タブ付き）
  - JSON API `/api/zoos`
  - JSON API `/api/zoos/:id`
- [x] `wrangler.toml`、`package.json`、`tsconfig.json`

### フェーズ 2（将来）: データ拡充・機能追加

各項目は以下のリンクから GitHub issue として起票できます。

- [ ] [動物園データの外部ソース連携（Wikipedia / 公式サイト）](https://github.com/onishi/ai-sandbox/issues/new?title=kinki-zoo%3A%20%E5%8B%95%E7%89%A9%E5%9C%92%E3%83%87%E3%83%BC%E3%82%BF%E3%81%AE%E5%A4%96%E9%83%A8%E3%82%BD%E3%83%BC%E3%82%B9%E3%82%92%E9%80%A3%E6%90%BA%E3%81%99%E3%82%8B)
- [ ] [地図表示（Leaflet.js）](https://github.com/onishi/ai-sandbox/issues/new?title=kinki-zoo%3A%20%E5%9C%B0%E5%9B%B3%E8%A1%A8%E7%A4%BA%E3%82%92%E8%BF%BD%E5%8A%A0%E3%81%99%E3%82%8B)
- [ ] [動物検索（「パンダがいる動物園」など）](https://github.com/onishi/ai-sandbox/issues/new?title=kinki-zoo%3A%20%E5%8B%95%E7%89%A9%E6%A4%9C%E7%B4%A2%E3%82%92%E8%BF%BD%E5%8A%A0%E3%81%99%E3%82%8B)
- [ ] [Cloudflare KV にデータをキャッシュ](https://github.com/onishi/ai-sandbox/issues/new?title=kinki-zoo%3A%20Cloudflare%20KV%20%E3%81%AB%E3%83%87%E3%83%BC%E3%82%BF%E3%82%92%E3%82%AD%E3%83%A3%E3%83%83%E3%82%B7%E3%83%A5%E3%81%99%E3%82%8B)
- [ ] [Cloudflare Pages フロントエンド分離](https://github.com/onishi/ai-sandbox/issues/new?title=kinki-zoo%3A%20Cloudflare%20Pages%20%E3%83%95%E3%83%AD%E3%83%B3%E3%83%88%E3%82%A8%E3%83%B3%E3%83%89%E3%82%92%E5%88%86%E9%9B%A2%E3%81%99%E3%82%8B)

## セットアップ

```bash
cd kinki-zoo
npm install
```

## ローカル開発

```bash
npm run dev
```

ブラウザで `http://localhost:8787` を開くと動物園一覧が表示されます。

## 型チェック

```bash
npm run typecheck
```

## Cloudflare へのデプロイ

```bash
npm run deploy
```

`wrangler login` でログインしておく必要があります。

## 情報源

- 各動物園の公式サイト
- 環境省「全国動物園・水族館等調査」
