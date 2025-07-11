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

export interface DatabaseFormTemplateData {
  id?: string;
  userId?: string;
  name: string;
  description?: string;
  data: Record<string, string | string[] | boolean>;
  tags: string[];
  isDefault: boolean;
  timestamp: number;
  createdAt?: string;
  updatedAt?: string;
  synced?: boolean;
  syncedAt?: string;
}

export interface DatabaseFormDefinitionData {
  id?: string;
  userId?: string;
  name: string;
  description?: string;
  urlPattern: string;
  formSelector: string;
  fields: Array<{
    id: string;
    type: string;
    label: string;
    selector: string;
    order: number;
    required: boolean;
    placeholder?: string;
    options?: Array<{ value: string; label: string }>;
    validation?: Record<string, unknown>;
  }>;
  timestamp: number;
  createdAt?: string;
  updatedAt?: string;
  synced?: boolean;
  syncedAt?: string;
}

export interface SyncQueueItem {
  id: string;
  type: 'capture' | 'text_processing' | 'settings' | 'form_template' | 'form_definition';
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
