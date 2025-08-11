import { createStorage, StorageEnum } from '../base/index.js';
import type { BaseStorageType } from '../base/index.js';

export interface EdgeSnappingConfig {
  snapDistance: number;
  animationDuration: number;
  edgeOffset: number;
  enableSnapping: boolean;
  enableDragging: boolean;
  constrainToViewport: boolean;
  snapToEdges: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
}

export interface EdgeSnappingStorageData {
  settings: Partial<EdgeSnappingConfig>;
  enabledForMarkers: boolean;
  lastPosition?: { x: number; y: number };
  lastSnapEdge?: 'top' | 'right' | 'bottom' | 'left';
}

const storage = createStorage<EdgeSnappingStorageData>(
  'edge-snapping-storage-key',
  {
    settings: {
      snapDistance: 30,
      animationDuration: 200,
      edgeOffset: 10,
      enableSnapping: true,
      enableDragging: true,
      constrainToViewport: true,
      snapToEdges: {
        top: true,
        right: true,
        bottom: true,
        left: true,
      },
    },
    enabledForMarkers: false,
  },
  {
    storageEnum: StorageEnum.Local,
    liveUpdate: true,
  },
);

export type EdgeSnappingStorageType = BaseStorageType<EdgeSnappingStorageData> & {
  getSettings: () => Promise<EdgeSnappingStorageData>;
  updateSettings: (updates: Partial<EdgeSnappingStorageData>) => Promise<void>;
  setEnabledForMarkers: (enabled: boolean) => Promise<void>;
  saveLastState: (position?: { x: number; y: number }, snapEdge?: 'top' | 'right' | 'bottom' | 'left') => Promise<void>;
};

export const edgeSnappingStorage: EdgeSnappingStorageType = {
  ...storage,

  /**
   * 获取边缘吸附设置
   */
  getSettings: async () => {
    const data = await storage.get();
    return {
      settings: data?.settings || {
        snapDistance: 30,
        animationDuration: 200,
        edgeOffset: 10,
        enableSnapping: true,
        enableDragging: true,
        constrainToViewport: true,
        snapToEdges: {
          top: true,
          right: true,
          bottom: true,
          left: true,
        },
      },
      enabledForMarkers: data?.enabledForMarkers ?? false,
      lastPosition: data?.lastPosition,
      lastSnapEdge: data?.lastSnapEdge,
    };
  },

  /**
   * 更新边缘吸附设置
   */
  updateSettings: async (updates: Partial<EdgeSnappingStorageData>) => {
    const current = await storage.get();
    await storage.set({
      ...current,
      ...updates,
      settings: {
        ...current.settings,
        ...(updates.settings || {}),
      },
    });
  },

  /**
   * 启用/禁用标记元素的边缘吸附
   */
  setEnabledForMarkers: async (enabled: boolean) => {
    await storage.set(current => ({
      ...current,
      enabledForMarkers: enabled,
    }));
  },

  /**
   * 保存最后的位置和吸附边缘
   */
  saveLastState: async (position?: { x: number; y: number }, snapEdge?: 'top' | 'right' | 'bottom' | 'left') => {
    await storage.set(current => ({
      ...current,
      lastPosition: position,
      lastSnapEdge: snapEdge,
    }));
  },
};
