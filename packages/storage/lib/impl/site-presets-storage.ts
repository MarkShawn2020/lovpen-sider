import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

// 网站预设的数据结构
export interface SitePreset {
  id: string;
  name: string;
  patterns: string[];
  selectors: string[];
  priority: number;
  enabled: boolean;
  isBuiltIn?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface SitePresetsSettings {
  customPresets: SitePreset[];
  disabledBuiltInPresets: string[];
  builtInPresetOverrides: Record<string, Partial<SitePreset>>;
  lastExportTime?: number;
  lastImportTime?: number;
}

export interface SitePresetsStateType {
  settings: SitePresetsSettings;
}

const storage = createStorage<SitePresetsStateType>(
  'site-presets-storage-key',
  {
    settings: {
      customPresets: [],
      disabledBuiltInPresets: [],
      builtInPresetOverrides: {},
    },
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export type SitePresetsStorageType = BaseStorageType<SitePresetsStateType> & {
  getSettings: () => Promise<SitePresetsSettings>;
  updateSettings: (settings: Partial<SitePresetsSettings>) => Promise<void>;
  getCustomPresets: () => Promise<SitePreset[]>;
  addPreset: (preset: Omit<SitePreset, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updatePreset: (id: string, preset: Partial<SitePreset>) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
  togglePreset: (id: string, enabled: boolean) => Promise<void>;
  toggleBuiltInPreset: (id: string, enabled: boolean) => Promise<void>;
  updateBuiltInPreset: (id: string, override: Partial<SitePreset>) => Promise<void>;
  resetBuiltInPreset: (id: string) => Promise<void>;
  getBuiltInPresetOverride: (id: string) => Promise<Partial<SitePreset> | undefined>;
  reorderPresets: (presetIds: string[]) => Promise<void>;
  importPresets: (presets: SitePreset[], replace?: boolean) => Promise<void>;
  exportPresets: () => Promise<SitePreset[]>;
  resetToDefaults: () => Promise<void>;
};

export const sitePresetsStorage: SitePresetsStorageType = {
  ...storage,

  // 获取设置
  getSettings: async () => {
    const state = await storage.get();
    return state.settings;
  },

  // 更新设置
  updateSettings: async (newSettings: Partial<SitePresetsSettings>) => {
    await storage.set(currentState => ({
      ...currentState,
      settings: {
        ...currentState.settings,
        ...newSettings,
      },
    }));
  },

  // 获取自定义预设
  getCustomPresets: async () => {
    const state = await storage.get();
    return state.settings.customPresets;
  },

  // 添加预设
  addPreset: async (preset: Omit<SitePreset, 'id' | 'createdAt' | 'updatedAt'>) => {
    await storage.set(currentState => {
      const now = Date.now();
      const newPreset: SitePreset = {
        ...preset,
        id: `preset_${now}_${Math.random().toString(36).substring(2, 9)}`,
        createdAt: now,
        updatedAt: now,
      };

      return {
        ...currentState,
        settings: {
          ...currentState.settings,
          customPresets: [...currentState.settings.customPresets, newPreset],
        },
      };
    });
  },

  // 更新预设
  updatePreset: async (id: string, updates: Partial<SitePreset>) => {
    await storage.set(currentState => ({
      ...currentState,
      settings: {
        ...currentState.settings,
        customPresets: currentState.settings.customPresets.map(preset =>
          preset.id === id
            ? {
                ...preset,
                ...updates,
                id: preset.id, // 确保ID不被修改
                updatedAt: Date.now(),
              }
            : preset,
        ),
      },
    }));
  },

  // 删除预设
  deletePreset: async (id: string) => {
    await storage.set(currentState => ({
      ...currentState,
      settings: {
        ...currentState.settings,
        customPresets: currentState.settings.customPresets.filter(preset => preset.id !== id),
      },
    }));
  },

  // 切换预设启用状态
  togglePreset: async (id: string, enabled: boolean) => {
    await storage.set(currentState => ({
      ...currentState,
      settings: {
        ...currentState.settings,
        customPresets: currentState.settings.customPresets.map(preset =>
          preset.id === id
            ? {
                ...preset,
                enabled,
                updatedAt: Date.now(),
              }
            : preset,
        ),
      },
    }));
  },

  // 切换内置预设启用状态
  toggleBuiltInPreset: async (id: string, enabled: boolean) => {
    await storage.set(currentState => {
      const disabledList = currentState.settings.disabledBuiltInPresets;
      let newDisabledList: string[];

      if (enabled) {
        // 从禁用列表中移除
        newDisabledList = disabledList.filter(presetId => presetId !== id);
      } else {
        // 添加到禁用列表
        if (!disabledList.includes(id)) {
          newDisabledList = [...disabledList, id];
        } else {
          newDisabledList = disabledList;
        }
      }

      return {
        ...currentState,
        settings: {
          ...currentState.settings,
          disabledBuiltInPresets: newDisabledList,
        },
      };
    });
  },

  // 重新排序预设
  reorderPresets: async (presetIds: string[]) => {
    await storage.set(currentState => {
      const presetsMap = new Map(currentState.settings.customPresets.map(p => [p.id, p]));
      const reorderedPresets = presetIds.map(id => presetsMap.get(id)).filter((p): p is SitePreset => p !== undefined);

      return {
        ...currentState,
        settings: {
          ...currentState.settings,
          customPresets: reorderedPresets,
        },
      };
    });
  },

  // 导入预设
  importPresets: async (presets: SitePreset[], replace = false) => {
    await storage.set(currentState => {
      const now = Date.now();
      const importedPresets = presets.map(preset => ({
        ...preset,
        id: `imported_${now}_${Math.random().toString(36).substring(2, 9)}`,
        createdAt: preset.createdAt || now,
        updatedAt: now,
      }));

      return {
        ...currentState,
        settings: {
          ...currentState.settings,
          customPresets: replace ? importedPresets : [...currentState.settings.customPresets, ...importedPresets],
          lastImportTime: now,
        },
      };
    });
  },

  // 导出预设
  exportPresets: async () => {
    const state = await storage.get();
    await storage.set(currentState => ({
      ...currentState,
      settings: {
        ...currentState.settings,
        lastExportTime: Date.now(),
      },
    }));
    return state.settings.customPresets;
  },

  // 更新内置预设覆盖
  updateBuiltInPreset: async (id: string, override: Partial<SitePreset>) => {
    await storage.set(currentState => ({
      ...currentState,
      settings: {
        ...currentState.settings,
        builtInPresetOverrides: {
          ...currentState.settings.builtInPresetOverrides,
          [id]: {
            ...currentState.settings.builtInPresetOverrides[id],
            ...override,
          },
        },
      },
    }));
  },

  // 重置单个内置预设
  resetBuiltInPreset: async (id: string) => {
    await storage.set(currentState => {
      const { [id]: _, ...restOverrides } = currentState.settings.builtInPresetOverrides;
      return {
        ...currentState,
        settings: {
          ...currentState.settings,
          builtInPresetOverrides: restOverrides,
        },
      };
    });
  },

  // 获取内置预设的覆盖
  getBuiltInPresetOverride: async (id: string) => {
    const state = await storage.get();
    return state.settings.builtInPresetOverrides[id];
  },

  // 重置为默认设置
  resetToDefaults: async () => {
    await storage.set(() => ({
      settings: {
        customPresets: [],
        disabledBuiltInPresets: [],
        builtInPresetOverrides: {},
      },
    }));
  },
};
