import 'webextension-polyfill';
import { dbManager } from '@extension/shared';

console.log('[SuperSider] Background script loaded');

// 初始化数据库
dbManager
  .initialize()
  .then(() => {
    console.log('[SuperSider] Database initialized');
  })
  .catch(error => {
    console.error('[SuperSider] Database initialization failed:', error);
  });

// 启用侧边面板自动打开
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
}

// 监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[SuperSider] Background received message:', request);

  if (request.action === 'convertToMarkdown') {
    sendResponse({ success: true });
  } else if (request.action === 'elementSelected') {
    // 转发消息给侧边栏（如果需要的话）
    sendResponse({ success: true });
  } else if (request.action === 'elementDataUpdate') {
    // 处理实时数据更新
    sendResponse({ success: true });
  } else if (request.action === 'selectionStopped') {
    sendResponse({ success: true });
  } else if (request.action === 'navigationExited') {
    sendResponse({ success: true });
  }

  return true; // 保持消息通道开放
});

// 监听标签页更新事件，确保内容脚本正常工作
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // 可以在这里注入内容脚本或进行其他初始化操作
    console.log('[SuperSider] Tab updated:', tab.url);
  }
});

console.log('[SuperSider] Background script initialized');
