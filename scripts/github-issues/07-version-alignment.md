## 概要

`manifest.json` と `package.json` のバージョン番号が一致していません。

## リスク

- **低** — 審査直接影響は小さいが、リリース管理の混乱要因

## 現状

- `manifest.json`: `1.2.0`
- `package.json`: `1.0.0`

## 推奨対策

- [ ] 公開前にバージョンを揃える
- [ ] 再提出のたびに manifest `version` を増やす運用ルールを README に記載

## 参照

- [docs/ChromeWebStoreへ公開する際の懸念事項.md](../docs/ChromeWebStoreへ公開する際の懸念事項.md) §2.3
