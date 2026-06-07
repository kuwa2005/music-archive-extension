import {
  parseClipIdFromUrl,
  extractStyleFromRoot,
  detectListContext,
} from '../lib/suno-selectors.js';
import { sourceFromListContext } from '../lib/suno-sources.js';

/**
 * @param {string} text
 * @param {Set<string>} urlSet
 */
function extractUrlsFromText(text, urlSet) {
  if (!text) return;
  const patterns = [
    /https?:\/\/suno\.com\/song\/[a-f0-9-]{36}/gi,
    /\/song\/[a-f0-9-]{36}/gi,
  ];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (!matches) continue;
    for (const match of matches) {
      try {
        const url = match.startsWith('http')
          ? match
          : new URL(match, window.location.origin).href;
        if (url.includes('/song/')) {
          urlSet.add(url.split('?')[0].split('#')[0]);
        }
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * @returns {Set<string>}
 */
function collectSongUrls() {
  const urls = new Set();
  document.querySelectorAll('a[href*="/song/"]').forEach((a) => {
    const href = a.href || a.getAttribute('href') || '';
    extractUrlsFromText(href, urls);
  });
  document.querySelectorAll('script').forEach((script) => {
    extractUrlsFromText(script.textContent || '', urls);
  });
  extractUrlsFromText(document.body?.innerText || '', urls);
  return urls;
}

/**
 * @param {string} url
 * @returns {{ title: string, stylePrompt: string, imageUrl: string }}
 */
function extractRowMeta(url) {
  const uuid = url.split('/').pop();
  let link = document.querySelector(`a[href="/song/${uuid}"], a[href*="/song/${uuid}"]`);
  if (!link) {
    const all = document.querySelectorAll('a[href*="/song/"]');
    for (const l of all) {
      if ((l.href || '').includes(uuid)) {
        link = l;
        break;
      }
    }
  }

  let title = '';
  let stylePrompt = '';
  let imageUrl = '';

  if (link) {
    title = link.textContent.trim() || link.getAttribute('title') || link.getAttribute('aria-label') || '';
    const parent = link.closest(
      '[data-testid="clip-row"], [class*="clip-row"], [class*="song"], [class*="card"], [role="row"]',
    );
    if (parent) {
      stylePrompt = extractStyleFromRoot(parent);
      if (!title) {
        const pt = parent.textContent.trim();
        title = pt.split('\n')[0]?.trim() || '';
      }
      const img = parent.querySelector('img[src], img[data-src]');
      if (img) {
        imageUrl = img.getAttribute('data-src') || img.src || '';
      }
    }
  }

  return { title, stylePrompt, imageUrl };
}

/**
 * @returns {Partial<import('../types.js').Entry>[]}
 */
function extractListEntries() {
  const ctx = detectListContext(window.location.href, document.title);
  const source = sourceFromListContext(ctx);
  const listContext = `${ctx.type}:${ctx.label}`;
  const urls = collectSongUrls();
  const entries = [];

  for (const url of urls) {
    const clipId = parseClipIdFromUrl(url);
    const meta = extractRowMeta(url);
    entries.push({
      source,
      title: meta.title,
      stylePrompt: meta.stylePrompt,
      sourceUrl: url,
      clipId: clipId || undefined,
      listContext,
      imageUrl: meta.imageUrl,
      capturedAt: new Date().toISOString(),
    });
  }
  return entries;
}

let debounceTimer = null;
const seenUrls = new Set();

async function flushListCapture() {
  const entries = extractListEntries().filter((e) => {
    if (!e.sourceUrl || seenUrls.has(e.sourceUrl)) return false;
    seenUrls.add(e.sourceUrl);
    return true;
  });
  if (!entries.length) return;

  try {
    const res = await chrome.runtime.sendMessage({ action: 'getSettings' });
    if (res?.settings?.autoSaveList) {
      await chrome.runtime.sendMessage({ action: 'saveEntries', data: entries });
    }
  } catch {
    /* ignore */
  }
}

function scheduleCapture() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushListCapture, 800);
}

const scrollObserver = new IntersectionObserver(
  () => scheduleCapture(),
  { root: null, rootMargin: '200px', threshold: 0 },
);

function observeRows() {
  document.querySelectorAll('a[href*="/song/"]').forEach((el) => {
    scrollObserver.observe(el);
  });
}

const domObserver = new MutationObserver(() => {
  observeRows();
  scheduleCapture();
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'captureSunoList') {
    sendResponse({ success: true, data: extractListEntries() });
    return true;
  }
  return false;
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    observeRows();
    domObserver.observe(document.body, { childList: true, subtree: true });
    scheduleCapture();
  });
} else {
  observeRows();
  domObserver.observe(document.body, { childList: true, subtree: true });
  scheduleCapture();
}

window.addEventListener('scroll', scheduleCapture, { passive: true });
