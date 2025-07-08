import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

// DOM路径存储的数据结构
export interface DomPathData {
  path: string;
  url: string;
  hostname: string;
  timestamp: number;
}

export interface DomPathStateType {
  paths: Record<string, DomPathData>; // key 为 hostname + pathname
  currentPath: string;
}

const storage = createStorage<DomPathStateType>(
  'dom-path-storage-key',
  {
    paths: {},
    currentPath: '',
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export type DomPathStorageType = BaseStorageType<DomPathStateType> & {
  savePath: (url: string, path: string) => Promise<void>;
  loadPath: (url: string) => Promise<string | null>;
  setCurrentPath: (path: string) => Promise<void>;
  clearPath: (url: string) => Promise<void>;
  getAllPaths: () => Promise<Record<string, DomPathData>>;
};

// 生成存储键
function generateStorageKey(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.hostname}${urlObj.pathname}`;
  } catch {
    return url;
  }
}

export const domPathStorage: DomPathStorageType = {
  ...storage,

  // 保存DOM路径
  savePath: async (url: string, path: string) => {
    const key = generateStorageKey(url);
    const urlObj = new URL(url);

    await storage.set(currentState => ({
      ...currentState,
      paths: {
        ...currentState.paths,
        [key]: {
          path,
          url,
          hostname: urlObj.hostname,
          timestamp: Date.now(),
        },
      },
      currentPath: path,
    }));
  },

  // 加载DOM路径
  loadPath: async (url: string) => {
    const state = await storage.get();
    const key = generateStorageKey(url);

    // 首先查找精确匹配
    if (state.paths[key]) {
      return state.paths[key].path;
    }

    // 如果没有精确匹配，查找同域名下的路径
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      const sameHostPaths = Object.values(state.paths)
        .filter(data => data.hostname === hostname)
        .sort((a, b) => b.timestamp - a.timestamp); // 按时间排序，最新的在前

      if (sameHostPaths.length > 0) {
        return sameHostPaths[0].path;
      }
    } catch {
      // URL解析失败，返回null
    }

    return null;
  },

  // 设置当前路径
  setCurrentPath: async (path: string) => {
    await storage.set(currentState => ({
      ...currentState,
      currentPath: path,
    }));
  },

  // 清除特定URL的路径
  clearPath: async (url: string) => {
    const key = generateStorageKey(url);

    await storage.set(currentState => {
      const newPaths = { ...currentState.paths };
      delete newPaths[key];

      return {
        ...currentState,
        paths: newPaths,
      };
    });
  },

  // 获取所有路径
  getAllPaths: async () => {
    const state = await storage.get();
    return state.paths;
  },
};
