import '@src/SidePanel.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage, domPathStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useState, useEffect } from 'react';

// 先创建一个简单的测试版本
const SimpleCaptureModule = () => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [markdownOutput, setMarkdownOutput] = useState('');
  const [domPath, setDomPath] = useState('');
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [editPathValue, setEditPathValue] = useState('');
  const [pathError, setPathError] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');

  // 初始化和URL监听
  useEffect(() => {
    const initializeWithCurrentTab = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.url) {
          setCurrentUrl(tab.url);
          // 尝试加载已保存的DOM路径
          const savedPath = await domPathStorage.loadPath(tab.url);
          if (savedPath) {
            setDomPath(savedPath);
            // 如果有保存的路径，自动应用
            await applyDomPath(savedPath);
          }
        }
      } catch (error) {
        console.error('初始化失败:', error);
      }
    };

    initializeWithCurrentTab();

    // 监听标签页变化
    const tabUpdateListener = async (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (changeInfo.url && tab.active) {
        setCurrentUrl(changeInfo.url);
        // 当URL变化时，加载新的DOM路径
        try {
          const savedPath = await domPathStorage.loadPath(changeInfo.url);
          if (savedPath) {
            setDomPath(savedPath);
            // 等待页面加载完成后再应用DOM路径
            setTimeout(async () => {
              await applyDomPath(savedPath);
            }, 1000); // 给页面一些时间加载
          } else {
            setDomPath('');
            setMarkdownOutput('');
          }
        } catch (error) {
          console.error('处理URL变化失败:', error);
          setDomPath('');
          setMarkdownOutput('');
        }
      }
    };

    // 监听标签页激活
    const tabActivatedListener = async (activeInfo: chrome.tabs.TabActiveInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.url) {
          setCurrentUrl(tab.url);
          const savedPath = await domPathStorage.loadPath(tab.url);
          if (savedPath) {
            setDomPath(savedPath);
            // 延迟应用，确保content script已加载
            setTimeout(async () => {
              await applyDomPath(savedPath);
            }, 500);
          } else {
            setDomPath('');
            setMarkdownOutput('');
          }
        }
      } catch (error) {
        console.error('处理标签页切换失败:', error);
      }
    };

    chrome.tabs.onUpdated.addListener(tabUpdateListener);
    chrome.tabs.onActivated.addListener(tabActivatedListener);

    return () => {
      chrome.tabs.onUpdated.removeListener(tabUpdateListener);
      chrome.tabs.onActivated.removeListener(tabActivatedListener);
    };
  }, []);

  useEffect(() => {
    // 监听来自内容脚本的消息
    const messageListener = (request: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
      if (!request || typeof request !== 'object') return;

      const msg = request as { action?: string; markdown?: string; domPath?: string };
      if (msg.action === 'elementSelected') {
        const newPath = msg.domPath || '';
        const newMarkdown = msg.markdown || '';

        setMarkdownOutput(newMarkdown);
        setDomPath(newPath);
        setIsSelecting(false);

        // 保存DOM路径
        if (newPath && currentUrl) {
          domPathStorage.savePath(currentUrl, newPath);
        }

        sendResponse({ success: true });
      } else if (msg.action === 'elementDataUpdate') {
        const newPath = msg.domPath || '';
        const newMarkdown = msg.markdown || '';

        setMarkdownOutput(newMarkdown);
        setDomPath(newPath);

        // 保存DOM路径
        if (newPath && currentUrl) {
          domPathStorage.savePath(currentUrl, newPath);
        }

        sendResponse({ success: true });
      } else if (msg.action === 'selectionStopped') {
        setIsSelecting(false);
        sendResponse({ success: true });
      } else if (msg.action === 'navigationExited') {
        setIsSelecting(false);
        sendResponse({ success: true });
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [currentUrl]);

  const startSelection = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id!, { action: 'startSelection' });
      setIsSelecting(true);
    } catch (error) {
      console.error('启动选择模式失败:', error);
    }
  };

  const stopSelection = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id!, { action: 'stopSelection' });
      setIsSelecting(false);
    } catch (error) {
      console.error('停止选择模式失败:', error);
    }
  };

  const smartSelect = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.tabs.sendMessage(tab.id!, { action: 'smartSelect' });
      setIsSelecting(false);
    } catch (error) {
      console.error('智能选择失败:', error);
    }
  };

  const copyToClipboard = async () => {
    if (!markdownOutput) return;

    try {
      await navigator.clipboard.writeText(markdownOutput);
      // 可以添加一个简单的提示
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  const downloadMarkdown = () => {
    if (!markdownOutput) return;

    try {
      // 从 markdown 内容中提取 slug
      const slug = extractSlugFromMarkdown(markdownOutput);
      const filename = `${slug}.md`;

      // 创建 Blob 对象
      const blob = new Blob([markdownOutput], { type: 'text/markdown;charset=utf-8' });

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;

      // 触发下载
      document.body.appendChild(a);
      a.click();

      // 清理
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  const extractSlugFromMarkdown = (markdown: string): string => {
    try {
      // 匹配 frontmatter 中的 slug
      const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatter = frontmatterMatch[1];
        const slugMatch = frontmatter.match(/^slug:\s*(.+)$/m);
        if (slugMatch && slugMatch[1]) {
          return slugMatch[1].trim();
        }
      }

      // 如果没有找到 slug，使用时间戳作为默认值
      const timestamp = new Date().getTime();
      return `content-${timestamp}`;
    } catch (error) {
      console.error('提取 slug 失败:', error);
      const timestamp = new Date().getTime();
      return `content-${timestamp}`;
    }
  };

  const clearContent = () => {
    setMarkdownOutput('');
    setDomPath('');
  };

  const copyDomPath = async () => {
    if (!domPath) return;

    try {
      await navigator.clipboard.writeText(domPath);
      // 可以添加一个简单的提示
    } catch (error) {
      console.error('复制DOM路径失败:', error);
    }
  };

  // 应用DOM路径到页面
  const applyDomPath = async (path: string, retryCount = 0) => {
    if (!path) return;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        console.error('无法获取标签页ID');
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: 'applyDomPath', domPath: path });

      if (!response || !response.success) {
        console.error('应用DOM路径失败:', response?.error || '未知错误');
        // 如果应用失败，清空markdown
        setMarkdownOutput('');
      }
    } catch (error) {
      console.error('应用DOM路径失败:', error);
      // 网络错误或content script未准备好时，最多重试2次
      if (retryCount < 2) {
        setTimeout(() => {
          applyDomPath(path, retryCount + 1);
        }, 2000);
      } else {
        console.error('重试次数已达上限，停止尝试应用DOM路径');
        setMarkdownOutput('');
      }
    }
  };

  // 验证DOM路径格式
  const validateDomPath = (path: string): string => {
    if (!path.trim()) {
      return '路径不能为空';
    }

    // 简单验证CSS选择器格式
    try {
      document.querySelector(path);
      return '';
    } catch (error) {
      return '无效的CSS选择器格式';
    }
  };

  // 开始编辑DOM路径
  const startEditPath = () => {
    setEditPathValue(domPath);
    setIsEditingPath(true);
    setPathError('');
  };

  // 保存编辑的DOM路径
  const saveEditPath = async () => {
    const error = validateDomPath(editPathValue);
    if (error) {
      setPathError(error);
      return;
    }

    setDomPath(editPathValue);
    setIsEditingPath(false);
    setPathError('');

    // 保存到存储
    if (currentUrl) {
      await domPathStorage.savePath(currentUrl, editPathValue);
    }

    // 应用新路径
    await applyDomPath(editPathValue);
  };

  // 取消编辑
  const cancelEditPath = () => {
    setIsEditingPath(false);
    setEditPathValue('');
    setPathError('');
  };

  return (
    <div className="flex h-full flex-col p-4">
      <h2 className="mb-4 text-lg font-semibold">页面捕获</h2>

      <div className="mb-4 space-y-2">
        <div className="flex space-x-2">
          {!isSelecting ? (
            <button
              onClick={startSelection}
              className="flex-1 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
              🎯 开始选择元素
            </button>
          ) : (
            <button onClick={stopSelection} className="flex-1 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700">
              ⏹️ 停止选择
            </button>
          )}
          <button onClick={smartSelect} className="flex-1 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700">
            🤖 智能选择
          </button>
        </div>
      </div>

      {/* DOM路径显示 */}
      {domPath && (
        <div className="mb-4 rounded border border-gray-200 p-3 dark:border-gray-600">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium">DOM路径</h3>
            <div className="flex space-x-1">
              <button
                onClick={() => applyDomPath(domPath)}
                className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800">
                🎯 选中
              </button>
              <button
                onClick={copyDomPath}
                className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
                📋 复制
              </button>
              <button
                onClick={startEditPath}
                className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800">
                ✏️ 编辑
              </button>
            </div>
          </div>

          {!isEditingPath ? (
            <code className="block rounded bg-gray-100 p-2 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {domPath}
            </code>
          ) : (
            <div className="space-y-2">
              <textarea
                value={editPathValue}
                onChange={e => setEditPathValue(e.target.value)}
                className="w-full rounded border border-gray-300 p-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-800"
                rows={3}
                placeholder="输入CSS选择器路径..."
              />
              {pathError && <p className="text-xs text-red-600 dark:text-red-400">{pathError}</p>}
              <div className="flex space-x-2">
                <button
                  onClick={saveEditPath}
                  className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700">
                  ✓ 保存
                </button>
                <button
                  onClick={cancelEditPath}
                  className="rounded bg-gray-500 px-3 py-1 text-xs text-white hover:bg-gray-600">
                  ✗ 取消
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {markdownOutput ? (
          <div className="flex h-full flex-col">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">Markdown内容</h3>
              <div className="flex space-x-2">
                <button
                  onClick={downloadMarkdown}
                  className="rounded bg-green-100 px-3 py-1 text-sm text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800">
                  📥 下载
                </button>
                <button
                  onClick={copyToClipboard}
                  className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
                  📋 复制
                </button>
                <button
                  onClick={clearContent}
                  className="rounded bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800">
                  🗑️ 清空
                </button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto rounded bg-gray-100 p-4 text-sm dark:bg-gray-800">
              {markdownOutput}
            </pre>
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">
            <div className="mb-2 text-4xl">📄</div>
            <p>选择网页元素来捕获内容</p>
          </div>
        )}
      </div>
    </div>
  );
};

// 简单的文本处理模块
const SimpleTextModule = () => {
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [selectedTool, setSelectedTool] = useState<string>('');

  const tools = [
    { id: 'format', name: '格式化', icon: '📝', desc: '清理和格式化文本' },
    { id: 'case', name: '大小写', icon: '🔤', desc: '转换文本大小写' },
    { id: 'translate', name: '翻译', icon: '🌐', desc: '文本翻译(即将上线)' },
    { id: 'summary', name: '摘要', icon: '📋', desc: '生成摘要(即将上线)' },
  ];

  const processText = () => {
    if (!inputText.trim() || !selectedTool) return;

    let result = '';
    switch (selectedTool) {
      case 'format':
        result = inputText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line)
          .join('\n');
        break;
      case 'case':
        result = `大写：${inputText.toUpperCase()}\n小写：${inputText.toLowerCase()}\n首字母大写：${inputText.charAt(0).toUpperCase() + inputText.slice(1).toLowerCase()}`;
        break;
      case 'translate':
      case 'summary':
        result = `${tools.find(t => t.id === selectedTool)?.name}功能即将上线，敬请期待！\n\n输入文本：\n${inputText}`;
        break;
      default:
        result = inputText;
    }
    setOutputText(result);
  };

  return (
    <div className="flex h-full flex-col p-4">
      <h2 className="mb-4 text-lg font-semibold">文本处理</h2>

      {/* 工具选择 */}
      <div className="mb-4">
        <h3 className="mb-2 text-sm font-medium">选择工具</h3>
        <div className="grid grid-cols-2 gap-2">
          {tools.map(tool => (
            <button
              key={tool.id}
              onClick={() => setSelectedTool(tool.id)}
              className={cn(
                'rounded border p-2 text-left transition-colors',
                selectedTool === tool.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 hover:border-gray-300 dark:border-gray-600',
              )}
              title={tool.desc}>
              <span className="text-sm">
                {tool.icon} {tool.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 输入区域 */}
      <div className="mb-4">
        <label htmlFor="input-text" className="mb-2 block text-sm font-medium">
          输入文本
        </label>
        <textarea
          id="input-text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="在此输入或粘贴文本..."
          className="h-20 w-full resize-none rounded border border-gray-200 bg-white p-2 dark:border-gray-600 dark:bg-gray-800"
        />
        <button
          onClick={processText}
          disabled={!inputText.trim() || !selectedTool}
          className="mt-2 w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400">
          开始处理
        </button>
      </div>

      {/* 输出区域 */}
      <div className="flex-1 overflow-auto">
        {outputText ? (
          <div className="flex h-full flex-col">
            <h3 className="mb-2 text-sm font-medium">处理结果</h3>
            <pre className="flex-1 overflow-auto rounded bg-gray-100 p-3 text-sm dark:bg-gray-800">{outputText}</pre>
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">
            <div className="mb-2 text-4xl">📝</div>
            <p>选择工具并输入文本开始处理</p>
          </div>
        )}
      </div>
    </div>
  );
};

const SidePanel = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const [activeTab, setActiveTab] = useState('capture');

  const tabs = [
    { id: 'capture', name: '捕获', icon: '🎯' },
    { id: 'text', name: '文本', icon: '📝' },
    { id: 'dev', name: '开发', icon: '🛠️' },
    { id: 'tools', name: '工具', icon: '⚡' },
    { id: 'profile', name: '我的', icon: '👤' },
  ];

  return (
    <div
      className={cn('flex h-screen w-full flex-col', isLight ? 'bg-white text-gray-900' : 'bg-gray-900 text-gray-100')}>
      {/* 导航标签 */}
      <nav className="flex border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex min-h-[60px] flex-1 flex-col items-center justify-center px-1 py-2 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
            )}>
            <span className="mb-1 text-xl">{tab.icon}</span>
            <span className="text-xs leading-tight">{tab.name}</span>
          </button>
        ))}
      </nav>

      {/* 内容区域 */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'capture' && <SimpleCaptureModule />}
        {activeTab === 'text' && <SimpleTextModule />}
        {activeTab !== 'capture' && activeTab !== 'text' && (
          <div className="p-4 text-center">
            <div className="mb-4 text-4xl">🚧</div>
            <h3 className="mb-2 text-lg font-medium">{tabs.find(t => t.id === activeTab)?.name}</h3>
            <p className="text-gray-600 dark:text-gray-400">功能开发中...</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
