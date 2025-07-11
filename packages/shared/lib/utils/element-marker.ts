/**
 * 通用页面元素标记工具
 * 用于可视化标记网页中所有有意义的元素
 */

export interface ElementInfo {
  element: HTMLElement;
  type: ElementType;
  selector: string;
  label: string;
  description: string;
  isVisible: boolean;
  bounds: DOMRect;
}

export type ElementType =
  | 'input' // 输入元素
  | 'button' // 按钮元素
  | 'link' // 链接元素
  | 'container' // 容器元素
  | 'navigation' // 导航元素
  | 'form' // 表单元素
  | 'text' // 文本内容
  | 'image' // 图片元素
  | 'media'; // 媒体元素

export interface MarkerConfig {
  showInputs: boolean;
  showButtons: boolean;
  showLinks: boolean;
  showContainers: boolean;
  showNavigation: boolean;
  showForms: boolean;
  showText: boolean;
  showImages: boolean;
  showMedia: boolean;
  minSize: number; // 最小尺寸（像素）
}

export class ElementMarker {
  private markedElements: HTMLElement[] = [];
  private scrollListener: (() => void) | null = null;
  private elementInfos: Array<{ elementInfo: ElementInfo; index: number; overlay: HTMLElement; label: HTMLElement }> =
    [];
  private updateTimeout: number | null = null;
  private config: MarkerConfig = {
    showInputs: true,
    showButtons: true,
    showLinks: true,
    showContainers: true,
    showNavigation: true,
    showForms: true,
    showText: false, // 默认不显示纯文本
    showImages: false, // 默认不显示图片
    showMedia: false, // 默认不显示媒体
    minSize: 10,
  };

  constructor(config?: Partial<MarkerConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * 检测并标记所有有意义的元素（只包含文本与可交互元素）
   */
  markAllElements(): ElementInfo[] {
    this.clearMarkers();

    // 临时启用文本显示
    const originalShowText = this.config.showText;
    this.config.showText = true;

    const elements = this.detectElements().filter(el => ['input', 'button', 'link', 'form', 'text'].includes(el.type));

    // 恢复原设置
    this.config.showText = originalShowText;

    this.createMarkers(elements);
    return elements;
  }

  /**
   * 只标记输入相关元素
   */
  markInputElements(): ElementInfo[] {
    return this.markElementsByType(['input', 'button', 'form']);
  }

  /**
   * 只标记容器元素
   */
  markContainerElements(): ElementInfo[] {
    return this.markElementsByType(['container', 'navigation']);
  }

  /**
   * 按类型标记元素
   */
  markElementsByType(types: ElementType[]): ElementInfo[] {
    this.clearMarkers();
    const elements = this.detectElements().filter(el => types.includes(el.type));
    this.createMarkers(elements);
    return elements;
  }

  /**
   * 检测页面中的所有有意义元素
   */
  private detectElements(): ElementInfo[] {
    const elements: ElementInfo[] = [];
    const allElements = Array.from(document.querySelectorAll('*')) as HTMLElement[];

    for (const element of allElements) {
      const elementInfo = this.analyzeElement(element);
      if (elementInfo) {
        elements.push(elementInfo);
      }
    }

    return elements.sort((a, b) => this.getElementPriority(b.type) - this.getElementPriority(a.type));
  }

  /**
   * 分析单个元素
   */
  private analyzeElement(element: HTMLElement): ElementInfo | null {
    // 检查元素是否可见和有意义
    if (!this.isElementMeaningful(element)) {
      return null;
    }

    const type = this.getElementType(element);
    if (!type || !this.shouldShowType(type)) {
      return null;
    }

    const bounds = element.getBoundingClientRect();
    if (bounds.width < this.config.minSize || bounds.height < this.config.minSize) {
      return null;
    }

    return {
      element,
      type,
      selector: this.generateSelector(element),
      label: this.getElementLabel(element, type),
      description: this.getElementDescription(element, type),
      isVisible: this.isElementVisible(element),
      bounds,
    };
  }

  /**
   * 判断元素类型（按优先级互斥检测）
   */
  private getElementType(element: HTMLElement): ElementType | null {
    const tagName = element.tagName.toLowerCase();
    const type = element.getAttribute('type')?.toLowerCase();
    const role = element.getAttribute('role')?.toLowerCase();

    // 优先级1: 原生表单输入元素（最高优先级）
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      return 'input';
    }

    // 优先级2: 原生按钮元素
    if (tagName === 'button' || (tagName === 'input' && ['button', 'submit', 'reset'].includes(type || ''))) {
      return 'button';
    }

    // 优先级3: 链接元素
    if (tagName === 'a' && element.hasAttribute('href')) {
      return 'link';
    }

    // 优先级4: 表单容器元素
    if (tagName === 'form' || tagName === 'fieldset' || tagName === 'legend') {
      return 'form';
    }

    // 优先级5: 自定义可交互元素（通过role或属性识别）
    if (this.isCustomInteractiveElement(element)) {
      return 'button';
    }

    // 优先级6: 导航元素
    if (this.isNavigationElement(element, tagName, role)) {
      return 'navigation';
    }

    // 优先级7: 媒体元素
    if (['img', 'svg', 'canvas', 'video', 'audio'].includes(tagName)) {
      return 'image';
    }

    // 优先级8: 文本内容元素
    if (this.isTextElement(element, tagName)) {
      return 'text';
    }

    // 优先级9: 容器元素（最低优先级，避免与其他类型重叠）
    if (this.isContainerElement(element, tagName)) {
      return 'container';
    }

    return null;
  }

  /**
   * 检测自定义可交互元素
   */
  private isCustomInteractiveElement(element: HTMLElement): boolean {
    const role = element.getAttribute('role')?.toLowerCase();

    // 通过role属性识别
    if (['button', 'radio', 'checkbox', 'switch', 'tab', 'option', 'menuitem', 'treeitem'].includes(role || '')) {
      return true;
    }

    // 通过事件属性识别
    if (element.hasAttribute('onclick')) {
      return true;
    }

    // 通过可访问性属性识别
    if (element.hasAttribute('aria-checked') || element.hasAttribute('aria-selected')) {
      return true;
    }

    // 通过tabindex识别（但排除-1，因为那通常是为了编程控制）
    const tabindex = element.getAttribute('tabindex');
    if (tabindex && tabindex !== '-1' && parseInt(tabindex) >= 0) {
      return true;
    }

    // 通过明确的交互类名识别
    const interactiveClassNames = ['btn', 'button', 'clickable', 'selectable'];
    if (interactiveClassNames.some(className => element.classList.contains(className))) {
      return true;
    }

    // 通过选择相关的类名识别
    const selectionClassNames = ['option', 'choice'];
    if (selectionClassNames.some(className => element.classList.contains(className))) {
      return true;
    }

    return false;
  }

  /**
   * 检测导航元素
   */
  private isNavigationElement(element: HTMLElement, tagName: string, role: string | undefined): boolean {
    if (tagName === 'nav' || role === 'navigation') {
      return true;
    }

    const navClassNames = ['nav', 'navigation', 'menu'];
    return navClassNames.some(className => element.classList.contains(className));
  }

  /**
   * 检测文本元素
   */
  private isTextElement(element: HTMLElement, tagName: string): boolean {
    // 标准文本标签
    const textTags = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'span',
      'label',
      'li',
      'td',
      'th',
      'blockquote',
      'pre',
      'code',
    ];

    return textTags.includes(tagName);
  }

  /**
   * 检测容器元素（更严格的条件避免重复）
   */
  private isContainerElement(element: HTMLElement, tagName: string): boolean {
    if (!['div', 'section', 'article', 'main', 'aside', 'header', 'footer'].includes(tagName)) {
      return false;
    }

    const hasContent = this.hasSignificantContent(element);
    const hasInteractiveChildren = this.hasInteractiveChildren(element);

    // 如果容器只有文本内容且是简单文本容器，不归类为容器
    if (hasContent && !hasInteractiveChildren && this.isSimpleTextContainer(element)) {
      return false;
    }

    // 只有真正有内容或有交互子元素的才算容器
    return hasContent || hasInteractiveChildren;
  }

  /**
   * 检查元素是否有意义
   */
  private isElementMeaningful(element: HTMLElement): boolean {
    // 跳过已经被标记的元素
    if (element.classList.contains('element-marker-overlay')) {
      return false;
    }

    // 跳过隐藏元素
    if (!this.isElementVisible(element)) {
      return false;
    }

    // 跳过脚本和样式元素
    const tagName = element.tagName.toLowerCase();
    if (['script', 'style', 'meta', 'head', 'title'].includes(tagName)) {
      return false;
    }

    // 避免标记已被父级覆盖的元素
    if (this.isElementCoveredByParent(element)) {
      return false;
    }

    return true;
  }

  /**
   * 检查元素是否被父级元素覆盖（避免重复标记）
   */
  private isElementCoveredByParent(element: HTMLElement): boolean {
    let parent = element.parentElement;

    while (parent && parent !== document.body) {
      // 如果父元素也会被检测为同一类型，则跳过子元素
      const parentType = this.getElementType(parent);
      const elementType = this.getElementType(element);

      if (parentType && elementType && parentType === elementType) {
        // 如果父元素是容器类型，允许子元素被标记
        if (parentType !== 'container') {
          return true;
        }
      }

      parent = parent.parentElement;
    }

    return false;
  }

  /**
   * 检查元素是否可见
   */
  private isElementVisible(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);

    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }

    const bounds = element.getBoundingClientRect();
    return bounds.width > 0 && bounds.height > 0;
  }

  /**
   * 检查容器是否有重要内容
   */
  private hasSignificantContent(element: HTMLElement): boolean {
    const text = element.textContent?.trim();
    return (text && text.length > 2) || false;
  }

  /**
   * 检查是否包含交互式子元素
   */
  private hasInteractiveChildren(element: HTMLElement): boolean {
    const interactiveSelectors = [
      'input',
      'button',
      'select',
      'textarea',
      'a[href]',
      '[role="button"]',
      '[onclick]',
      '[tabindex]',
    ];

    return interactiveSelectors.some(selector => element.querySelector(selector) !== null);
  }

  /**
   * 检查是否为简单的文本容器
   */
  private isSimpleTextContainer(element: HTMLElement): boolean {
    // 检查子元素数量
    const childElements = Array.from(element.children);

    // 如果没有子元素，直接文本
    if (childElements.length === 0) {
      return true;
    }

    // 如果只有少量子元素且都是文本元素
    if (childElements.length <= 3) {
      const textTags = ['span', 'strong', 'em', 'b', 'i', 'small', 'mark', 'u'];
      return childElements.every(child => textTags.includes(child.tagName.toLowerCase()));
    }

    return false;
  }

  /**
   * 是否应该显示此类型的元素
   */
  private shouldShowType(type: ElementType): boolean {
    switch (type) {
      case 'input':
        return this.config.showInputs;
      case 'button':
        return this.config.showButtons;
      case 'link':
        return this.config.showLinks;
      case 'container':
        return this.config.showContainers;
      case 'navigation':
        return this.config.showNavigation;
      case 'form':
        return this.config.showForms;
      case 'text':
        return this.config.showText;
      case 'image':
        return this.config.showImages;
      case 'media':
        return this.config.showMedia;
      default:
        return false;
    }
  }

  /**
   * 获取元素优先级（用于排序）
   */
  private getElementPriority(type: ElementType): number {
    const priorities = {
      input: 10,
      button: 9,
      form: 8,
      link: 7,
      navigation: 6,
      container: 5,
      text: 4,
      image: 3,
      media: 2,
    };
    return priorities[type] || 1;
  }

  /**
   * 生成元素选择器
   */
  private generateSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }

    const nameAttr = element.getAttribute('name');
    if (nameAttr) {
      return `[name="${nameAttr}"]`;
    }

    const tagName = element.tagName.toLowerCase();
    const classes = Array.from(element.classList).slice(0, 2);

    if (classes.length > 0) {
      return `${tagName}.${classes.join('.')}`;
    }

    return tagName;
  }

  /**
   * 获取元素标签
   */
  private getElementLabel(element: HTMLElement, type: ElementType): string {
    const tagName = element.tagName.toLowerCase();

    // 尝试从各种属性获取有意义的标签
    let label: string | null =
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      element.getAttribute('placeholder') ||
      element.getAttribute('alt') ||
      element.getAttribute('value');

    // 对于输入元素，尝试找关联的label
    if (type === 'input' && !label) {
      const labelElement = document.querySelector(`label[for="${element.id}"]`);
      if (labelElement) {
        label = labelElement.textContent?.trim() || null;
      }
    }

    // 对于链接，使用链接文本
    if (type === 'link' && !label) {
      label = element.textContent?.trim() || null;
    }

    // 对于按钮，使用按钮文本
    if (type === 'button' && !label) {
      label = element.textContent?.trim() || null;
    }

    // 如果还是没有标签，使用标签名
    if (!label || label.length === 0) {
      label = tagName;
    }

    return label.substring(0, 30); // 限制长度
  }

  /**
   * 获取元素描述
   */
  private getElementDescription(element: HTMLElement, _type: ElementType): string {
    const tagName = element.tagName.toLowerCase();
    const elementType = element.getAttribute('type') || '';

    let description = `${tagName}`;
    if (elementType) {
      description += `[${elementType}]`;
    }

    // 添加尺寸信息
    const bounds = element.getBoundingClientRect();
    description += ` (${Math.round(bounds.width)}×${Math.round(bounds.height)})`;

    return description;
  }

  /**
   * 创建可视化标记
   */
  private createMarkers(elements: ElementInfo[]): void {
    console.log(`创建 ${elements.length} 个元素标记`);

    elements.forEach((elementInfo, index) => {
      this.createMarker(elementInfo, index);
    });

    // 设置滚动监听器
    this.setupScrollListener();
  }

  /**
   * 创建单个标记
   */
  private createMarker(elementInfo: ElementInfo, index: number): void {
    const { element, type } = elementInfo;
    const bounds = element.getBoundingClientRect();

    // 创建覆盖层
    const overlay = document.createElement('div');
    overlay.className = 'element-marker-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: ${bounds.top}px;
      left: ${bounds.left}px;
      width: ${bounds.width}px;
      height: ${bounds.height}px;
      pointer-events: none;
      z-index: 10000;
      ${this.getMarkerStyles(type)}
    `;

    // 添加到页面
    document.body.appendChild(overlay);

    // 记录标记的元素和相关信息（不包含标签）
    this.markedElements.push(overlay);
    this.elementInfos.push({ elementInfo, index, overlay, label: overlay }); // 使用overlay作为占位符
  }

  /**
   * 获取标记样式
   */
  private getMarkerStyles(type: ElementType): string {
    const styles = {
      input: 'border: 3px solid #3b82f6; background: rgba(59, 130, 246, 0.1);',
      button: 'border: 3px solid #10b981; background: rgba(16, 185, 129, 0.1);',
      link: 'border: 3px solid #8b5cf6; background: rgba(139, 92, 246, 0.1);',
      form: 'border: 3px solid #f59e0b; background: rgba(245, 158, 11, 0.1);',
      navigation: 'border: 3px solid #ef4444; background: rgba(239, 68, 68, 0.1);',
      container: 'border: 2px dashed #6b7280; background: rgba(107, 114, 128, 0.05);',
      text: 'border: 2px dotted #84cc16; background: rgba(132, 204, 22, 0.05);',
      image: 'border: 3px solid #ec4899; background: rgba(236, 72, 153, 0.1);',
      media: 'border: 3px solid #06b6d4; background: rgba(6, 182, 212, 0.1);',
    };
    return styles[type] || styles.container;
  }

  /**
   * 获取标签样式
   */
  private getLabelStyles(type: ElementType): string {
    const styles = {
      input: 'background: #3b82f6; color: white;',
      button: 'background: #10b981; color: white;',
      link: 'background: #8b5cf6; color: white;',
      form: 'background: #f59e0b; color: white;',
      navigation: 'background: #ef4444; color: white;',
      container: 'background: #6b7280; color: white;',
      text: 'background: #84cc16; color: white;',
      image: 'background: #ec4899; color: white;',
      media: 'background: #06b6d4; color: white;',
    };
    return styles[type] || styles.container;
  }

  /**
   * 获取类型图标
   */
  private getTypeIcon(type: ElementType): string {
    const icons = {
      input: '📝',
      button: '🔘',
      link: '🔗',
      form: '📋',
      navigation: '🧭',
      container: '📦',
      text: '📄',
      image: '🖼️',
      media: '🎬',
    };
    return icons[type] || '❓';
  }

  /**
   * 设置滚动监听器
   */
  private setupScrollListener(): void {
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
      document.removeEventListener('scroll', this.scrollListener, true);
    }

    this.scrollListener = () => {
      // 使用 requestAnimationFrame 进行节流
      if (this.updateTimeout) {
        cancelAnimationFrame(this.updateTimeout);
      }
      this.updateTimeout = requestAnimationFrame(() => {
        this.updateMarkerPositions();
        this.updateTimeout = null;
      });
    };

    // 监听窗口滚动
    window.addEventListener('scroll', this.scrollListener, { passive: true });
    // 监听所有滚动事件（捕获阶段）
    document.addEventListener('scroll', this.scrollListener, { passive: true, capture: true });
  }

  /**
   * 更新标记位置
   */
  private updateMarkerPositions(): void {
    this.elementInfos.forEach(({ elementInfo, overlay }) => {
      const bounds = elementInfo.element.getBoundingClientRect();

      // 检查元素是否仍然可见
      if (bounds.width === 0 && bounds.height === 0) {
        overlay.style.display = 'none';
        return;
      }

      // 显示并更新覆盖层位置
      overlay.style.display = 'block';
      overlay.style.top = `${bounds.top}px`;
      overlay.style.left = `${bounds.left}px`;
      overlay.style.width = `${bounds.width}px`;
      overlay.style.height = `${bounds.height}px`;
    });
  }

  /**
   * 清除所有标记
   */
  clearMarkers(): void {
    // 移除滚动监听器
    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener);
      document.removeEventListener('scroll', this.scrollListener, true);
      this.scrollListener = null;
    }

    // 取消未完成的动画帧
    if (this.updateTimeout) {
      cancelAnimationFrame(this.updateTimeout);
      this.updateTimeout = null;
    }

    this.markedElements.forEach(element => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    this.markedElements = [];
    this.elementInfos = [];
  }

  /**
   * 获取标记统计
   */
  getMarkingStats(): Record<ElementType, number> {
    const stats: Record<ElementType, number> = {
      input: 0,
      button: 0,
      link: 0,
      form: 0,
      navigation: 0,
      container: 0,
      text: 0,
      image: 0,
      media: 0,
    };

    const elements = this.detectElements();
    elements.forEach(el => {
      stats[el.type]++;
    });

    return stats;
  }
}
