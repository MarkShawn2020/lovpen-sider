import type {
  FormDetectionResult,
  FormFieldDefinition,
  FormFieldType,
  FieldTypeInferenceRule,
} from '../types/form-filler.js';

export class FormDetector {
  private fieldTypeRules: FieldTypeInferenceRule[] = [];
  private highlightedElements: Element[] = [];

  constructor() {
    this.initializeFieldTypeRules();
  }

  /**
   * 检测页面中所有的表单
   */
  detectForms(): FormDetectionResult[] {
    const forms = Array.from(document.querySelectorAll('form'));
    const results: FormDetectionResult[] = [];

    forms.forEach((form, index) => {
      const fields = this.detectFormFields(form);
      if (fields.length > 0) {
        const formSelector = this.generateFormSelector(form, index);
        const formType = this.inferFormType(form, fields);
        const confidence = this.calculateConfidence(form, fields);

        results.push({
          form,
          formSelector,
          fields,
          confidence,
          formType,
        });
      }
    });

    // 同时检测无form标签的表单区域
    const implicitForms = this.detectImplicitForms();
    results.push(...implicitForms);

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 检测特定表单的字段
   */
  detectFormFields(form: Element): FormFieldDefinition[] {
    const fields: FormFieldDefinition[] = [];
    const formElements = this.getFormElements(form);

    formElements.forEach((element, index) => {
      const fieldDef = this.analyzeFormElement(element, index);
      if (fieldDef) {
        fields.push(fieldDef);
      }
    });

    return fields.sort((a, b) => a.order - b.order);
  }

  /**
   * 获取表单内的所有输入元素
   */
  private getFormElements(form: Element): Element[] {
    const selectors = [
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"])',
      'textarea',
      'select',
    ];

    const elements: Element[] = [];
    selectors.forEach(selector => {
      const found = Array.from(form.querySelectorAll(selector));
      elements.push(...found);
    });

    return elements;
  }

  /**
   * 分析单个表单元素
   */
  private analyzeFormElement(element: Element, order: number): FormFieldDefinition | null {
    const htmlElement = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

    // 跳过隐藏元素
    if (this.isElementHidden(element)) {
      return null;
    }

    const type = this.inferFieldType(element);
    const label = this.extractFieldLabel(element);
    const selector = this.generateFieldSelector(element);
    const required = this.isFieldRequired(element);
    const placeholder = 'placeholder' in htmlElement ? htmlElement.placeholder || undefined : undefined;
    const options = this.extractFieldOptions(element);
    const validation = this.extractValidationRules(element);

    return {
      id: `field_${Date.now()}_${order}`,
      type,
      label,
      selector,
      order,
      required,
      placeholder,
      options,
      validation,
    };
  }

  /**
   * 推断字段类型
   */
  private inferFieldType(element: Element): FormFieldType {
    const htmlElement = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

    // 首先检查HTML类型
    if (htmlElement.tagName.toLowerCase() === 'textarea') {
      return 'textarea';
    }

    if (htmlElement.tagName.toLowerCase() === 'select') {
      return 'select';
    }

    if (htmlElement.tagName.toLowerCase() === 'input') {
      const inputElement = htmlElement as HTMLInputElement;
      const inputType = inputElement.type.toLowerCase();

      // 直接类型映射
      const typeMap: Record<string, FormFieldType> = {
        email: 'email',
        password: 'password',
        tel: 'tel',
        number: 'number',
        date: 'date',
        url: 'url',
        checkbox: 'checkbox',
        radio: 'radio',
        file: 'file',
      };

      if (typeMap[inputType]) {
        return typeMap[inputType];
      }
    }

    // 使用推断规则
    const inferredType = this.applyFieldTypeRules(element);
    return inferredType || 'text';
  }

  /**
   * 应用字段类型推断规则
   */
  private applyFieldTypeRules(element: Element): FormFieldType | null {
    const htmlElement = element as HTMLInputElement;
    const label = this.extractFieldLabel(element).toLowerCase();
    const name = htmlElement.name?.toLowerCase() || '';
    const id = htmlElement.id?.toLowerCase() || '';
    const placeholder = htmlElement.placeholder?.toLowerCase() || '';

    let bestMatch: { rule: FieldTypeInferenceRule; score: number } | null = null;

    for (const rule of this.fieldTypeRules) {
      let score = 0;

      // 检查标签匹配
      if (rule.conditions.labelPattern && new RegExp(rule.conditions.labelPattern, 'i').test(label)) {
        score += rule.weight * 0.4;
      }

      // 检查名称匹配
      if (rule.conditions.namePattern && new RegExp(rule.conditions.namePattern, 'i').test(name)) {
        score += rule.weight * 0.3;
      }

      // 检查ID匹配
      if (rule.conditions.idPattern && new RegExp(rule.conditions.idPattern, 'i').test(id)) {
        score += rule.weight * 0.3;
      }

      // 检查placeholder匹配
      if (rule.conditions.placeholderPattern && new RegExp(rule.conditions.placeholderPattern, 'i').test(placeholder)) {
        score += rule.weight * 0.2;
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { rule, score };
      }
    }

    return bestMatch?.rule.fieldType || null;
  }

  /**
   * 提取字段标签
   */
  private extractFieldLabel(element: Element): string {
    const htmlElement = element as HTMLInputElement;

    // 1. 查找关联的label元素
    if (htmlElement.id) {
      const label = document.querySelector(`label[for="${htmlElement.id}"]`);
      if (label?.textContent?.trim()) {
        return label.textContent.trim();
      }
    }

    // 2. 查找父级label
    let parent = element.parentElement;
    while (parent && parent.tagName.toLowerCase() !== 'form') {
      if (parent.tagName.toLowerCase() === 'label') {
        const labelText = parent.textContent?.trim() || '';
        // 移除input元素的值部分
        return labelText.replace(htmlElement.value || '', '').trim();
      }
      parent = parent.parentElement;
    }

    // 3. 查找前面的文本节点或元素
    const prevElement = this.findPreviousLabelElement(element);
    if (prevElement) {
      return prevElement;
    }

    // 4. 使用placeholder
    if (htmlElement.placeholder) {
      return htmlElement.placeholder;
    }

    // 5. 使用name属性
    if (htmlElement.name) {
      return this.formatFieldName(htmlElement.name);
    }

    // 6. 使用id属性
    if (htmlElement.id) {
      return this.formatFieldName(htmlElement.id);
    }

    return 'Unknown Field';
  }

  /**
   * 查找前面的标签元素
   */
  private findPreviousLabelElement(element: Element): string | null {
    let current = element.previousElementSibling;

    while (current) {
      const text = current.textContent?.trim();
      if (text && text.length > 0 && text.length < 100) {
        // 检查是否像标签文本
        if (/^[a-zA-Z\u4e00-\u9fa5][^<>]*[：:：]?$/u.test(text)) {
          return text.replace(/[：:：]$/, '');
        }
      }
      current = current.previousElementSibling;
    }

    return null;
  }

  /**
   * 格式化字段名称
   */
  private formatFieldName(name: string): string {
    return name
      .replace(/[_-]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  /**
   * 生成字段选择器
   */
  private generateFieldSelector(element: Element): string {
    const htmlElement = element as HTMLInputElement;

    // 优先使用ID
    if (htmlElement.id) {
      return `#${htmlElement.id}`;
    }

    // 使用name属性
    if (htmlElement.name) {
      return `[name="${htmlElement.name}"]`;
    }

    // 使用类名和标签
    const tagName = htmlElement.tagName.toLowerCase();
    if (htmlElement.className) {
      const classes = htmlElement.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        return `${tagName}.${classes.slice(0, 2).join('.')}`;
      }
    }

    // 使用类型和位置
    if (htmlElement.type) {
      const form = htmlElement.closest('form');
      if (form) {
        const similarElements = Array.from(form.querySelectorAll(`input[type="${htmlElement.type}"]`));
        const index = similarElements.indexOf(htmlElement);
        return `form input[type="${htmlElement.type}"]:nth-of-type(${index + 1})`;
      }
    }

    // 最后使用标签和位置
    return this.generatePositionalSelector(htmlElement);
  }

  /**
   * 生成位置选择器
   */
  private generatePositionalSelector(element: Element): string {
    const path: string[] = [];
    let current = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children).filter(
          sibling => sibling.tagName === current.tagName,
        );

        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement!;

      // 限制路径深度
      if (path.length >= 4) break;
    }

    return path.join(' > ');
  }

  /**
   * 检查字段是否必填
   */
  private isFieldRequired(element: Element): boolean {
    const htmlElement = element as HTMLInputElement;

    // HTML5 required属性
    if (htmlElement.required) {
      return true;
    }

    // 检查标签文本中的必填标识
    const label = this.extractFieldLabel(element).toLowerCase();
    return /\*|必填|required|mandatory/.test(label);
  }

  /**
   * 提取字段选项（用于select和radio）
   */
  private extractFieldOptions(element: Element): Array<{ value: string; label: string }> | undefined {
    if (element.tagName.toLowerCase() === 'select') {
      const select = element as HTMLSelectElement;
      return Array.from(select.options).map(option => ({
        value: option.value,
        label: option.textContent || option.value,
      }));
    }

    if (element.tagName.toLowerCase() === 'input') {
      const input = element as HTMLInputElement;
      if (input.type === 'radio') {
        const name = input.name;
        if (name) {
          const radios = Array.from(
            document.querySelectorAll(`input[type="radio"][name="${name}"]`),
          ) as HTMLInputElement[];
          return radios.map(radio => ({
            value: radio.value,
            label: this.extractFieldLabel(radio) || radio.value,
          }));
        }
      }
    }

    return undefined;
  }

  /**
   * 提取验证规则
   */
  private extractValidationRules(element: Element): FormFieldDefinition['validation'] | undefined {
    const htmlElement = element as HTMLInputElement;
    const validation: NonNullable<FormFieldDefinition['validation']> = {};

    if (htmlElement.pattern) {
      validation.pattern = htmlElement.pattern;
    }

    if (htmlElement.minLength !== undefined && htmlElement.minLength > 0) {
      validation.minLength = htmlElement.minLength;
    }

    if (htmlElement.maxLength !== undefined && htmlElement.maxLength > 0) {
      validation.maxLength = htmlElement.maxLength;
    }

    if (htmlElement.min !== undefined && htmlElement.min !== '') {
      validation.min = parseFloat(htmlElement.min);
    }

    if (htmlElement.max !== undefined && htmlElement.max !== '') {
      validation.max = parseFloat(htmlElement.max);
    }

    return Object.keys(validation).length > 0 ? validation : undefined;
  }

  /**
   * 生成表单选择器
   */
  private generateFormSelector(form: Element, index: number): string {
    if (form.id) {
      return `#${form.id}`;
    }

    if (form.className) {
      const classes = form.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        return `form.${classes[0]}`;
      }
    }

    return `form:nth-of-type(${index + 1})`;
  }

  /**
   * 推断表单类型
   */
  private inferFormType(form: Element, fields: FormFieldDefinition[]): FormDetectionResult['formType'] {
    const fieldLabels = fields.map(f => f.label.toLowerCase()).join(' ');
    const formText = (form.textContent || '').toLowerCase();
    const allText = `${fieldLabels} ${formText}`;

    // 登录表单
    if (/登录|login|signin|sign in/.test(allText) && fields.some(f => f.type === 'password') && fields.length <= 4) {
      return 'login';
    }

    // 注册表单
    if (/注册|register|signup|sign up/.test(allText) && fields.some(f => f.type === 'password') && fields.length >= 3) {
      return 'register';
    }

    // 联系表单
    if (/联系|contact|留言|message/.test(allText) && fields.some(f => f.type === 'email' || f.type === 'textarea')) {
      return 'contact';
    }

    // 支付表单
    if (/支付|payment|pay|billing|credit|card/.test(allText)) {
      return 'payment';
    }

    // 个人资料表单
    if (/个人|profile|account|setting|设置/.test(allText) && fields.length >= 3) {
      return 'profile';
    }

    // 搜索表单
    if (/搜索|search/.test(allText) && fields.length <= 2) {
      return 'search';
    }

    return 'other';
  }

  /**
   * 计算检测置信度
   */
  private calculateConfidence(form: Element, fields: FormFieldDefinition[]): number {
    let confidence = 0.5; // 基础分数

    // 字段数量评分
    if (fields.length >= 2) confidence += 0.2;
    if (fields.length >= 4) confidence += 0.1;

    // 字段类型多样性评分
    const fieldTypes = new Set(fields.map(f => f.type));
    confidence += fieldTypes.size * 0.05;

    // 标签质量评分
    const labelQuality = fields.filter(f => f.label !== 'Unknown Field' && f.label.length > 2).length / fields.length;
    confidence += labelQuality * 0.2;

    // 表单结构评分
    if (form.tagName.toLowerCase() === 'form') confidence += 0.1;
    if (form.id || form.className) confidence += 0.05;

    return Math.min(confidence, 1.0);
  }

  /**
   * 检测隐式表单（无form标签的表单区域）
   */
  private detectImplicitForms(): FormDetectionResult[] {
    const results: FormDetectionResult[] = [];

    // 更广泛的容器选择，但仍然有一定筛选
    const containers = Array.from(document.querySelectorAll('div, section, article, main, .container'));

    containers.forEach((container, index) => {
      // 跳过已经在form标签内的容器
      if (container.closest('form')) {
        return;
      }

      const formElements = this.getFormElements(container);

      // 降低最小字段数要求
      if (formElements.length >= 2) {
        const fields = formElements
          .map((element, fieldIndex) => this.analyzeFormElement(element, fieldIndex))
          .filter(Boolean) as FormFieldDefinition[];

        // 更宽松的条件：至少2个字段，或者有提交按钮
        const fieldTypes = new Set(fields.map(f => f.type));
        const hasSubmitButton = container.querySelector(
          'button[type="submit"], input[type="submit"], button:not([type])',
        );

        if (fields.length >= 2) {
          const formSelector = this.generateContainerSelector(container, index);
          const formType = this.inferFormType(container, fields);
          let confidence = this.calculateConfidence(container, fields) * 0.7; // 降低隐式表单的置信度

          // 如果有提交按钮，提高置信度
          if (hasSubmitButton) {
            confidence *= 1.2;
          }

          // 如果字段类型多样，提高置信度
          if (fieldTypes.size >= 3) {
            confidence *= 1.1;
          }

          results.push({
            form: container,
            formSelector,
            fields,
            confidence: Math.min(confidence, 1.0),
            formType,
          });
        }
      }
    });

    // 只返回一定置信度的结果，并限制数量
    return results
      .filter(result => result.confidence > 0.3)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10); // 最多返回10个隐式表单
  }

  /**
   * 生成容器选择器
   */
  private generateContainerSelector(container: Element, index: number): string {
    if (container.id) {
      return `#${container.id}`;
    }

    const className = container.className;
    if (className) {
      const classes = className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        return `.${classes[0]}`;
      }
    }

    return `${container.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
  }

  /**
   * 检查元素是否隐藏
   */
  private isElementHidden(element: Element): boolean {
    const style = window.getComputedStyle(element);
    return (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0' ||
      (element as HTMLElement).offsetParent === null
    );
  }

  /**
   * 初始化字段类型推断规则
   */
  private initializeFieldTypeRules(): void {
    this.fieldTypeRules = [
      // 邮箱字段
      {
        name: 'email',
        conditions: {
          labelPattern: '邮箱|email|e-mail|电子邮件',
          namePattern: 'email|mail',
          idPattern: 'email|mail',
          placeholderPattern: 'email|邮箱|@',
        },
        fieldType: 'email',
        weight: 10,
      },
      // 密码字段
      {
        name: 'password',
        conditions: {
          labelPattern: '密码|password|pwd|口令',
          namePattern: 'password|pwd|pass',
          idPattern: 'password|pwd|pass',
          placeholderPattern: 'password|密码',
        },
        fieldType: 'password',
        weight: 10,
      },
      // 电话字段
      {
        name: 'phone',
        conditions: {
          labelPattern: '电话|手机|phone|mobile|tel',
          namePattern: 'phone|mobile|tel',
          idPattern: 'phone|mobile|tel',
          placeholderPattern: 'phone|电话|手机',
        },
        fieldType: 'tel',
        weight: 9,
      },
      // 姓名字段
      {
        name: 'name',
        conditions: {
          labelPattern: '姓名|用户名|name|username|昵称|nickname',
          namePattern: 'name|user|nick',
          idPattern: 'name|user|nick',
          placeholderPattern: 'name|姓名|用户名',
        },
        fieldType: 'text',
        weight: 8,
      },
      // 日期字段
      {
        name: 'date',
        conditions: {
          labelPattern: '日期|时间|date|time|生日|birthday',
          namePattern: 'date|time|birth',
          idPattern: 'date|time|birth',
          placeholderPattern: 'date|日期|时间',
        },
        fieldType: 'date',
        weight: 9,
      },
      // URL字段
      {
        name: 'url',
        conditions: {
          labelPattern: 'url|网址|链接|link|website',
          namePattern: 'url|link|website',
          idPattern: 'url|link|website',
          placeholderPattern: 'http|url|网址',
        },
        fieldType: 'url',
        weight: 8,
      },
      // 数字字段
      {
        name: 'number',
        conditions: {
          labelPattern: '数量|年龄|age|number|count|amount',
          namePattern: 'number|count|amount|age|qty',
          idPattern: 'number|count|amount|age|qty',
          placeholderPattern: 'number|数字|数量',
        },
        fieldType: 'number',
        weight: 7,
      },
    ];
  }

  /**
   * 高亮显示表单字段
   */
  highlightFormFields(forms: FormDetectionResult[]): void {
    // 清除之前的高亮
    this.clearHighlights();

    let highlightedCount = 0;
    forms.forEach((formResult, formIndex) => {
      console.log(`处理表单 ${formIndex + 1}:`, formResult.formSelector, `包含 ${formResult.fields.length} 个字段`);

      formResult.fields.forEach((field, fieldIndex) => {
        // 尝试多种选择方式
        const element = this.findElementByField(field);

        if (element) {
          console.log(`  字段 ${fieldIndex + 1}: ${field.label || field.type} - 选择器: ${field.selector}`);
          this.highlightElement(element, field);
          highlightedCount++;
        } else {
          console.warn(`  字段 ${fieldIndex + 1}: 未找到元素 - 选择器: ${field.selector}`);
        }
      });
    });

    console.log(`总共高亮了 ${highlightedCount} 个字段`);

    if (highlightedCount === 0) {
      console.warn('没有高亮任何字段，可能的原因：');
      console.warn('1. 选择器无法找到对应元素');
      console.warn('2. 字段分析失败');
      console.warn('3. DOM结构与预期不符');
    }
  }

  /**
   * 通过多种方式查找字段元素
   */
  private findElementByField(field: FormFieldDefinition): HTMLElement | null {
    console.log(`    查找字段元素: ${field.type} - ${field.selector}`);

    // 方法1: 直接使用选择器
    let element = document.querySelector(field.selector) as HTMLElement;
    if (element) {
      console.log(`    ✓ 通过选择器找到: ${field.selector}`);
      return element;
    }
    console.log(`    ✗ 选择器未找到: ${field.selector}`);

    // 方法2: 如果有ID，直接通过ID查找
    if (field.id) {
      element = document.getElementById(field.id) as HTMLElement;
      if (element) {
        console.log(`    ✓ 通过ID找到: ${field.id}`);
        return element;
      }
      console.log(`    ✗ ID未找到: ${field.id}`);
    }

    // 方法3: 如果有name，通过name查找
    if ((field as any).name) {
      const nameSelector = `[name="${(field as any).name}"]`;
      element = document.querySelector(nameSelector) as HTMLElement;
      if (element) {
        console.log(`    ✓ 通过name找到: ${(field as any).name}`);
        return element;
      }
      console.log(`    ✗ name未找到: ${(field as any).name}`);
    }

    // 方法4: 通过类型和索引查找
    const typeSelector =
      field.type === 'textarea'
        ? 'textarea'
        : field.type === 'select'
          ? 'select'
          : `input[type="${field.type}"], input:not([type])`;

    const elementsOfType = Array.from(document.querySelectorAll(typeSelector));
    if (elementsOfType.length > 0) {
      console.log(`    找到 ${elementsOfType.length} 个 ${field.type} 类型的元素`);
      // 尝试返回第一个可见的元素
      for (const el of elementsOfType) {
        const htmlEl = el as HTMLElement;
        if (htmlEl.offsetParent !== null) {
          // 检查元素是否可见
          console.log(`    ✓ 通过类型找到可见元素: ${typeSelector}`);
          return htmlEl;
        }
      }
    }

    console.log(`    ✗ 所有方法都未找到元素`);
    return null;
  }

  /**
   * 高亮单个元素
   */
  private highlightElement(element: HTMLElement, field: FormFieldDefinition): void {
    // 保存原始样式
    const originalStyle = element.style.cssText;
    element.setAttribute('data-original-style', originalStyle);

    // 添加高亮样式
    const highlightStyles = {
      outline: '3px solid #3b82f6',
      outlineOffset: '2px',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      position: 'relative',
      zIndex: '1000',
    };

    Object.assign(element.style, highlightStyles);

    // 添加标签
    this.addFieldLabel(element, field);

    // 记录高亮的元素
    this.highlightedElements.push(element);
  }

  /**
   * 为字段添加标签
   */
  private addFieldLabel(element: HTMLElement, field: FormFieldDefinition): void {
    // 创建标签元素
    const label = document.createElement('div');
    label.className = 'form-field-label';
    label.style.cssText = `
      position: absolute;
      top: -25px;
      left: 0;
      background: #3b82f6;
      color: white;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-weight: 500;
      white-space: nowrap;
      z-index: 1001;
      pointer-events: none;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;

    // 设置标签文本
    const typeIcon = this.getFieldTypeIcon(field.type);
    const labelText = field.label || field.type;
    label.textContent = `${typeIcon} ${labelText}`;

    // 确保父元素有相对定位
    const parent = element.parentElement;
    if (parent && getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    // 插入标签
    element.parentElement?.insertBefore(label, element);
    this.highlightedElements.push(label);
  }

  /**
   * 获取字段类型图标
   */
  private getFieldTypeIcon(type: FormFieldType): string {
    const iconMap: Record<FormFieldType, string> = {
      text: '📝',
      email: '📧',
      password: '🔒',
      tel: '📞',
      number: '🔢',
      date: '📅',
      url: '🔗',
      textarea: '📄',
      select: '📋',
      checkbox: '☑️',
      radio: '🔘',
      file: '📎',
    };
    return iconMap[type] || '📝';
  }

  /**
   * 清除所有高亮
   */
  clearHighlights(): void {
    this.highlightedElements.forEach(element => {
      if (element.hasAttribute('data-original-style')) {
        // 恢复原始样式
        const originalStyle = element.getAttribute('data-original-style') || '';
        (element as HTMLElement).style.cssText = originalStyle;
        element.removeAttribute('data-original-style');
      } else if (element.className === 'form-field-label') {
        // 移除标签
        element.remove();
      }
    });

    this.highlightedElements = [];
  }

  /**
   * 高亮指定的表单
   */
  highlightSpecificForm(formSelector: string): void {
    this.clearHighlights();

    const form = document.querySelector(formSelector);
    if (form) {
      const fields = this.detectFormFields(form);
      fields.forEach(field => {
        const element = document.querySelector(field.selector) as HTMLElement;
        if (element) {
          this.highlightElement(element, field);
        }
      });
    }
  }
}
