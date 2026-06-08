/**
 * アクティブタブ上の dialog-host コンテンツスクリプトへメッセージダイアログを表示する。
 * @param {number} tabId
 * @param {string} message
 * @param {'alert' | 'confirm'} [mode]
 * @returns {Promise<{ shown: boolean, confirmed?: boolean }>}
 */
export async function showTabDialog(tabId, message, mode = 'alert') {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      action: 'showExtensionDialog',
      message,
      mode,
    });
    if (response?.success) {
      return { shown: true, confirmed: response.confirmed };
    }
  } catch {
    /* content script 未注入・タブ終了など */
  }
  return { shown: false };
}
