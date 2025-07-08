import '@src/SidePanel.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useState, useEffect } from 'react';

// 先创建一个简单的测试版本
const SimpleCaptureModule = () => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [markdownOutput, setMarkdownOutput] = useState('');

  useEffect(() => {
    // 监听来自内容脚本的消息
    const messageListener = (request: unknown, _sender: unknown, sendResponse: (response?: unknown) => void) => {
      if (!request || typeof request !== 'object') return;

      const msg = request as { action?: string; markdown?: string };
      if (msg.action === 'elementSelected') {
        setMarkdownOutput(msg.markdown || '');
        setIsSelecting(false);
        sendResponse({ success: true });
      } else if (msg.action === 'elementDataUpdate') {
        setMarkdownOutput(msg.markdown || '');
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
  }, [setMarkdownOutput, setIsSelecting]);

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

  const copyToClipboard = async () => {
    if (!markdownOutput) return;

    try {
      await navigator.clipboard.writeText(markdownOutput);
      // 可以添加一个简单的提示
    } catch (error) {
      console.error('复制失败:', error);
    }
  };

  return (
    <div className="flex h-full flex-col p-4">
      <h2 className="mb-4 text-lg font-semibold">页面捕获</h2>

      <div className="mb-4">
        {!isSelecting ? (
          <button
            onClick={startSelection}
            className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            🎯 开始选择元素
          </button>
        ) : (
          <button onClick={stopSelection} className="w-full rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700">
            ⏹️ 停止选择
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {markdownOutput ? (
          <div className="flex h-full flex-col">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">Markdown内容</h3>
              <button
                onClick={copyToClipboard}
                className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
                📋 复制
              </button>
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
