## 概要

「アーカイブを検索」コンテキストメニューが**すべての Web ページ**に表示されています。

## リスク

- **低** — 拒否理由になりにくいが、最小権限・UX の観点で改善余地あり

## 現状

- `open-dashboard` メニューに `documentUrlPatterns` 未指定
- 関連: `src/background/service-worker.js`

## 推奨対策

- [ ] `documentUrlPatterns` を Suno + 各 AI ドメインに限定
- [ ] または全サイト表示の理由をストア説明に記載

## 参照

- [docs/ChromeWebStoreへ公開する際の懸念事項.md](../docs/ChromeWebStoreへ公開する際の懸念事項.md) §2.1
