import { ElementSelector, FormDetector, FormFiller } from '@extension/shared';
import type { FormFillRequest } from '@extension/shared';

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

// 创建表单处理实例
const formDetector = new FormDetector();
const formFiller = new FormFiller();

// 监听来自侧边栏的消息
chrome.runtime.onMessage.addListener(
  (request: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
    if (!request || typeof request !== 'object') return false;

    const msg = request as { action?: string; domPath?: string; text?: string; data?: unknown };
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
      } catch {
        sendResponse({ success: false, error: '无效的DOM路径' });
      }
    } else if (msg.action === 'copyToClipboard') {
      // 处理剪贴板复制请求
      if (msg.text) {
        navigator.clipboard
          .writeText(msg.text)
          .then(() => {
            sendResponse({ success: true });
          })
          .catch(error => {
            console.error('[SuperSider] Failed to copy to clipboard:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // 保持消息通道开放
      } else {
        sendResponse({ success: false, error: '没有提供要复制的文本' });
      }
    } else if (msg.action === 'detectForms') {
      // 检测表单
      try {
        const forms = formDetector.detectForms();
        sendResponse({
          success: true,
          message: `检测到 ${forms.length} 个表单`,
          data: forms.map(form => ({
            formSelector: form.formSelector,
            formType: form.formType,
            confidence: form.confidence,
            fields: form.fields.map(field => ({
              id: field.id,
              type: field.type,
              label: field.label,
              required: field.required,
            })),
          })),
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '表单检测失败',
        });
      }
    } else if (msg.action === 'fillForm') {
      // 填写表单
      if (msg.data) {
        formFiller
          .fillForm(msg.data as FormFillRequest)
          .then(result => {
            sendResponse({
              success: result.success,
              message: result.message,
              data: {
                filledCount: result.filledCount,
                failedFields: result.failedFields,
                duration: result.duration,
              },
            });
          })
          .catch(error => {
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : '填写表单失败',
            });
          });
        return true; // 保持消息通道开放
      } else {
        sendResponse({ success: false, error: '没有提供表单数据' });
      }
    } else if (msg.action === 'clearForm') {
      // 清空表单
      try {
        const result = formFiller.clearForm(
          (msg.data as { formSelector?: string })?.formSelector || 'form:first-of-type',
        );
        sendResponse({
          success: result.success,
          message: result.message,
          data: {
            filledCount: result.filledCount,
            duration: result.duration,
          },
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '清空表单失败',
        });
      }
    } else if (msg.action === 'validateForm') {
      // 验证表单
      try {
        const result = formFiller.validateForm(
          (msg.data as { formSelector?: string })?.formSelector || 'form:first-of-type',
        );
        sendResponse({
          success: result.isValid,
          message: result.isValid ? '表单验证通过' : '表单验证失败',
          data: {
            isValid: result.isValid,
            errors: result.errors,
          },
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : '表单验证失败',
        });
      }
    }

    return false;
  },
);

// 导出选择器实例供调试使用
(window as unknown as { superSiderSelector: typeof selector }).superSiderSelector = selector;
