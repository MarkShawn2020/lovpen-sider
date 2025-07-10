import '@src/SidePanel.css';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage, domPathStorage, downloadSettingsStorage, copyFormatStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner, Select } from '@extension/ui';
import { useState, useEffect } from 'react';

// 下载设置面板组件
const DownloadSettingsPanel = ({ onClose }: { onClose: () => void }) => {
  const [settings, setSettings] = useState({
    askForLocation: true,
    useDefaultPath: false,
    defaultPath: 'Downloads',
    lastUsedPath: 'Downloads',
  });

  useEffect(() => {
    // 加载当前设置
    const loadSettings = async () => {
      try {
        const currentSettings = await downloadSettingsStorage.getSettings();
        setSettings(currentSettings);
      } catch (error) {
        console.error('加载设置失败:', error);
      }
    };

    loadSettings();

    // 监听存储变化以实时更新
    const handleStorageChange = () => {
      loadSettings();
    };

    // 添加存储变化监听器
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const updateSetting = async (key: string, value: any) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      await downloadSettingsStorage.updateSettings({ [key]: value });
    } catch (error) {
      console.error('更新设置失败:', error);
    }
  };

  return (
    <div className="mb-3 rounded border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-900">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium">下载设置</h4>
        <button
          onClick={onClose}
          className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600">
          ✕
        </button>
      </div>

      <div className="space-y-3">
        {/* 是否询问位置 */}
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-700 dark:text-gray-300">每次询问保存位置</label>
          <input
            type="checkbox"
            checked={settings.askForLocation}
            onChange={e => updateSetting('askForLocation', e.target.checked)}
            className="rounded"
          />
        </div>

        {/* 使用默认路径 */}
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-700 dark:text-gray-300">使用默认路径</label>
          <input
            type="checkbox"
            checked={settings.useDefaultPath}
            disabled={settings.askForLocation}
            onChange={e => updateSetting('useDefaultPath', e.target.checked)}
            className="rounded disabled:opacity-50"
          />
        </div>

        {/* 默认路径输入 */}
        {settings.useDefaultPath && !settings.askForLocation && (
          <div>
            <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">默认下载路径</label>
            <input
              type="text"
              value={settings.defaultPath}
              onChange={e => updateSetting('defaultPath', e.target.value)}
              placeholder="Downloads"
              className="w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800"
            />
          </div>
        )}

        {/* 最后使用的路径显示 */}
        {settings.lastUsedPath && settings.lastUsedPath !== 'Downloads' && (
          <div>
            <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">最后使用的路径</label>
            <div className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {settings.lastUsedPath}
            </div>
          </div>
        )}

        {/* 下载说明 */}
        {!settings.askForLocation && (
          <div className="mt-2 rounded bg-yellow-50 p-2 text-xs text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
            <div className="mb-1 font-medium">⚠️ 注意</div>
            <div>
              如果Chrome浏览器设置中开启了"下载前询问每个文件的保存位置"，仍然会显示保存对话框。这是浏览器级别的限制，扩展无法绕过。
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 先创建一个简单的测试版本
const SimpleCaptureModule = () => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [markdownOutput, setMarkdownOutput] = useState('');
  const [domPath, setDomPath] = useState('');
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [editPathValue, setEditPathValue] = useState('');
  const [pathError, setPathError] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [showDownloadSettings, setShowDownloadSettings] = useState(false);

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

  const downloadMarkdown = async () => {
    if (!markdownOutput) return;

    try {
      // 从 markdown 内容中提取 slug
      const slug = extractSlugFromMarkdown(markdownOutput);
      const filename = `${slug}.md`;

      // 获取下载设置
      const settings = await downloadSettingsStorage.getSettings();

      // 统一使用 Chrome downloads API
      await downloadWithChromeAPI(filename, settings);
    } catch (error) {
      console.error('下载失败:', error);
      // 最终回退方案
      fallbackDownload();
    }
  };

  const downloadWithChromeAPI = async (filename: string, settings: any) => {
    // 创建数据URL
    const dataUrl = `data:text/markdown;charset=utf-8,${encodeURIComponent(markdownOutput)}`;

    // 根据设置决定下载行为
    const downloadOptions: chrome.downloads.DownloadOptions = {
      url: dataUrl,
      filename: filename,
    };

    // 严格根据用户设置决定是否显示保存对话框
    if (settings.askForLocation) {
      downloadOptions.saveAs = true;
    } else {
      // 用户明确不想询问位置，强制不显示对话框
      downloadOptions.saveAs = false;

      if (settings.useDefaultPath && settings.defaultPath) {
        // 使用默认路径（相对于Downloads）
        downloadOptions.filename = `${settings.defaultPath}/${filename}`;
      } else {
        // 直接下载到Downloads文件夹
        downloadOptions.filename = filename;
      }
    }

    // 使用 Chrome downloads API
    const downloadId = await chrome.downloads.download(downloadOptions);

    // 监听下载完成事件以更新最后使用的路径
    const onDownloadChanged = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id === downloadId && delta.state?.current === 'complete') {
        chrome.downloads.search({ id: downloadId }, async results => {
          if (results.length > 0) {
            const downloadedFile = results[0];
            if (downloadedFile.filename) {
              // 提取目录路径
              const pathParts = downloadedFile.filename.split(/[/\\]/);
              pathParts.pop(); // 移除文件名
              const directoryPath = pathParts.join('/') || 'Downloads';

              if (directoryPath && directoryPath !== 'Downloads') {
                await downloadSettingsStorage.setLastUsedPath(directoryPath);
              }
            }
          }
        });

        // 移除监听器
        chrome.downloads.onChanged.removeListener(onDownloadChanged);
      }
    };

    chrome.downloads.onChanged.addListener(onDownloadChanged);
  };

  const fallbackDownload = () => {
    if (!markdownOutput) return;

    try {
      const slug = extractSlugFromMarkdown(markdownOutput);
      const filename = `${slug}.md`;

      const blob = new Blob([markdownOutput], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;

      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('回退下载失败:', error);
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
                  onClick={() => setShowDownloadSettings(!showDownloadSettings)}
                  className="rounded bg-blue-100 px-2 py-1 text-sm text-blue-700 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800">
                  ⚙️
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

            {/* 下载设置面板 */}
            {showDownloadSettings && <DownloadSettingsPanel onClose={() => setShowDownloadSettings(false)} />}

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

// 复制标题模块
const CopyTitleModule = () => {
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [customFormat, setCustomFormat] = useState('{title} - {url}');
  const [selectedFormat, setSelectedFormat] = useState('markdown');
  const [showCustomFormat, setShowCustomFormat] = useState(false);
  const [shortcuts, setShortcuts] = useState<{
    [key: string]: {
      enabled: boolean;
      command: string;
      description: string;
    };
  }>({});

  // 预设格式配置
  const formats = [
    { id: 'url', name: '纯网址', icon: '🔗', template: '{url}' },
    { id: 'title', name: '纯标题', icon: '📝', template: '{title}' },
    { id: 'title_url', name: '标题, 网址', icon: '📋', template: '{title}, {url}' },
    { id: 'markdown', name: 'Markdown', icon: '📄', template: '[{title}]({url})' },
    { id: 'custom', name: '自定义', icon: '⚙️', template: customFormat },
  ];

  // 初始化和监听当前标签页
  useEffect(() => {
    const getCurrentTabInfo = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.title && tab.url) {
          setCurrentTitle(tab.title);
          setCurrentUrl(tab.url);
        }
      } catch (error) {
        console.error('获取标签页信息失败:', error);
      }
    };

    const loadCopyFormatSettings = async () => {
      try {
        const settings = await copyFormatStorage.getSettings();
        setCustomFormat(settings.customFormat || '{title} - {url}');
        setSelectedFormat(settings.selectedFormat || 'markdown');
        if (settings.shortcuts) {
          setShortcuts(settings.shortcuts);
        }
      } catch (error) {
        console.error('加载复制格式设置失败:', error);
      }
    };

    getCurrentTabInfo();
    loadCopyFormatSettings();

    // 监听标签页变化
    const tabUpdateListener = async (tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (tab.active && (changeInfo.title || changeInfo.url)) {
        if (changeInfo.title) setCurrentTitle(changeInfo.title);
        if (changeInfo.url) setCurrentUrl(changeInfo.url);
      }
    };

    const tabActivatedListener = async (activeInfo: chrome.tabs.TabActiveInfo) => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab.title && tab.url) {
          setCurrentTitle(tab.title);
          setCurrentUrl(tab.url);
        }
      } catch (error) {
        console.error('获取激活标签页信息失败:', error);
      }
    };

    chrome.tabs.onUpdated.addListener(tabUpdateListener);
    chrome.tabs.onActivated.addListener(tabActivatedListener);

    return () => {
      chrome.tabs.onUpdated.removeListener(tabUpdateListener);
      chrome.tabs.onActivated.removeListener(tabActivatedListener);
    };
  }, []);

  // 生成格式化文本
  const generateFormattedText = (template: string) =>
    template.replace(/{title}/g, currentTitle).replace(/{url}/g, currentUrl);

  // 复制选中格式
  const copySelectedFormat = async () => {
    const format = formats.find(f => f.id === selectedFormat);
    if (!format) return;

    const template = selectedFormat === 'custom' ? customFormat : format.template;
    const text = generateFormattedText(template);

    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(`✅ 已复制：${format.name}`);

      // 将格式添加到历史记录
      await copyFormatStorage.addFormatToHistory(template);

      setTimeout(() => setCopyFeedback(''), 2000);
    } catch (error) {
      console.error('复制失败:', error);
      setCopyFeedback('❌ 复制失败');
      setTimeout(() => setCopyFeedback(''), 2000);
    }
  };

  // 预览格式化文本
  const previewText = (template: string) => {
    if (!currentTitle || !currentUrl) return '等待页面加载...';
    return generateFormattedText(template);
  };

  // 保存自定义格式
  const saveCustomFormat = async () => {
    try {
      await copyFormatStorage.setCustomFormat(customFormat);
      setCopyFeedback('✅ 自定义格式已保存');
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch (error) {
      console.error('保存自定义格式失败:', error);
      setCopyFeedback('❌ 保存失败');
      setTimeout(() => setCopyFeedback(''), 2000);
    }
  };

  // 设置选中格式
  const handleFormatChange = async (formatId: string) => {
    setSelectedFormat(formatId);
    try {
      await copyFormatStorage.setSelectedFormat(formatId);
    } catch (error) {
      console.error('保存选中格式失败:', error);
    }
  };

  // 切换快捷键启用状态
  const toggleShortcut = async (command: string, enabled: boolean) => {
    try {
      await copyFormatStorage.toggleShortcut(command, enabled);
      setShortcuts(prev => ({
        ...prev,
        [command]: {
          ...(prev[command] || {}),
          enabled,
          command,
          description: prev[command]?.description || '',
        },
      }));
      setCopyFeedback(`✅ 快捷键已${enabled ? '启用' : '禁用'}`);
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch (error) {
      console.error('切换快捷键失败:', error);
      setCopyFeedback('❌ 操作失败');
      setTimeout(() => setCopyFeedback(''), 2000);
    }
  };

  // 获取快捷键显示文本
  const getShortcutText = (command: string) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcutMap: { [key: string]: { mac: string; windows: string } } = {
      'copy-title-selected': { mac: 'Ctrl⇧C', windows: 'Ctrl+Shift+K' },
    };
    return isMac ? shortcutMap[command]?.mac : shortcutMap[command]?.windows;
  };

  return (
    <div className="flex h-full flex-col p-4">
      <h2 className="mb-4 text-lg font-semibold">复制标题</h2>

      {/* 当前页面信息 */}
      <div className="mb-4 rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-800">
        <div className="mb-2">
          <label className="block text-xs text-gray-600 dark:text-gray-400">当前标题</label>
          <p className="text-sm font-medium">{currentTitle || '加载中...'}</p>
        </div>
        <div>
          <label className="block text-xs text-gray-600 dark:text-gray-400">当前网址</label>
          <p className="text-sm text-gray-700 dark:text-gray-300">{currentUrl || '加载中...'}</p>
        </div>
      </div>

      {/* 复制反馈 */}
      {copyFeedback && (
        <div className="mb-4 rounded bg-green-50 p-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300">
          {copyFeedback}
        </div>
      )}

      {/* 格式选择和复制 */}
      <div className="mb-4">
        <h3 className="mb-2 text-sm font-medium">选择复制格式</h3>
        <div className="space-y-3">
          {/* 格式选择器 */}
          <div>
            <Select
              value={selectedFormat}
              onValueChange={handleFormatChange}
              options={formats.map(f => ({
                value: f.id,
                label: f.name,
                icon: f.icon,
              }))}
              placeholder="选择格式"
              className="w-full"
            />
          </div>

          {/* 预览 */}
          <div className="rounded bg-gray-100 p-3 dark:bg-gray-800">
            <label className="mb-1 block text-xs text-gray-600 dark:text-gray-400">预览</label>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {previewText(
                selectedFormat === 'custom' ? customFormat : formats.find(f => f.id === selectedFormat)?.template || '',
              )}
            </p>
          </div>

          {/* 复制按钮 */}
          <button
            onClick={copySelectedFormat}
            disabled={!currentTitle || !currentUrl}
            className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400">
            📋 复制选中格式
          </button>
        </div>
      </div>

      {/* 快捷键说明 */}
      <div className="mb-4">
        <div className="rounded bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          <div className="mb-1 font-medium">💡 使用说明</div>
          <div>
            • 使用上方下拉菜单选择复制格式
            <br />
            • 按 Ctrl⇧L 快捷键复制选中格式
            <br />• 如需修改快捷键，
            <button
              onClick={() => chrome.tabs.create({ url: 'chrome://extensions/configureCommands' })}
              className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400">
              点此打开设置页面
            </button>
          </div>
        </div>
      </div>

      {/* 快捷键开关 */}
      {Object.entries(shortcuts || {}).map(([command, config]) => (
        <div
          key={command}
          className="mb-4 flex items-center justify-between rounded border border-gray-200 p-3 dark:border-gray-600">
          <div className="flex items-center space-x-2">
            <span className="text-sm">{config.description}</span>
            <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              {getShortcutText(command)}
            </span>
          </div>
          <label className="flex cursor-pointer items-center">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={e => toggleShortcut(command, e.target.checked)}
              className="mr-2"
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">启用</span>
          </label>
        </div>
      ))}

      {/* 自定义格式设置 */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">自定义格式</h3>
          <button
            onClick={() => setShowCustomFormat(!showCustomFormat)}
            className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600">
            {showCustomFormat ? '隐藏' : '设置'}
          </button>
        </div>
        {showCustomFormat && (
          <div className="mt-2 space-y-2">
            <textarea
              value={customFormat}
              onChange={e => setCustomFormat(e.target.value)}
              placeholder="输入自定义格式，使用 {title} 和 {url} 作为占位符"
              className="w-full rounded border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-800"
              rows={3}
            />
            <button
              onClick={saveCustomFormat}
              className="w-full rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700">
              💾 保存格式
            </button>
            <div className="text-xs text-gray-500">
              <p>
                <strong>可用占位符:</strong>
              </p>
              <p>• {'{title}'} - 页面标题</p>
              <p>• {'{url}'} - 页面网址</p>
            </div>
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
    { id: 'copy', name: '复制', icon: '📋' },
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
        {activeTab === 'copy' && <CopyTitleModule />}
        {activeTab === 'text' && <SimpleTextModule />}
        {activeTab !== 'capture' && activeTab !== 'copy' && activeTab !== 'text' && (
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
