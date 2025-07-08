import { ElementSelector } from '@extension/shared';

console.log('[SuperSider] Content script loaded');

class SuperSiderElementSelector extends ElementSelector {
  protected onElementSelected(): void {
    const data = this.getSelectedElementData();
    if (data) {
      // 发送数据到侧边栏
      chrome.runtime.sendMessage({
        action: 'elementSelected',
        html: data.html,
        markdown: data.markdown,
        slug: data.slug,
        domPath: data.domPath,
      });
    }

    // 通知侧边栏导航模式已退出
    chrome.runtime.sendMessage({
      action: 'navigationExited',
    });
  }

  protected onElementDataUpdate(): void {
    const data = this.getSelectedElementData();
    if (data) {
      // 实时更新侧边栏中的数据
      chrome.runtime.sendMessage({
        action: 'elementDataUpdate',
        html: data.html,
        markdown: data.markdown,
        slug: data.slug,
        domPath: data.domPath,
      });
    }
  }

  protected onSelectionCancelled(): void {
    // 通知侧边栏选择已停止
    chrome.runtime.sendMessage({
      action: 'selectionStopped',
    });
  }
}

// 创建选择器实例
const selector = new SuperSiderElementSelector({
  enableNavigation: true,
  showStatusMessages: true,
});

// 监听来自侧边栏的消息
chrome.runtime.onMessage.addListener(
  (request: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
    if (!request || typeof request !== 'object') return;

    const msg = request as { action?: string; domPath?: string };
    if (msg.action === 'startSelection') {
      selector.startSelection();
      sendResponse({ success: true });
    } else if (msg.action === 'stopSelection') {
      selector.stopSelection();
      sendResponse({ success: true });
    } else if (msg.action === 'smartSelect') {
      selector.smartSelect();
      sendResponse({ success: true });
    } else if (msg.action === 'applyDomPath') {
      try {
        const element = document.querySelector(msg.domPath || '');
        if (element) {
          selector.setSelectedElement(element);
          selector.highlightSelectedElement();
          selector.triggerElementSelected(element);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: '未找到指定元素' });
        }
      } catch (error) {
        sendResponse({ success: false, error: '无效的DOM路径' });
      }
    }
  },
);

// 导出选择器实例供调试使用
(window as any).superSiderSelector = selector;
