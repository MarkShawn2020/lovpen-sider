import { sitePresetsStorage } from '@extension/storage';
import { useState, useEffect } from 'react';
import type { SitePreset, SitePresetsSettings } from '@extension/storage';

interface SitePresetsPanelProps {
  onClose: () => void;
}

// 内置预设（保持与element-selector.ts中的一致）
const BUILT_IN_PRESETS: SitePreset[] = [
  {
    id: 'wechat',
    name: '微信公众号',
    patterns: ['https://mp.weixin.qq.com/s/', 'mp.weixin.qq.com/s/'],
    selectors: ['#img-content'],
    priority: 10,
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'zhihu',
    name: '知乎',
    patterns: ['zhihu.com/question', 'zhihu.com/p/'],
    selectors: ['.Post-RichTextContainer', '.QuestionAnswer-content', '.RichContent-inner'],
    priority: 10,
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'juejin',
    name: '掘金',
    patterns: ['juejin.cn/post', 'juejin.im/post'],
    selectors: ['.article-content', '.markdown-body'],
    priority: 10,
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'medium',
    name: 'Medium',
    patterns: ['medium.com'],
    selectors: ['article', '.meteredContent', 'main article'],
    priority: 10,
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'devto',
    name: 'Dev.to',
    patterns: ['dev.to'],
    selectors: ['#article-body', '.crayons-article__body'],
    priority: 10,
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'stackoverflow',
    name: 'Stack Overflow',
    patterns: ['stackoverflow.com/questions'],
    selectors: ['.answercell', '.question', '.post-text'],
    priority: 10,
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    patterns: ['github.com'],
    selectors: ['.markdown-body', '#readme', '.comment-body'],
    priority: 10,
    enabled: true,
    isBuiltIn: true,
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    patterns: ['wikipedia.org/wiki'],
    selectors: ['#mw-content-text', '.mw-parser-output'],
    priority: 10,
    enabled: true,
    isBuiltIn: true,
  },
];

export const SitePresetsPanel = ({ onClose }: SitePresetsPanelProps) => {
  const [settings, setSettings] = useState<SitePresetsSettings>({
    customPresets: [],
    disabledBuiltInPresets: [],
    builtInPresetOverrides: {},
  });
  const [expandedBuiltInPreset, setExpandedBuiltInPreset] = useState<string | null>(null);
  const [editingBuiltInPreset, setEditingBuiltInPreset] = useState<string | null>(null);
  const [isAddingPreset, setIsAddingPreset] = useState(false);
  const [editingPreset, setEditingPreset] = useState<string | null>(null);
  const [newPreset, setNewPreset] = useState<Partial<SitePreset>>({
    name: '',
    patterns: [''],
    selectors: [''],
    priority: 10,
    enabled: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const currentSettings = await sitePresetsStorage.getSettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error('加载预设配置失败:', error);
    }
  };

  const handleAddPreset = async () => {
    if (!newPreset.name || !newPreset.patterns?.[0] || !newPreset.selectors?.[0]) {
      alert('请填写所有必填字段');
      return;
    }

    try {
      await sitePresetsStorage.addPreset({
        name: newPreset.name,
        patterns: newPreset.patterns!.filter(p => p),
        selectors: newPreset.selectors!.filter(s => s),
        priority: newPreset.priority || 10,
        enabled: newPreset.enabled ?? true,
      });

      setIsAddingPreset(false);
      setNewPreset({
        name: '',
        patterns: [''],
        selectors: [''],
        priority: 10,
        enabled: true,
      });

      await loadSettings();
    } catch (error) {
      console.error('添加预设失败:', error);
    }
  };

  const handleUpdatePreset = async (id: string, updates: Partial<SitePreset>) => {
    try {
      await sitePresetsStorage.updatePreset(id, updates);
      await loadSettings();
      setEditingPreset(null);
    } catch (error) {
      console.error('更新预设失败:', error);
    }
  };

  const handleDeletePreset = async (id: string) => {
    if (confirm('确定要删除这个预设吗？')) {
      try {
        await sitePresetsStorage.deletePreset(id);
        await loadSettings();
      } catch (error) {
        console.error('删除预设失败:', error);
      }
    }
  };

  const handleToggleBuiltInPreset = async (id: string, enabled: boolean) => {
    try {
      await sitePresetsStorage.toggleBuiltInPreset(id, enabled);
      await loadSettings();
    } catch (error) {
      console.error('切换内置预设失败:', error);
    }
  };

  const handleUpdateBuiltInPreset = async (id: string, field: string, value: any) => {
    try {
      const currentOverride = settings.builtInPresetOverrides[id] || {};
      const updatedOverride = { ...currentOverride, [field]: value };
      await sitePresetsStorage.updateBuiltInPreset(id, updatedOverride);
      await loadSettings();
    } catch (error) {
      console.error('更新内置预设失败:', error);
    }
  };

  const handleResetBuiltInPreset = async (id: string) => {
    try {
      await sitePresetsStorage.resetBuiltInPreset(id);
      await loadSettings();
      setEditingBuiltInPreset(null);
    } catch (error) {
      console.error('重置内置预设失败:', error);
    }
  };

  const getBuiltInPresetValue = <K extends keyof SitePreset>(preset: SitePreset, field: K): SitePreset[K] => {
    const override = settings.builtInPresetOverrides[preset.id];
    if (override && field in override) {
      return (override[field as keyof typeof override] as SitePreset[K]) ?? preset[field];
    }
    return preset[field];
  };

  const hasOverrides = (presetId: string) => !!settings.builtInPresetOverrides[presetId];

  const handleExport = async () => {
    try {
      const presets = await sitePresetsStorage.exportPresets();
      const dataStr = JSON.stringify(presets, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `site-presets-${new Date().toISOString().split('T')[0]}.json`;
      a.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出预设失败:', error);
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const presets = JSON.parse(text) as SitePreset[];

        if (!Array.isArray(presets)) {
          throw new Error('无效的预设文件格式');
        }

        const replace = confirm('是否替换现有的自定义预设？\n选择"取消"将追加到现有预设。');
        await sitePresetsStorage.importPresets(presets, replace);
        await loadSettings();
      } catch (error) {
        console.error('导入预设失败:', error);
        alert('导入失败：' + (error as Error).message);
      }
    };

    input.click();
  };

  const updatePatternAtIndex = (patterns: string[], index: number, value: string) => {
    const newPatterns = [...patterns];
    newPatterns[index] = value;
    return newPatterns;
  };

  const updateSelectorAtIndex = (selectors: string[], index: number, value: string) => {
    const newSelectors = [...selectors];
    newSelectors[index] = value;
    return newSelectors;
  };

  const addPattern = (patterns: string[]) => [...patterns, ''];

  const removePattern = (patterns: string[], index: number) => patterns.filter((_, i) => i !== index);

  const addSelector = (selectors: string[]) => [...selectors, ''];

  const removeSelector = (selectors: string[], index: number) => selectors.filter((_, i) => i !== index);

  return (
    <div className="border-border-default bg-background-main mb-3 rounded border p-3 dark:border-gray-600 dark:bg-gray-900">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-medium">智能选择预设配置</h4>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="bg-background-ivory-medium text-text-faded hover:bg-swatch-cloud-light rounded px-2 py-1 text-xs dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600">
            📤 导出
          </button>
          <button
            onClick={handleImport}
            className="bg-background-ivory-medium text-text-faded hover:bg-swatch-cloud-light rounded px-2 py-1 text-xs dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600">
            📥 导入
          </button>
          <button
            onClick={onClose}
            className="bg-background-ivory-medium text-text-faded hover:bg-swatch-cloud-light rounded px-2 py-1 text-xs dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600">
            ✕
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {/* 内置预设部分 */}
        <div>
          <h5 className="text-text-faded mb-2 text-xs font-medium dark:text-gray-400">内置预设</h5>
          <div className="space-y-1">
            {BUILT_IN_PRESETS.map(preset => {
              const isDisabled = settings.disabledBuiltInPresets.includes(preset.id);
              const isExpanded = expandedBuiltInPreset === preset.id;
              const isEditing = editingBuiltInPreset === preset.id;
              const hasOverride = hasOverrides(preset.id);

              return (
                <div
                  key={preset.id}
                  className="bg-background-ivory-medium dark:bg-background-dark rounded p-2 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedBuiltInPreset(isExpanded ? null : preset.id)}
                          className="text-text-faded hover:text-text-main text-xs">
                          {isExpanded ? '▼' : '▶'}
                        </button>
                        <div className="text-text-main text-sm font-medium dark:text-gray-200">
                          {preset.name}
                          {hasOverride && <span className="text-swatch-cactus ml-2 text-xs">（已修改）</span>}
                        </div>
                      </div>
                      {!isExpanded && (
                        <div className="text-text-faded ml-4 text-xs dark:text-gray-400">
                          {getBuiltInPresetValue(preset, 'patterns').join(', ')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!isDisabled}
                        onChange={e => handleToggleBuiltInPreset(preset.id, e.target.checked)}
                        className="rounded"
                      />
                    </div>
                  </div>

                  {/* 展开的内容 */}
                  {isExpanded && (
                    <div className="mt-3 space-y-2 pl-4">
                      {isEditing ? (
                        <>
                          {/* 编辑模式 */}
                          <div>
                            <label className="text-text-faded mb-1 block text-xs dark:text-gray-400">URL模式</label>
                            {getBuiltInPresetValue(preset, 'patterns').map((pattern, index) => (
                              <div key={index} className="mb-1 flex gap-1">
                                <input
                                  type="text"
                                  value={pattern}
                                  onChange={e => {
                                    const newPatterns = [...getBuiltInPresetValue(preset, 'patterns')];
                                    newPatterns[index] = e.target.value;
                                    handleUpdateBuiltInPreset(preset.id, 'patterns', newPatterns);
                                  }}
                                  className="border-border-default dark:bg-background-dark flex-1 rounded border px-2 py-1 text-xs dark:border-gray-600"
                                />
                                {getBuiltInPresetValue(preset, 'patterns').length > 1 && (
                                  <button
                                    onClick={() => {
                                      const newPatterns = getBuiltInPresetValue(preset, 'patterns').filter(
                                        (_, i) => i !== index,
                                      );
                                      handleUpdateBuiltInPreset(preset.id, 'patterns', newPatterns);
                                    }}
                                    className="text-text-faded hover:text-background-clay text-xs">
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                const newPatterns = [...getBuiltInPresetValue(preset, 'patterns'), ''];
                                handleUpdateBuiltInPreset(preset.id, 'patterns', newPatterns);
                              }}
                              className="text-swatch-cactus hover:text-swatch-olive text-xs">
                              + 添加模式
                            </button>
                          </div>

                          <div>
                            <label className="text-text-faded mb-1 block text-xs dark:text-gray-400">CSS选择器</label>
                            {getBuiltInPresetValue(preset, 'selectors').map((selector, index) => (
                              <div key={index} className="mb-1 flex gap-1">
                                <input
                                  type="text"
                                  value={selector}
                                  onChange={e => {
                                    const newSelectors = [...getBuiltInPresetValue(preset, 'selectors')];
                                    newSelectors[index] = e.target.value;
                                    handleUpdateBuiltInPreset(preset.id, 'selectors', newSelectors);
                                  }}
                                  className="border-border-default dark:bg-background-dark flex-1 rounded border px-2 py-1 text-xs dark:border-gray-600"
                                />
                                {getBuiltInPresetValue(preset, 'selectors').length > 1 && (
                                  <button
                                    onClick={() => {
                                      const newSelectors = getBuiltInPresetValue(preset, 'selectors').filter(
                                        (_, i) => i !== index,
                                      );
                                      handleUpdateBuiltInPreset(preset.id, 'selectors', newSelectors);
                                    }}
                                    className="text-text-faded hover:text-background-clay text-xs">
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                const newSelectors = [...getBuiltInPresetValue(preset, 'selectors'), ''];
                                handleUpdateBuiltInPreset(preset.id, 'selectors', newSelectors);
                              }}
                              className="text-swatch-cactus hover:text-swatch-olive text-xs">
                              + 添加选择器
                            </button>
                          </div>

                          <div>
                            <label className="text-text-faded mb-1 block text-xs dark:text-gray-400">优先级</label>
                            <input
                              type="number"
                              value={getBuiltInPresetValue(preset, 'priority')}
                              onChange={e =>
                                handleUpdateBuiltInPreset(preset.id, 'priority', parseInt(e.target.value) || 10)
                              }
                              className="border-border-default dark:bg-background-dark w-20 rounded border px-2 py-1 text-xs dark:border-gray-600"
                            />
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingBuiltInPreset(null)}
                              className="bg-swatch-cactus hover:bg-swatch-olive rounded px-3 py-1 text-xs text-white">
                              完成
                            </button>
                            {hasOverride && (
                              <button
                                onClick={() => handleResetBuiltInPreset(preset.id)}
                                className="bg-background-ivory-medium text-text-faded hover:bg-swatch-cloud-light rounded px-3 py-1 text-xs dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600">
                                恢复默认
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          {/* 查看模式 */}
                          <div>
                            <span className="text-text-faded text-xs dark:text-gray-400">URL模式：</span>
                            <div className="text-text-main mt-1 text-xs dark:text-gray-200">
                              {getBuiltInPresetValue(preset, 'patterns').join(', ')}
                            </div>
                          </div>
                          <div>
                            <span className="text-text-faded text-xs dark:text-gray-400">CSS选择器：</span>
                            <div className="text-text-main mt-1 text-xs dark:text-gray-200">
                              {getBuiltInPresetValue(preset, 'selectors').join(', ')}
                            </div>
                          </div>
                          <div>
                            <span className="text-text-faded text-xs dark:text-gray-400">优先级：</span>
                            <span className="text-text-main ml-1 text-xs dark:text-gray-200">
                              {getBuiltInPresetValue(preset, 'priority')}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingBuiltInPreset(preset.id)}
                              className="text-primary hover:text-primary/80 text-xs">
                              编辑
                            </button>
                            {hasOverride && (
                              <button
                                onClick={() => handleResetBuiltInPreset(preset.id)}
                                className="text-text-faded hover:text-background-clay text-xs">
                                恢复默认
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 自定义预设部分 */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h5 className="text-text-faded text-xs font-medium dark:text-gray-400">自定义预设</h5>
            <button
              onClick={() => setIsAddingPreset(true)}
              className="bg-swatch-cactus hover:bg-swatch-olive rounded px-2 py-1 text-xs text-white">
              + 添加
            </button>
          </div>

          {/* 添加新预设表单 */}
          {isAddingPreset && (
            <div className="bg-background-oat mb-2 rounded p-3 dark:bg-gray-800">
              <input
                type="text"
                placeholder="预设名称"
                value={newPreset.name}
                onChange={e => setNewPreset({ ...newPreset, name: e.target.value })}
                className="border-border-default dark:bg-background-dark mb-2 w-full rounded border px-2 py-1 text-sm dark:border-gray-600"
              />

              <div className="mb-2">
                <label className="text-text-faded mb-1 block text-xs dark:text-gray-400">URL模式</label>
                {newPreset.patterns?.map((pattern, index) => (
                  <div key={index} className="mb-1 flex gap-1">
                    <input
                      type="text"
                      placeholder="例如: example.com/article"
                      value={pattern}
                      onChange={e =>
                        setNewPreset({
                          ...newPreset,
                          patterns: updatePatternAtIndex(newPreset.patterns!, index, e.target.value),
                        })
                      }
                      className="border-border-default dark:bg-background-dark flex-1 rounded border px-2 py-1 text-xs dark:border-gray-600"
                    />
                    {newPreset.patterns!.length > 1 && (
                      <button
                        onClick={() =>
                          setNewPreset({
                            ...newPreset,
                            patterns: removePattern(newPreset.patterns!, index),
                          })
                        }
                        className="text-text-faded hover:text-background-clay text-xs">
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() =>
                    setNewPreset({
                      ...newPreset,
                      patterns: addPattern(newPreset.patterns!),
                    })
                  }
                  className="text-swatch-cactus hover:text-swatch-olive text-xs">
                  + 添加模式
                </button>
              </div>

              <div className="mb-2">
                <label className="text-text-faded mb-1 block text-xs dark:text-gray-400">CSS选择器</label>
                {newPreset.selectors?.map((selector, index) => (
                  <div key={index} className="mb-1 flex gap-1">
                    <input
                      type="text"
                      placeholder="例如: #content, .article"
                      value={selector}
                      onChange={e =>
                        setNewPreset({
                          ...newPreset,
                          selectors: updateSelectorAtIndex(newPreset.selectors!, index, e.target.value),
                        })
                      }
                      className="border-border-default dark:bg-background-dark flex-1 rounded border px-2 py-1 text-xs dark:border-gray-600"
                    />
                    {newPreset.selectors!.length > 1 && (
                      <button
                        onClick={() =>
                          setNewPreset({
                            ...newPreset,
                            selectors: removeSelector(newPreset.selectors!, index),
                          })
                        }
                        className="text-text-faded hover:text-background-clay text-xs">
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() =>
                    setNewPreset({
                      ...newPreset,
                      selectors: addSelector(newPreset.selectors!),
                    })
                  }
                  className="text-swatch-cactus hover:text-swatch-olive text-xs">
                  + 添加选择器
                </button>
              </div>

              <div className="mb-2">
                <label className="text-text-faded mb-1 block text-xs dark:text-gray-400">优先级</label>
                <input
                  type="number"
                  value={newPreset.priority}
                  onChange={e => setNewPreset({ ...newPreset, priority: parseInt(e.target.value) || 10 })}
                  className="border-border-default dark:bg-background-dark w-20 rounded border px-2 py-1 text-xs dark:border-gray-600"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAddPreset}
                  className="bg-swatch-cactus hover:bg-swatch-olive rounded px-3 py-1 text-xs text-white">
                  保存
                </button>
                <button
                  onClick={() => {
                    setIsAddingPreset(false);
                    setNewPreset({
                      name: '',
                      patterns: [''],
                      selectors: [''],
                      priority: 10,
                      enabled: true,
                    });
                  }}
                  className="bg-background-ivory-medium text-text-faded hover:bg-swatch-cloud-light rounded px-3 py-1 text-xs dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600">
                  取消
                </button>
              </div>
            </div>
          )}

          {/* 自定义预设列表 */}
          <div className="space-y-1">
            {settings.customPresets.map(preset => (
              <div
                key={preset.id}
                className="bg-background-ivory-medium dark:bg-background-dark rounded p-2 dark:border-gray-700">
                {editingPreset === preset.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={preset.name}
                      onChange={e => handleUpdatePreset(preset.id, { name: e.target.value })}
                      className="border-border-default dark:bg-background-dark w-full rounded border px-2 py-1 text-sm dark:border-gray-600"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingPreset(null)}
                        className="bg-swatch-cactus hover:bg-swatch-olive rounded px-2 py-1 text-xs text-white">
                        完成
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-text-main text-sm font-medium dark:text-gray-200">{preset.name}</div>
                      <div className="text-text-faded text-xs dark:text-gray-400">{preset.patterns.join(', ')}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingPreset(preset.id)}
                        className="text-text-faded hover:text-primary text-xs">
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeletePreset(preset.id)}
                        className="text-text-faded hover:text-background-clay text-xs">
                        删除
                      </button>
                      <input
                        type="checkbox"
                        checked={preset.enabled}
                        onChange={e => handleUpdatePreset(preset.id, { enabled: e.target.checked })}
                        className="rounded"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            {settings.customPresets.length === 0 && (
              <div className="text-text-faded text-center text-xs dark:text-gray-500">暂无自定义预设</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
