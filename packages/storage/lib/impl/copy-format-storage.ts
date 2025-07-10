import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

// 复制格式的数据结构
export interface CopyFormatSettings {
  customFormat: string;
  defaultFormat: string;
  formatHistory: string[];
  savedFormats: Array<{
    id: string;
    name: string;
    template: string;
    icon: string;
  }>;
}

export interface CopyFormatStateType {
  settings: CopyFormatSettings;
}

const storage = createStorage<CopyFormatStateType>(
  'copy-format-storage-key',
  {
    settings: {
      customFormat: '{title} - {url}',
      defaultFormat: 'title',
      formatHistory: [],
      savedFormats: [],
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
  setDefaultFormat: (format: string) => Promise<void>;
  addFormatToHistory: (format: string) => Promise<void>;
  addSavedFormat: (format: { id: string; name: string; template: string; icon: string }) => Promise<void>;
  removeSavedFormat: (id: string) => Promise<void>;
  clearFormatHistory: () => Promise<void>;
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

  // 设置默认格式
  setDefaultFormat: async (format: string) => {
    await storage.set(currentState => ({
      ...currentState,
      settings: {
        ...currentState.settings,
        defaultFormat: format,
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
};
