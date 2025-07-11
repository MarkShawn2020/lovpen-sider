import 'webextension-polyfill';
import { dbManager } from '@extension/shared';
import { copyFormatStorage } from '@extension/storage';

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

// 监听快捷键命令
chrome.commands.onCommand.addListener(async command => {
  console.log('[SuperSider] Command received:', command);

  try {
    // 检查快捷键是否启用
    const shortcuts = await copyFormatStorage.getShortcuts();
    console.log('[SuperSider] Available shortcuts:', shortcuts);

    // 如果 shortcuts 为 undefined 或者该命令不存在，则使用默认启用状态
    const isEnabled = shortcuts && shortcuts[command] ? shortcuts[command].enabled : true;

    if (!isEnabled) {
      console.log('[SuperSider] Shortcut disabled:', command);
      return;
    }

    console.log('[SuperSider] Shortcut enabled, proceeding...');

    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.title || !tab.url) {
      console.error('[SuperSider] Cannot get current tab info');
      return;
    }

    if (command === 'copy-title-selected') {
      // 获取选中的格式
      const settings = await copyFormatStorage.getSettings();
      const selectedFormat = settings.selectedFormat;

      let template = '';
      let formatName = '';

      // 根据格式类型确定模板
      switch (selectedFormat) {
        case 'markdown':
          template = '[{title}]({url})';
          formatName = 'Markdown';
          break;
        case 'title':
          template = '{title}';
          formatName = '纯标题';
          break;
        case 'url':
          template = '{url}';
          formatName = '纯网址';
          break;
        case 'custom':
          template = settings.customFormat;
          formatName = '自定义';
          break;
        case 'title_url':
          template = '{title}, {url}';
          formatName = '标题, 网址';
          break;
        default:
          template = '[{title}]({url})';
          formatName = 'Markdown';
      }

      // 生成格式化文本
      const formattedText = template.replace(/{title}/g, tab.title).replace(/{url}/g, tab.url);

      // 添加到历史记录
      await copyFormatStorage.addFormatToHistory(template);

      // 尝试写入剪贴板
      let copySuccess = true;
      let errorMessage = '';

      try {
        await copyToClipboard(formattedText);
      } catch (error) {
        copySuccess = false;
        errorMessage = error instanceof Error ? error.message : '未知错误';
      }

      // 显示通知
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon-34.png'),
        title: 'Super Sider',
        message: copySuccess ? `✅ 已复制：${formatName}` : `⚠️ 已生成（剪贴板访问失败）：${formatName}`,
      });

      if (copySuccess) {
        console.log('[SuperSider] Successfully copied:', formatName);
      } else {
        console.warn('[SuperSider] Generated but failed to copy:', formatName, 'Error:', errorMessage);
        console.log('[SuperSider] Generated text:', formattedText);
      }
    } else {
      console.error('[SuperSider] Unknown command:', command);
    }
  } catch (error) {
    console.error('[SuperSider] Error handling command:', error);

    // 显示错误通知（仅在非复制相关错误时显示）
    if (error instanceof Error && !error.message.includes('clipboard') && !error.message.includes('connection')) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon-34.png'),
        title: 'Super Sider',
        message: '❌ 操作失败',
      });
    }
  }
});

// 复制到剪贴板的辅助函数
async function copyToClipboard(text: string) {
  try {
    // 尝试注入 content script 到当前页面
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      throw new Error('无法获取当前标签页ID');
    }

    // 注入一个临时脚本来处理剪贴板
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (textToCopy: string) => {
        try {
          await navigator.clipboard.writeText(textToCopy);
          return { success: true };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      },
      args: [text],
    });

    return;
  } catch (error) {
    console.error('[SuperSider] Failed to copy to clipboard:', error);
    throw error;
  }
}

// 测试快捷键是否注册成功
chrome.commands.getAll().then(commands => {
  console.log('[SuperSider] Registered commands:', commands);
});

console.log('[SuperSider] Background script initialized');
