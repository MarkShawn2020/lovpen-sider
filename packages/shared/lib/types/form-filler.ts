/**
 * 表单填写系统的类型定义
 */

export type FormFieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'tel'
  | 'number'
  | 'date'
  | 'url'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'file';

export interface FormFieldDefinition {
  /** 字段唯一标识 */
  id: string;
  /** 字段类型 */
  type: FormFieldType;
  /** 字段名称/标签 */
  label: string;
  /** CSS选择器 */
  selector: string;
  /** 字段在表单中的序号 */
  order: number;
  /** 是否必填 */
  required: boolean;
  /** 字段提示信息 */
  placeholder?: string;
  /** 下拉框或单选框的选项 */
  options?: Array<{ value: string; label: string }>;
  /** 字段验证规则 */
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
}

export interface FormDefinition {
  /** 表单唯一标识 */
  id: string;
  /** 表单名称 */
  name: string;
  /** 表单描述 */
  description?: string;
  /** 表单所在的URL模式 */
  urlPattern: string;
  /** 表单的CSS选择器 */
  formSelector: string;
  /** 表单字段定义 */
  fields: FormFieldDefinition[];
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

export interface FormTemplate {
  /** 模板唯一标识 */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板描述 */
  description?: string;
  /** 模板数据 */
  data: Record<string, string | string[] | boolean>;
  /** 标签 */
  tags: string[];
  /** 是否为默认模板 */
  isDefault: boolean;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
  /** 同步相关 */
  userId?: string;
  synced?: boolean;
  syncedAt?: string;
}

export interface FormDetectionResult {
  /** 检测到的表单 */
  form: Element;
  /** 表单的CSS选择器 */
  formSelector: string;
  /** 检测到的字段 */
  fields: FormFieldDefinition[];
  /** 检测置信度 (0-1) */
  confidence: number;
  /** 表单类型推断 */
  formType: 'login' | 'register' | 'contact' | 'profile' | 'payment' | 'search' | 'other';
}

export interface FormFillRequest {
  /** 要填写的表单选择器 */
  formSelector: string;
  /** 要填写的数据 */
  data: Record<string, string | string[] | boolean>;
  /** 填写选项 */
  options?: {
    /** 是否模拟用户输入延迟 */
    simulateTyping?: boolean;
    /** 输入间隔时间(毫秒) */
    typingDelay?: number;
    /** 是否触发change事件 */
    triggerEvents?: boolean;
    /** 是否滚动到字段 */
    scrollToField?: boolean;
  };
}

export interface FormFillResult {
  /** 是否成功 */
  success: boolean;
  /** 消息 */
  message: string;
  /** 填写的字段数量 */
  filledCount: number;
  /** 失败的字段 */
  failedFields: Array<{
    fieldId: string;
    reason: string;
  }>;
  /** 填写耗时(毫秒) */
  duration: number;
}

export interface FormValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 验证错误 */
  errors: Array<{
    fieldId: string;
    message: string;
  }>;
}

export interface FormAutoFillMessage {
  action: 'detectForms' | 'fillForm' | 'validateForm' | 'saveFormDefinition' | 'getFormTemplates';
  data?: unknown;
}

export interface FormAutoFillResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

// 扩展现有的数据库类型
// Note: 数据库专用的类型定义在 database.ts 中，命名为 DatabaseFormTemplateData 和 DatabaseFormDefinitionData

// 字段类型推断规则
export interface FieldTypeInferenceRule {
  /** 规则名称 */
  name: string;
  /** 匹配条件 */
  conditions: {
    /** 输入类型匹配 */
    inputType?: string[];
    /** 标签文本匹配 (正则) */
    labelPattern?: string;
    /** 名称属性匹配 (正则) */
    namePattern?: string;
    /** ID属性匹配 (正则) */
    idPattern?: string;
    /** placeholder匹配 (正则) */
    placeholderPattern?: string;
  };
  /** 推断的字段类型 */
  fieldType: FormFieldType;
  /** 权重 (用于多规则匹配时的优先级) */
  weight: number;
}
