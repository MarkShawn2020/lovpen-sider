import { MarkdownConverter } from './markdown-converter.js';

export interface ElementSelectionResult {
  html: string;
  markdown: string;
  slug: string;
  element: Element;
}

export interface ElementSelectorOptions {
  enableNavigation?: boolean;
  showStatusMessages?: boolean;
  highlightColor?: string;
  highlightOpacity?: number;
}

export class ElementSelector {
  private isSelecting = false;
  private selectedElement: Element | null = null;
  private isNavigatingMode = false;
  private markdownUpdateTimer: NodeJS.Timeout | null = null;
  private originalStyles = new Map<Element, { outline: string; backgroundColor: string }>();

  private mouseOverHandler?: (e: MouseEvent) => void;
  private mouseOutHandler?: (e: MouseEvent) => void;
  private clickHandler?: (e: MouseEvent) => void;
  private keyDownHandler?: (e: KeyboardEvent) => void;
  private navigationKeyDownHandler?: (e: KeyboardEvent) => void;

  private markdownConverter: MarkdownConverter;
  private options: ElementSelectorOptions;

  constructor(options: ElementSelectorOptions = {}) {
    this.options = {
      enableNavigation: true,
      showStatusMessages: true,
      highlightColor: '#3b82f6',
      highlightOpacity: 0.1,
      ...options,
    };

    this.markdownConverter = new MarkdownConverter();
  }

  startSelection(): void {
    if (this.isSelecting) return;

    this.isSelecting = true;
    document.body.style.cursor = 'crosshair';

    // 存储事件处理器的引用
    this.mouseOverHandler = this.handleMouseOver.bind(this);
    this.mouseOutHandler = this.handleMouseOut.bind(this);
    this.clickHandler = this.handleClick.bind(this);
    this.keyDownHandler = this.handleKeyDown.bind(this);

    document.addEventListener('mouseover', this.mouseOverHandler);
    document.addEventListener('mouseout', this.mouseOutHandler);
    document.addEventListener('click', this.clickHandler);
    document.addEventListener('keydown', this.keyDownHandler);

    if (this.options.showStatusMessages) {
      this.showStatusMessage('鼠标悬停选择元素，点击确认，按ESC取消');
    }
  }

  stopSelection(): void {
    if (!this.isSelecting && !this.isNavigatingMode) return;

    this.isSelecting = false;
    this.isNavigatingMode = false;
    document.body.style.cursor = '';

    // 移除事件监听器
    if (this.mouseOverHandler) {
      document.removeEventListener('mouseover', this.mouseOverHandler);
    }
    if (this.mouseOutHandler) {
      document.removeEventListener('mouseout', this.mouseOutHandler);
    }
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
    }
    if (this.keyDownHandler) {
      document.removeEventListener('keydown', this.keyDownHandler);
    }
    if (this.navigationKeyDownHandler) {
      document.removeEventListener('keydown', this.navigationKeyDownHandler);
    }

    this.removeHighlight();
    this.hideStatusMessage();

    if (this.markdownUpdateTimer) {
      clearTimeout(this.markdownUpdateTimer);
      this.markdownUpdateTimer = null;
    }
  }

  exitNavigationMode(): void {
    this.isNavigatingMode = false;
    if (this.navigationKeyDownHandler) {
      document.removeEventListener('keydown', this.navigationKeyDownHandler);
      this.navigationKeyDownHandler = undefined;
    }
    this.removeHighlight();
    this.hideStatusMessage();

    if (this.markdownUpdateTimer) {
      clearTimeout(this.markdownUpdateTimer);
      this.markdownUpdateTimer = null;
    }
  }

  private handleMouseOver(e: MouseEvent): void {
    if (!this.isSelecting) return;

    e.preventDefault();
    e.stopPropagation();

    this.removeHighlight();
    this.highlightElement(e.target as Element);
  }

  private handleMouseOut(e: MouseEvent): void {
    if (!this.isSelecting) return;

    e.preventDefault();
    e.stopPropagation();
  }

  private handleClick(e: MouseEvent): void {
    if (!this.isSelecting) return;

    e.preventDefault();
    e.stopPropagation();

    this.selectedElement = e.target as Element;

    if (this.options.enableNavigation) {
      this.enterNavigationMode();
    } else {
      this.stopSelection();
      this.onElementSelected(this.selectedElement);
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (!this.isSelecting) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.stopSelection();
      this.onSelectionCancelled();
    }
  }

  private enterNavigationMode(): void {
    this.isNavigatingMode = true;
    this.isSelecting = false;

    // 移除悬停监听，添加导航监听
    if (this.mouseOverHandler) {
      document.removeEventListener('mouseover', this.mouseOverHandler);
    }
    if (this.mouseOutHandler) {
      document.removeEventListener('mouseout', this.mouseOutHandler);
    }
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
    }
    if (this.keyDownHandler) {
      document.removeEventListener('keydown', this.keyDownHandler);
    }

    this.navigationKeyDownHandler = this.handleNavigationKeyDown.bind(this);
    document.addEventListener('keydown', this.navigationKeyDownHandler);

    // 保持高亮并发送初始数据
    this.highlightSelectedElement();
    this.sendElementDataWithDebounce();

    if (this.options.showStatusMessages) {
      this.showStatusMessage('使用方向键导航元素，回车/ESC退出');
    }
  }

  private handleNavigationKeyDown(e: KeyboardEvent): void {
    if (!this.isNavigatingMode || !this.selectedElement) return;

    e.preventDefault();
    e.stopPropagation();

    let newElement: Element | null = null;

    switch (e.key) {
      case 'ArrowUp':
        newElement = this.selectedElement.parentElement;
        break;
      case 'ArrowDown':
        newElement = this.selectedElement.firstElementChild;
        break;
      case 'ArrowLeft':
        newElement = this.selectedElement.previousElementSibling;
        break;
      case 'ArrowRight':
        newElement = this.selectedElement.nextElementSibling;
        break;
      case 'Escape':
        this.stopSelection();
        this.onSelectionCancelled();
        return;
      case 'Enter':
        this.exitNavigationMode();
        this.onElementSelected(this.selectedElement);
        return;
    }

    if (newElement && newElement !== document.body && newElement !== document.documentElement) {
      this.selectedElement = newElement;
      this.highlightSelectedElement();
      this.sendElementDataWithDebounce();
    }
  }

  private highlightElement(element: Element): void {
    if (!element || element === document.body || element === document.documentElement) return;

    const computedStyle = window.getComputedStyle(element);
    this.originalStyles.set(element, {
      outline: computedStyle.outline,
      backgroundColor: computedStyle.backgroundColor,
    });

    const el = element as HTMLElement;
    el.style.outline = `2px solid ${this.options.highlightColor}`;
    el.style.backgroundColor = `rgba(59, 130, 246, ${this.options.highlightOpacity})`;
  }

  private highlightSelectedElement(): void {
    this.removeHighlight();
    if (this.selectedElement) {
      this.highlightElement(this.selectedElement);
    }
  }

  private removeHighlight(): void {
    this.originalStyles.forEach((styles, element) => {
      const el = element as HTMLElement;
      el.style.outline = styles.outline;
      el.style.backgroundColor = styles.backgroundColor;
    });
    this.originalStyles.clear();
  }

  private sendElementDataWithDebounce(): void {
    if (this.markdownUpdateTimer) {
      clearTimeout(this.markdownUpdateTimer);
    }

    this.markdownUpdateTimer = setTimeout(() => {
      if (this.selectedElement) {
        this.onElementDataUpdate(this.selectedElement);
      }
    }, 100);
  }

  private generateElementData(element: Element): ElementSelectionResult {
    const html = this.markdownConverter.getCleanHTML(element);
    const markdown = this.markdownConverter.convertToMarkdown(html, element);
    const slug = this.extractSlugFromMarkdown(markdown);

    return {
      html,
      markdown,
      slug,
      element,
    };
  }

  private extractSlugFromMarkdown(markdown: string): string {
    // 从markdown的frontmatter中提取slug
    const frontmatterMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---/);

    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const slugMatch = frontmatter.match(/slug:\s*(.+)/);

      if (slugMatch) {
        return slugMatch[1].trim();
      }
    }

    // 如果没有找到slug，生成一个默认的
    return `content-${Date.now()}`;
  }

  private showStatusMessage(message: string): void {
    // 先清除现有的状态消息
    this.hideStatusMessage();

    const statusDiv = document.createElement('div');
    statusDiv.id = 'supersider-status';
    statusDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1e293b;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 300px;
    `;
    statusDiv.textContent = message;
    document.body.appendChild(statusDiv);
  }

  private hideStatusMessage(): void {
    const statusDivs = document.querySelectorAll('#supersider-status');
    statusDivs.forEach(div => div.remove());
  }

  // 事件回调，子类可以重写
  protected onElementSelected(element: Element): void {
    const data = this.generateElementData(element);
    console.log('Element selected:', data);
  }

  protected onElementDataUpdate(element: Element): void {
    const data = this.generateElementData(element);
    console.log('Element data updated:', data);
  }

  protected onSelectionCancelled(): void {
    console.log('Selection cancelled');
  }

  // 公共方法
  getSelectedElement(): Element | null {
    return this.selectedElement;
  }

  getSelectedElementData(): ElementSelectionResult | null {
    if (!this.selectedElement) return null;
    return this.generateElementData(this.selectedElement);
  }

  isCurrentlySelecting(): boolean {
    return this.isSelecting;
  }

  isInNavigationMode(): boolean {
    return this.isNavigatingMode;
  }
}
