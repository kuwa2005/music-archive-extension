# Privacy Policy

**Music Production Archive** (Chrome extension)  
**Last updated:** June 9, 2026  
**Repository:** https://github.com/kuwa2005/music-archive-extension

This policy describes how the extension handles information. It applies to the Chrome extension distributed from the Chrome Web Store and to builds installed from the GitHub repository.

## Summary

- **No automatic collection.** Data is saved **only when you explicitly choose to save** (popup button, context menu, or equivalent user action). The extension does not capture or upload data in the background without your action.
- **Local storage only.** Saved data stays in your browser (IndexedDB and extension local storage). **Nothing is sent to the developer's servers or third-party analytics services.**
- **You control export and deletion.** You can export JSON backups and delete entries from the search dashboard.

## What the extension does

The extension helps you archive music-production-related content from supported websites (Suno and selected AI chat services) and search it locally. It reads page content **at the moment you request a save**, extracts titles, lyrics, prompts, and related metadata, and stores them on your device.

## Data collected and stored locally

When you save, the extension may store:

| Data | Purpose |
|------|---------|
| Page title, lyrics, style/prompt text | Search and archive |
| Source URL, platform (Suno / AI service) | Open original pages, filter results |
| Timestamps (saved / Suno created when available) | Sorting and display |
| AI persona/name when shown on the page | Filtering and display |
| Manual links you create between entries | Cross-reference AI chats and Suno songs |
| Settings (e.g. auto-link threshold, theme) | Extension behavior |

Auto-linking (matching similar lyrics/titles between saved entries) runs **locally** after a save you initiated. It does not send data externally.

## Manual save only

Saving occurs **only** when you:

1. Click **Save current page** in the extension popup, or  
2. Use a **context menu** item such as "Save this Suno song" or "Save this AI conversation", or  
3. Import a JSON file you previously exported (your data).

There is **no** automatic save on page load, navigation, or DOM changes. Unsaved browsing activity is not recorded.

## Where data is stored

- **IndexedDB** (`MusicArchiveDB`) — archive entries and links  
- **`chrome.storage.local`** — settings and UI preferences  

Data remains on your device until you delete it, uninstall the extension, or clear browser/extension data.

## Data transmission

The extension **does not** transmit your archive contents to the developer or to third parties for storage or analytics.

Network access is limited to:

- Reading content from **supported sites** you have open when you save (via content scripts and, for some Suno metadata, Suno's public API from your browser).
- Normal browser requests when you open a saved URL from the dashboard.

## Export, import, and deletion

From **Settings → Data management** in the search dashboard you can:

- **Export** all archive data as JSON  
- **Import** JSON (append or replace, with optional protection for marked entries)  
- **Delete** individual entries or bulk-delete by criteria  

Uninstalling the extension or clearing site/extension data in Chrome removes local storage according to Chrome's behavior.

## Permissions (why they are needed)

| Permission | Use |
|------------|-----|
| `storage` / `unlimitedStorage` | Settings and local archive size |
| `activeTab` / `tabs` | Save from the active tab; open dashboard |
| `contextMenus` | Save and open dashboard from the page menu |
| `notifications` | Optional save/auto-link confirmation when in-page dialog is unavailable |
| Host permissions (Suno, ChatGPT, Claude, Gemini, Copilot, Perplexity, Poe) | Run content scripts and read page data **only when you save** on those sites |

## Supported sites

Host permissions cover Suno (`suno.com`) and major AI chat sites listed in the extension manifest. The extension is **not** affiliated with, endorsed by, or an official product of Suno, OpenAI, Anthropic, Google, Microsoft, Perplexity, Poe, or other third-party services. Use complies with your agreements with those services.

## Children

The extension is not directed at children under 13. We do not knowingly collect personal information from children.

## Changes

We may update this policy. The current version is published in the GitHub repository. Material changes will be reflected in the "Last updated" date.

## Contact

For privacy questions or requests regarding this extension:

- **GitHub Issues:** https://github.com/kuwa2005/music-archive-extension/issues  
- **Repository:** https://github.com/kuwa2005/music-archive-extension

---

Japanese translation: [privacy-policy.ja.md](./privacy-policy.ja.md)
