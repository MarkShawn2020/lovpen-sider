export interface CaptureData {
  id?: string;
  userId?: string;
  title: string;
  html: string;
  markdown: string;
  slug: string;
  url: string;
  tags: string[];
  timestamp: number;
  createdAt?: string;
  updatedAt?: string;
  synced?: boolean;
  syncedAt?: string;
}

export interface TextProcessingData {
  id?: string;
  userId?: string;
  type: 'translate' | 'format' | 'summary' | 'case';
  input: string;
  output: string;
  timestamp: number;
  createdAt?: string;
  updatedAt?: string;
  synced?: boolean;
  syncedAt?: string;
}

export interface UserSettings {
  id?: string;
  userId?: string;
  key: string;
  value: unknown;
  updatedAt?: string;
}

export interface SyncQueueItem {
  id: string;
  type: 'capture' | 'text_processing' | 'settings';
  action: 'create' | 'update' | 'delete';
  data: unknown;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

export interface UserStats {
  totalCaptures: number;
  totalTextProcessing: number;
  lastSync?: string;
}

export interface SyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  autoSyncEnabled: boolean;
  lastSync?: Date;
  lastError?: string;
}
