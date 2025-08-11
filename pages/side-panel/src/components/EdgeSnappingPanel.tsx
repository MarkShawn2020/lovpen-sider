import { edgeSnappingStorage } from '@extension/storage';
import { useState, useEffect } from 'react';
import type { EdgeSnappingConfig } from '@extension/storage';

export const EdgeSnappingPanel = ({ onClose }: { onClose: () => void }) => {
  const [settings, setSettings] = useState<Partial<EdgeSnappingConfig>>({});
  const [enabledForMarkers, setEnabledForMarkers] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await edgeSnappingStorage.getSettings();
        setSettings(data.settings);
        setEnabledForMarkers(data.enabledForMarkers);
      } catch (error) {
        console.error('加载边缘吸附设置失败:', error);
      }
    };

    loadSettings();
  }, []);

  const updateSetting = async (key: keyof EdgeSnappingConfig, value: any) => {
    try {
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      await edgeSnappingStorage.updateSettings({ settings: newSettings });

      setSaveFeedback('✅ 设置已保存');
      setTimeout(() => setSaveFeedback(''), 2000);
    } catch (error) {
      console.error('更新设置失败:', error);
      setSaveFeedback('❌ 保存失败');
      setTimeout(() => setSaveFeedback(''), 2000);
    }
  };

  const updateSnapToEdge = async (edge: 'top' | 'right' | 'bottom' | 'left', enabled: boolean) => {
    const snapToEdges = {
      ...(settings.snapToEdges || { top: true, right: true, bottom: true, left: true }),
      [edge]: enabled,
    };
    await updateSetting('snapToEdges', snapToEdges);
  };

  const toggleEnabledForMarkers = async () => {
    try {
      const newValue = !enabledForMarkers;
      setEnabledForMarkers(newValue);
      await edgeSnappingStorage.setEnabledForMarkers(newValue);

      setSaveFeedback('✅ 设置已保存');
      setTimeout(() => setSaveFeedback(''), 2000);

      // 通知content script重新加载设置
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'reloadEdgeSnappingSettings' });
      }
    } catch (error) {
      console.error('切换标记元素边缘吸附失败:', error);
      setSaveFeedback('❌ 操作失败');
      setTimeout(() => setSaveFeedback(''), 2000);
    }
  };

  return (
    <div className="border-border-default bg-background-main mb-3 rounded border p-3 dark:border-gray-600 dark:bg-gray-900">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium">边缘吸附设置</h4>
        <button
          onClick={onClose}
          className="bg-background-ivory-medium text-text-faded hover:bg-swatch-cloud-light rounded px-2 py-1 text-xs dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600">
          ✕
        </button>
      </div>

      {saveFeedback && (
        <div className="mb-2 rounded bg-green-100 p-2 text-xs text-green-800 dark:bg-green-900/20 dark:text-green-300">
          {saveFeedback}
        </div>
      )}

      <div className="space-y-3">
        {/* 启用边缘吸附 */}
        <div className="flex items-center justify-between">
          <label className="text-text-main text-sm dark:text-gray-300">启用边缘吸附</label>
          <input
            type="checkbox"
            checked={settings.enableSnapping ?? true}
            onChange={e => updateSetting('enableSnapping', e.target.checked)}
            className="rounded"
          />
        </div>

        {/* 启用拖动 */}
        <div className="flex items-center justify-between">
          <label className="text-text-main text-sm dark:text-gray-300">启用拖动</label>
          <input
            type="checkbox"
            checked={settings.enableDragging ?? true}
            onChange={e => updateSetting('enableDragging', e.target.checked)}
            className="rounded"
          />
        </div>

        {/* 限制在视窗内 */}
        <div className="flex items-center justify-between">
          <label className="text-text-main text-sm dark:text-gray-300">限制在视窗内</label>
          <input
            type="checkbox"
            checked={settings.constrainToViewport ?? true}
            onChange={e => updateSetting('constrainToViewport', e.target.checked)}
            className="rounded"
          />
        </div>

        {/* 应用到标记元素 */}
        <div className="flex items-center justify-between">
          <label className="text-text-main text-sm dark:text-gray-300">应用到标记元素</label>
          <input type="checkbox" checked={enabledForMarkers} onChange={toggleEnabledForMarkers} className="rounded" />
        </div>

        {/* 吸附距离 */}
        <div>
          <label className="text-text-faded mb-1 block text-xs dark:text-gray-400">
            吸附距离: {settings.snapDistance ?? 30}px
          </label>
          <input
            type="range"
            min="10"
            max="100"
            value={settings.snapDistance ?? 30}
            onChange={e => updateSetting('snapDistance', parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* 边缘偏移 */}
        <div>
          <label className="text-text-faded mb-1 block text-xs dark:text-gray-400">
            边缘偏移: {settings.edgeOffset ?? 10}px
          </label>
          <input
            type="range"
            min="0"
            max="50"
            value={settings.edgeOffset ?? 10}
            onChange={e => updateSetting('edgeOffset', parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* 动画时长 */}
        <div>
          <label className="text-text-faded mb-1 block text-xs dark:text-gray-400">
            动画时长: {settings.animationDuration ?? 200}ms
          </label>
          <input
            type="range"
            min="0"
            max="1000"
            step="50"
            value={settings.animationDuration ?? 200}
            onChange={e => updateSetting('animationDuration', parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* 吸附边缘选择 */}
        <div>
          <label className="text-text-faded mb-2 block text-xs dark:text-gray-400">吸附到边缘</label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.snapToEdges?.top ?? true}
                onChange={e => updateSnapToEdge('top', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">顶部</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.snapToEdges?.right ?? true}
                onChange={e => updateSnapToEdge('right', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">右侧</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.snapToEdges?.bottom ?? true}
                onChange={e => updateSnapToEdge('bottom', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">底部</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.snapToEdges?.left ?? true}
                onChange={e => updateSnapToEdge('left', e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">左侧</span>
            </label>
          </div>
        </div>

        {/* 说明 */}
        <div className="bg-background-oat rounded p-2 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          <div className="mb-1 font-medium">💡 使用说明</div>
          <div>
            • 启用后，浮动元素可以拖动并自动吸附到浏览器边缘
            <br />
            • 吸附距离决定元素靠近边缘多近时会自动吸附
            <br />
            • 边缘偏移控制吸附后与边缘的距离
            <br />• 应用到标记元素后，页面上的标记覆盖层也支持拖动和吸附
          </div>
        </div>
      </div>
    </div>
  );
};
