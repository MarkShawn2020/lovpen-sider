import type { FormFillRequest, FormFillResult, FormValidationResult } from '../types/form-filler.js';

export class FormFiller {
  private defaultOptions = {
    simulateTyping: true,
    typingDelay: 50,
    triggerEvents: true,
    scrollToField: true,
  };

  /**
   * 填写表单
   */
  async fillForm(request: FormFillRequest): Promise<FormFillResult> {
    const startTime = Date.now();
    const options = { ...this.defaultOptions, ...request.options };
    const result: FormFillResult = {
      success: false,
      message: '',
      filledCount: 0,
      failedFields: [],
      duration: 0,
    };

    try {
      // 找到目标表单
      const form = document.querySelector(request.formSelector);
      if (!form) {
        result.message = `未找到表单: ${request.formSelector}`;
        result.duration = Date.now() - startTime;
        return result;
      }

      // 执行填写操作
      const fillResults = await this.fillFormFields(form, request.data, options);

      result.filledCount = fillResults.filledCount;
      result.failedFields = fillResults.failedFields;
      result.success = fillResults.filledCount > 0;
      result.message = result.success ? `成功填写 ${result.filledCount} 个字段` : '没有字段被填写';

      if (result.failedFields.length > 0) {
        result.message += `，${result.failedFields.length} 个字段失败`;
      }
    } catch (error) {
      result.message = `填写失败: ${error instanceof Error ? error.message : '未知错误'}`;
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  /**
   * 填写表单字段
   */
  private async fillFormFields(
    form: Element,
    data: Record<string, string | string[] | boolean>,
    options: NonNullable<FormFillRequest['options']>,
  ): Promise<{ filledCount: number; failedFields: Array<{ fieldId: string; reason: string }> }> {
    const failedFields: Array<{ fieldId: string; reason: string }> = [];
    let successCount = 0;

    for (const [key, value] of Object.entries(data)) {
      try {
        const element = this.findFieldElement(form, key);
        if (!element) {
          failedFields.push({ fieldId: key, reason: '未找到对应的字段元素' });
          continue;
        }

        if (options.scrollToField) {
          this.scrollToElement(element);
          await this.delay(100);
        }

        const fillSuccess = await this.fillSingleField(element, value, options);
        if (fillSuccess) {
          successCount++;
        } else {
          failedFields.push({ fieldId: key, reason: '填写失败' });
        }
      } catch (error) {
        failedFields.push({
          fieldId: key,
          reason: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    return { filledCount: successCount, failedFields };
  }

  /**
   * 查找字段元素
   */
  private findFieldElement(form: Element, fieldKey: string): Element | null {
    // 尝试多种选择器方式
    const selectors = [
      `#${fieldKey}`, // ID
      `[name="${fieldKey}"]`, // name属性
      `[data-field="${fieldKey}"]`, // data属性
      `[placeholder*="${fieldKey}"]`, // placeholder包含
      fieldKey, // 直接作为选择器
    ];

    for (const selector of selectors) {
      try {
        const element = form.querySelector(selector);
        if (element && this.isValidFormElement(element)) {
          return element;
        }
      } catch {
        // 选择器无效，继续尝试下一个
      }
    }

    // 如果都找不到，尝试模糊匹配
    return this.findFieldByFuzzyMatch(form, fieldKey);
  }

  /**
   * 模糊匹配查找字段
   */
  private findFieldByFuzzyMatch(form: Element, fieldKey: string): Element | null {
    const formElements = Array.from(form.querySelectorAll('input, textarea, select'));
    const key = fieldKey.toLowerCase();

    // 按优先级排序查找
    const priorities = [
      (el: Element) => el.id?.toLowerCase() === key,
      (el: Element) => (el as HTMLInputElement).name?.toLowerCase() === key,
      (el: Element) => el.id?.toLowerCase().includes(key),
      (el: Element) => (el as HTMLInputElement).name?.toLowerCase().includes(key),
      (el: Element) => (el as HTMLInputElement).placeholder?.toLowerCase().includes(key),
    ];

    for (const priorityFn of priorities) {
      const found = formElements.find(priorityFn);
      if (found) return found;
    }

    return null;
  }

  /**
   * 填写单个字段
   */
  private async fillSingleField(
    element: Element,
    value: string | string[] | boolean,
    options: NonNullable<FormFillRequest['options']>,
  ): Promise<boolean> {
    if (!this.isValidFormElement(element)) {
      return false;
    }

    const htmlElement = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

    try {
      // 根据元素类型选择填写方法
      switch (htmlElement.tagName.toLowerCase()) {
        case 'input':
          return await this.fillInputElement(htmlElement as HTMLInputElement, value, options);
        case 'textarea':
          return await this.fillTextareaElement(htmlElement as HTMLTextAreaElement, value, options);
        case 'select':
          return await this.fillSelectElement(htmlElement as HTMLSelectElement, value);
        default:
          return false;
      }
    } catch (error) {
      console.error('填写字段失败:', error);
      return false;
    }
  }

  /**
   * 填写input元素
   */
  private async fillInputElement(
    input: HTMLInputElement,
    value: string | string[] | boolean,
    options: NonNullable<FormFillRequest['options']>,
  ): Promise<boolean> {
    const inputType = input.type.toLowerCase();

    switch (inputType) {
      case 'text':
      case 'email':
      case 'password':
      case 'tel':
      case 'url':
      case 'number':
      case 'date':
      case 'time':
      case 'datetime-local':
        return await this.fillTextInput(input, String(value), options);

      case 'checkbox':
        return this.fillCheckboxInput(input, Boolean(value));

      case 'radio':
        return this.fillRadioInput(input, String(value));

      case 'file':
        // 文件输入需要特殊处理，这里暂不实现
        return false;

      default:
        return await this.fillTextInput(input, String(value), options);
    }
  }

  /**
   * 填写文本输入框
   */
  private async fillTextInput(
    input: HTMLInputElement,
    value: string,
    options: NonNullable<FormFillRequest['options']>,
  ): Promise<boolean> {
    // 聚焦元素
    input.focus();

    if (options.triggerEvents) {
      this.dispatchEvent(input, 'focus');
    }

    // 清空现有内容
    input.value = '';
    if (options.triggerEvents) {
      this.dispatchEvent(input, 'input');
    }

    if (options.simulateTyping && options.typingDelay && options.typingDelay > 0) {
      // 模拟逐字输入
      for (let i = 0; i < value.length; i++) {
        input.value = value.substring(0, i + 1);

        if (options.triggerEvents) {
          this.dispatchEvent(input, 'input');
          this.dispatchEvent(input, 'keydown', { key: value[i] });
          this.dispatchEvent(input, 'keyup', { key: value[i] });
        }

        await this.delay(options.typingDelay);
      }
    } else {
      // 直接设置值
      input.value = value;
      if (options.triggerEvents) {
        this.dispatchEvent(input, 'input');
      }
    }

    // 触发change事件
    if (options.triggerEvents) {
      this.dispatchEvent(input, 'change');
      this.dispatchEvent(input, 'blur');
    }

    input.blur();
    return true;
  }

  /**
   * 填写textarea元素
   */
  private async fillTextareaElement(
    textarea: HTMLTextAreaElement,
    value: string | string[] | boolean,
    options: NonNullable<FormFillRequest['options']>,
  ): Promise<boolean> {
    const textValue = String(value);

    textarea.focus();
    if (options.triggerEvents) {
      this.dispatchEvent(textarea, 'focus');
    }

    textarea.value = '';
    if (options.triggerEvents) {
      this.dispatchEvent(textarea, 'input');
    }

    if (options.simulateTyping && options.typingDelay && options.typingDelay > 0) {
      // 模拟逐字输入
      const lines = textValue.split('\n');
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        for (let charIndex = 0; charIndex < line.length; charIndex++) {
          textarea.value += line[charIndex];
          if (options.triggerEvents) {
            this.dispatchEvent(textarea, 'input');
          }
          await this.delay(options.typingDelay);
        }

        if (lineIndex < lines.length - 1) {
          textarea.value += '\n';
          if (options.triggerEvents) {
            this.dispatchEvent(textarea, 'input');
          }
          await this.delay(options.typingDelay);
        }
      }
    } else {
      textarea.value = textValue;
      if (options.triggerEvents) {
        this.dispatchEvent(textarea, 'input');
      }
    }

    if (options.triggerEvents) {
      this.dispatchEvent(textarea, 'change');
      this.dispatchEvent(textarea, 'blur');
    }

    textarea.blur();
    return true;
  }

  /**
   * 填写select元素
   */
  private fillSelectElement(select: HTMLSelectElement, value: string | string[] | boolean): boolean {
    const targetValue = String(value);

    // 尝试精确匹配值
    for (let i = 0; i < select.options.length; i++) {
      const option = select.options[i];
      if (option.value === targetValue) {
        select.selectedIndex = i;
        this.dispatchEvent(select, 'change');
        return true;
      }
    }

    // 尝试匹配文本内容
    for (let i = 0; i < select.options.length; i++) {
      const option = select.options[i];
      if (option.textContent?.trim() === targetValue) {
        select.selectedIndex = i;
        this.dispatchEvent(select, 'change');
        return true;
      }
    }

    // 尝试模糊匹配
    const lowerValue = targetValue.toLowerCase();
    for (let i = 0; i < select.options.length; i++) {
      const option = select.options[i];
      const optionText = option.textContent?.toLowerCase() || '';
      const optionValue = option.value.toLowerCase();

      if (optionText.includes(lowerValue) || optionValue.includes(lowerValue)) {
        select.selectedIndex = i;
        this.dispatchEvent(select, 'change');
        return true;
      }
    }

    return false;
  }

  /**
   * 填写checkbox输入框
   */
  private fillCheckboxInput(input: HTMLInputElement, value: boolean): boolean {
    if (input.checked !== value) {
      input.checked = value;
      this.dispatchEvent(input, 'change');
      this.dispatchEvent(input, 'click');
      return true;
    }
    return true;
  }

  /**
   * 填写radio输入框
   */
  private fillRadioInput(input: HTMLInputElement, value: string): boolean {
    const name = input.name;
    if (!name) return false;

    // 查找同名的所有radio按钮
    const radios = Array.from(document.querySelectorAll(`input[type="radio"][name="${name}"]`)) as HTMLInputElement[];

    for (const radio of radios) {
      if (radio.value === value) {
        radio.checked = true;
        this.dispatchEvent(radio, 'change');
        this.dispatchEvent(radio, 'click');
        return true;
      }
    }

    return false;
  }

  /**
   * 验证表单
   */
  validateForm(formSelector: string): FormValidationResult {
    const result: FormValidationResult = {
      isValid: true,
      errors: [],
    };

    try {
      const form = document.querySelector(formSelector);
      if (!form) {
        result.isValid = false;
        result.errors.push({ fieldId: 'form', message: '未找到表单' });
        return result;
      }

      const formElements = Array.from(form.querySelectorAll('input, textarea, select')) as (
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
      )[];

      for (const element of formElements) {
        const validation = this.validateSingleField(element);
        if (!validation.isValid) {
          result.isValid = false;
          result.errors.push({
            fieldId: element.id || element.name || 'unknown',
            message: validation.message,
          });
        }
      }
    } catch (error) {
      result.isValid = false;
      result.errors.push({
        fieldId: 'form',
        message: error instanceof Error ? error.message : '验证失败',
      });
    }

    return result;
  }

  /**
   * 验证单个字段
   */
  private validateSingleField(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): {
    isValid: boolean;
    message: string;
  } {
    // HTML5原生验证
    if (!element.checkValidity()) {
      return {
        isValid: false,
        message: element.validationMessage || '字段验证失败',
      };
    }

    // 必填验证
    if (element.required && !element.value.trim()) {
      return {
        isValid: false,
        message: '此字段为必填项',
      };
    }

    return { isValid: true, message: '' };
  }

  /**
   * 滚动到元素
   */
  private scrollToElement(element: Element): void {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }

  /**
   * 触发事件
   */
  private dispatchEvent(element: Element, eventType: string, eventInit: EventInit & { key?: string } = {}): void {
    let event: Event;

    switch (eventType) {
      case 'keydown':
      case 'keyup':
        event = new KeyboardEvent(eventType, {
          bubbles: true,
          cancelable: true,
          ...eventInit,
        });
        break;
      case 'input':
        event = new InputEvent(eventType, {
          bubbles: true,
          cancelable: true,
          ...eventInit,
        });
        break;
      default:
        event = new Event(eventType, {
          bubbles: true,
          cancelable: true,
          ...eventInit,
        });
    }

    element.dispatchEvent(event);
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 检查是否为有效的表单元素
   */
  private isValidFormElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    const validTags = ['input', 'textarea', 'select'];

    if (!validTags.includes(tagName)) {
      return false;
    }

    // 检查input类型
    if (tagName === 'input') {
      const input = element as HTMLInputElement;
      const excludedTypes = ['submit', 'button', 'reset', 'hidden'];
      if (excludedTypes.includes(input.type.toLowerCase())) {
        return false;
      }
    }

    // 检查是否可见
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return false;
    }

    return true;
  }

  /**
   * 清空表单
   */
  clearForm(formSelector: string): FormFillResult {
    const startTime = Date.now();
    const result: FormFillResult = {
      success: false,
      message: '',
      filledCount: 0,
      failedFields: [],
      duration: 0,
    };

    try {
      const form = document.querySelector(formSelector);
      if (!form) {
        result.message = `未找到表单: ${formSelector}`;
        result.duration = Date.now() - startTime;
        return result;
      }

      const formElements = Array.from(form.querySelectorAll('input, textarea, select')) as (
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
      )[];
      let clearedCount = 0;

      for (const element of formElements) {
        if (this.isValidFormElement(element)) {
          try {
            if (element.tagName.toLowerCase() === 'input') {
              const input = element as HTMLInputElement;
              if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = false;
              } else {
                input.value = '';
              }
            } else {
              element.value = '';
            }

            this.dispatchEvent(element, 'input');
            this.dispatchEvent(element, 'change');
            clearedCount++;
          } catch (error) {
            result.failedFields.push({
              fieldId: element.id || element.name || 'unknown',
              reason: error instanceof Error ? error.message : '清空失败',
            });
          }
        }
      }

      result.success = clearedCount > 0;
      result.filledCount = clearedCount;
      result.message = result.success ? `成功清空 ${clearedCount} 个字段` : '没有字段被清空';
    } catch (error) {
      result.message = `清空失败: ${error instanceof Error ? error.message : '未知错误'}`;
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }
}
