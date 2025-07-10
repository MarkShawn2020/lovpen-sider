import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

// 复制格式的数据结构
export interface CopyFormatSettings {
  customFormat: string;
  selectedFormat: string; // 当前选中的格式
  formatHistory: string[];
  savedFormats: Array<{
    id: string;
    name: string;
    template: string;
    icon: string;
  }>;
  shortcuts: {
    [key: string]: {
      enabled: boolean;
      command: string;
      description: string;
    };
  };
}

export interface CopyFormatStateType {
  settings: CopyFormatSettings;
}

const storage = createStorage<CopyFormatStateType>(
  'copy-format-storage-key',
  {
    settings: {
      customFormat: '{title} - {url}',
      selectedFormat: 'markdown', // 默认选择 markdown 格式
      formatHistory: [],
      savedFormats: [],
      shortcuts: {
        'copy-title-selected': {
          enabled: true,
          command: 'copy-title-selected',
          description: 'Copy page title in selected format',
        },
      },
    },
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export type CopyFormatStorageType = BaseStorageType<CopyFormatStateType> & {
  getSettings: () => Promise<CopyFormatSettings>;
  updateSettings: (settings: Partial<CopyFormatSettings>) => Promise<void>;
  setCustomFormat: (format: string) => Promise<void>;
  setSelectedFormat: (format: string) => Promise<void>;
  addFormatToHistory: (format: string) => Promise<void>;
  addSavedFormat: (format: { id: string; name: string; template: string; icon: string }) => Promise<void>;
  removeSavedFormat: (id: string) => Promise<void>;
  clearFormatHistory: () => Promise<void>;
  toggleShortcut: (command: string, enabled: boolean) => Promise<void>;
  getShortcuts: () => Promise<CopyFormatSettings['shortcuts']>;
};

export const copyFormatStorage: CopyFormatStorageType = {
  ...storage,

  // 获取复制格式设置
  getSettings: async () => {
    const state = await storage.get();
    return state.settings;
  },

  // 更新设置
  updateSettings: async (newSettings: Partial<CopyFormatSettings>) => {
    await storage.set(currentState => ({
      ...currentState,
      settings: {
        ...currentState.settings,
        ...newSettings,
      },
    }));
  },

  // 设置自定义格式
  setCustomFormat: async (format: string) => {
    await storage.set(currentState => ({
      ...currentState,
      settings: {
        ...currentState.settings,
        customFormat: format,
      },
    }));
  },

  // 设置选中的格式
  setSelectedFormat: async (format: string) => {
    await storage.set(currentState => ({
      ...currentState,
      settings: {
        ...currentState.settings,
        selectedFormat: format,
      },
    }));
  },

  // 添加格式到历史记录
  addFormatToHistory: async (format: string) => {
    await storage.set(currentState => {
      const history = currentState.settings.formatHistory.filter(f => f !== format);
      history.unshift(format);
      // 只保留最近10条历史记录
      if (history.length > 10) {
        history.pop();
      }
      return {
        ...currentState,
        settings: {
          ...currentState.settings,
          formatHistory: history,
        },
      };
    });
  },

  // 添加保存的格式
  addSavedFormat: async (format: { id: string; name: string; template: string; icon: string }) => {
    await storage.set(currentState => {
      const savedFormats = currentState.settings.savedFormats.filter(f => f.id !== format.id);
      savedFormats.push(format);
      return {
        ...currentState,
        settings: {
          ...currentState.settings,
          savedFormats,
        },
      };
    });
  },

  // 移除保存的格式
  removeSavedFormat: async (id: string) => {
    await storage.set(currentState => ({
      ...currentState,
      settings: {
        ...currentState.settings,
        savedFormats: currentState.settings.savedFormats.filter(f => f.id !== id),
      },
    }));
  },

  // 清空格式历史记录
  clearFormatHistory: async () => {
    await storage.set(currentState => ({
      ...currentState,
      settings: {
        ...currentState.settings,
        formatHistory: [],
      },
    }));
  },

  // 切换快捷键启用状态
  toggleShortcut: async (command: string, enabled: boolean) => {
    await storage.set(currentState => ({
      ...currentState,
      settings: {
        ...currentState.settings,
        shortcuts: {
          ...currentState.settings.shortcuts,
          [command]: {
            ...currentState.settings.shortcuts[command],
            enabled,
          },
        },
      },
    }));
  },

  // 获取快捷键配置
  getShortcuts: async () => {
    const state = await storage.get();
    return state.settings.shortcuts;
  },
};
