import { MarkdownConverter } from './markdown-converter.js';

export interface ElementSelectionResult {
  html: string;
  markdown: string;
  slug: string;
  element: Element;
  domPath: string;
}

export interface SitePreset {
  patterns: string[];
  selectors: string[];
  priority?: number;
}

export interface ElementSelectorOptions {
  enableNavigation?: boolean;
  showStatusMessages?: boolean;
  highlightColor?: string;
  highlightOpacity?: number;
  sitePresets?: SitePreset[];
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
  private defaultPresets: SitePreset[] = [
    {
      patterns: ['https://mp.weixin.qq.com/s/', 'mp.weixin.qq.com/s/'],
      selectors: ['#img-content'],
      priority: 10,
    },
    {
      patterns: ['zhihu.com/question', 'zhihu.com/p/'],
      selectors: ['.Post-RichTextContainer', '.QuestionAnswer-content', '.RichContent-inner'],
      priority: 10,
    },
    {
      patterns: ['juejin.cn/post', 'juejin.im/post'],
      selectors: ['.article-content', '.markdown-body'],
      priority: 10,
    },
    {
      patterns: ['medium.com'],
      selectors: ['article', '.meteredContent', 'main article'],
      priority: 10,
    },
    {
      patterns: ['dev.to'],
      selectors: ['#article-body', '.crayons-article__body'],
      priority: 10,
    },
    {
      patterns: ['stackoverflow.com/questions'],
      selectors: ['.answercell', '.question', '.post-text'],
      priority: 10,
    },
    {
      patterns: ['github.com'],
      selectors: ['.markdown-body', '#readme', '.comment-body'],
      priority: 10,
    },
    {
      patterns: ['wikipedia.org/wiki'],
      selectors: ['#mw-content-text', '.mw-parser-output'],
      priority: 10,
    },
  ];

  constructor(options: ElementSelectorOptions = {}) {
    // 合并预设，用户预设优先级更高
    const mergedPresets = [...this.defaultPresets, ...(options.sitePresets || [])];

    this.options = {
      enableNavigation: true,
      showStatusMessages: true,
      highlightColor: '#3b82f6',
      highlightOpacity: 0.1,
      ...options,
      sitePresets: mergedPresets,
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
    const domPath = this.generateDOMPath(element);

    return {
      html,
      markdown,
      slug,
      element,
      domPath,
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

  private generateDOMPath(element: Element): string {
    const path: string[] = [];
    let current = element;

    while (current && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();

      // 添加ID
      if (current.id) {
        selector += `#${current.id}`;
      }

      // 添加主要的类名（最多3个）
      if (current.className && typeof current.className === 'string') {
        const classes = current.className
          .split(' ')
          .filter(cls => cls.trim())
          .slice(0, 3);
        if (classes.length > 0) {
          selector += `.${classes.join('.')}`;
        }
      }

      // 如果有兄弟元素，添加nth-child
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children).filter(
          sibling => sibling.tagName === current.tagName,
        );

        if (siblings.length > 1) {
          const index = siblings.indexOf(current as Element) + 1;
          selector += `:nth-child(${index})`;
        }
      }

      path.unshift(selector);
      current = current.parentElement as Element;
    }

    return path.join(' > ');
  }

  private showStatusMessage(message: string): void {
    // 先清除现有的状态消息
    this.hideStatusMessage();

    const statusDiv = document.createElement('div');
    statusDiv.id = 'lovpensider-status';
    statusDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #141413;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      font-family: 'Fira Code', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 300px;
    `;
    statusDiv.textContent = message;
    document.body.appendChild(statusDiv);
  }

  private hideStatusMessage(): void {
    const statusDivs = document.querySelectorAll('#lovpensider-status');
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

  // 智能选择功能
  smartSelect(): void {
    console.log('[ElementSelector] 开始智能选择');
    const mainContent = this.findMainContentElement();

    if (mainContent) {
      console.log('[ElementSelector] 智能选择成功，选中元素:', mainContent);
      this.selectedElement = mainContent;

      if (this.options.enableNavigation) {
        this.enterNavigationMode();
      } else {
        this.highlightSelectedElement();
        this.onElementSelected(mainContent);
      }
    } else {
      console.log('[ElementSelector] 智能选择失败，未找到合适的内容元素');
    }
  }

  private findMainContentElement(): Element | null {
    // 首先尝试使用网站预设
    const presetElement = this.findElementByPresets();
    if (presetElement) {
      return presetElement;
    }

    // 如果没有预设匹配，使用智能内容检测算法
    const candidates = this.getContentCandidates();
    return this.rankContentCandidates(candidates);
  }

  private findElementByPresets(): Element | null {
    console.log('[ElementSelector] 开始查找预设元素');

    if (!this.options.sitePresets || this.options.sitePresets.length === 0) {
      console.log('[ElementSelector] 没有配置预设');
      return null;
    }

    const currentUrl = window.location.href;
    console.log('[ElementSelector] 当前URL:', currentUrl);
    console.log('[ElementSelector] 可用预设数量:', this.options.sitePresets.length);

    // 按优先级排序预设
    const sortedPresets = [...this.options.sitePresets].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    for (const preset of sortedPresets) {
      // 检查URL是否匹配任何模式
      const matchedPattern = preset.patterns.find(pattern => currentUrl.includes(pattern));
      const isMatch = !!matchedPattern;

      if (isMatch) {
        console.log(`[ElementSelector] URL匹配预设模式: ${matchedPattern}`);
        console.log(`[ElementSelector] 尝试选择器列表:`, preset.selectors);

        // 尝试每个选择器
        for (const selector of preset.selectors) {
          const element = document.querySelector(selector);

          if (element) {
            console.log(`[ElementSelector] 找到元素: ${selector}`);
            const isValid = this.isValidContentElement(element);
            console.log(`[ElementSelector] 元素验证结果: ${isValid}`);

            if (!isValid) {
              const rect = element.getBoundingClientRect();
              const textContent = element.textContent?.trim() || '';
              const style = window.getComputedStyle(element);
              console.log(`[ElementSelector] 元素验证失败原因:`, {
                width: rect.width,
                height: rect.height,
                textLength: textContent.length,
                display: style.display,
                visibility: style.visibility,
              });
            }

            if (isValid) {
              console.log(`[ElementSelector] ✅ 使用预设选择器: ${selector} (匹配模式: ${preset.patterns.join(', ')})`);
              return element;
            }
          } else {
            console.log(`[ElementSelector] 未找到元素: ${selector}`);
          }
        }
      }
    }

    console.log('[ElementSelector] 没有找到匹配的预设元素，将使用智能检测');
    return null;
  }

  private getContentCandidates(): Element[] {
    const candidates: Element[] = [];

    // 1. 语义化HTML5标签
    const semanticSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.main',
      '.content',
      '.article',
      '.post',
      '#main',
      '#content',
      '#article',
      '#post',
    ];

    semanticSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => candidates.push(el));
    });

    // 2. 常见的内容容器类名
    const contentClassNames = [
      'content',
      'main',
      'article',
      'post',
      'body',
      'text',
      'story',
      'entry',
      'container',
      'wrapper',
    ];

    contentClassNames.forEach(className => {
      const elements = document.querySelectorAll(`[class*="${className}"]`);
      elements.forEach(el => {
        if (this.isValidContentElement(el)) {
          candidates.push(el);
        }
      });
    });

    // 3. 基于文本密度的候选元素
    const textDenseCandidates = this.findTextDenseElements();
    candidates.push(...textDenseCandidates);

    // 去重
    return Array.from(new Set(candidates));
  }

  private rankContentCandidates(candidates: Element[]): Element | null {
    if (candidates.length === 0) return null;

    const scored = candidates.map(element => ({
      element,
      score: this.calculateContentScore(element),
    }));

    // 按分数排序
    scored.sort((a, b) => b.score - a.score);

    const bestCandidate = scored[0].element;

    // 尝试在最佳候选元素内部找到更精确的内容区域
    const refinedCandidate = this.refineCandidateSelection(bestCandidate);

    return refinedCandidate || bestCandidate;
  }

  private refineCandidateSelection(element: Element): Element | null {
    // 在候选元素内部寻找更精确的内容区域
    const contentSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.text',
      '.body',
      '.story',
      '.description',
    ];

    // 首先尝试语义化标签和常见内容类名
    for (const selector of contentSelectors) {
      const child = element.querySelector(selector);
      if (child && this.isValidContentElement(child)) {
        // 递归细化，但限制深度避免过度细化
        const furtherRefined = this.refineCandidateSelection(child);
        return furtherRefined || child;
      }
    }

    // 如果没有找到明确的内容元素，查找文本密度最高的子元素
    const children = Array.from(element.children);
    if (children.length === 0) return null;

    const scoredChildren = children
      .filter(child => this.isValidContentElement(child))
      .map(child => ({
        element: child,
        score: this.calculateContentScore(child),
      }))
      .sort((a, b) => b.score - a.score);

    if (scoredChildren.length === 0) return null;

    const bestChild = scoredChildren[0];

    // 只有当子元素的得分显著高于父元素时才选择子元素
    const parentScore = this.calculateContentScore(element);
    if (bestChild.score > parentScore * 1.2) {
      // 递归细化，但限制深度
      const furtherRefined = this.refineCandidateSelection(bestChild.element);
      return furtherRefined || bestChild.element;
    }

    return null;
  }

  private calculateContentScore(element: Element): number {
    let score = 0;

    // 1. 语义化标签加分
    const tagName = element.tagName.toLowerCase();
    const semanticTags: { [key: string]: number } = { main: 50, article: 45, section: 20, div: 0 };
    score += semanticTags[tagName] || 0;

    // 2. 类名和ID加分
    const className = element.className?.toLowerCase() || '';
    const id = element.id?.toLowerCase() || '';
    const goodNames = ['main', 'content', 'article', 'post', 'body', 'text', 'story', 'entry'];

    goodNames.forEach(name => {
      if (className.includes(name)) score += 30;
      if (id.includes(name)) score += 35;
    });

    // 3. 文本密度评分
    const textDensity = this.calculateTextDensity(element);
    score += textDensity * 10;

    // 4. 位置评分（中心区域加分）
    const positionScore = this.calculatePositionScore(element);
    score += positionScore;

    // 5. 尺寸评分
    const sizeScore = this.calculateSizeScore(element);
    score += sizeScore;

    // 6. 结构评分
    const structureScore = this.calculateStructureScore(element);
    score += structureScore;

    // 7. 排除不合适的元素
    if (this.isUnwantedElement(element)) {
      score -= 100;
    }

    return score;
  }

  private calculateTextDensity(element: Element): number {
    const textContent = element.textContent?.trim() || '';
    const htmlContent = element.innerHTML || '';

    if (textContent.length === 0) return 0;

    // 计算文本与HTML的比例
    const textRatio = textContent.length / htmlContent.length;

    // 段落数量
    const paragraphCount = element.querySelectorAll('p').length;

    // 文本长度评分
    const textLength = Math.min(textContent.length / 1000, 10);

    return textRatio * 5 + paragraphCount * 2 + textLength;
  }

  private calculatePositionScore(element: Element): number {
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 中心区域加分
    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;
    const elementCenterX = rect.left + rect.width / 2;
    const elementCenterY = rect.top + rect.height / 2;

    const distanceFromCenter = Math.sqrt(Math.pow(elementCenterX - centerX, 2) + Math.pow(elementCenterY - centerY, 2));

    const maxDistance = Math.sqrt(Math.pow(centerX, 2) + Math.pow(centerY, 2));
    const centerScore = (1 - distanceFromCenter / maxDistance) * 20;

    return centerScore;
  }

  private calculateSizeScore(element: Element): number {
    const rect = element.getBoundingClientRect();
    const viewportArea = window.innerWidth * window.innerHeight;
    const elementArea = rect.width * rect.height;

    // 元素占视口的比例
    const areaRatio = elementArea / viewportArea;

    // 最佳比例在 0.3 - 0.7 之间
    if (areaRatio >= 0.3 && areaRatio <= 0.7) {
      return 20;
    } else if (areaRatio >= 0.1 && areaRatio <= 0.9) {
      return 10;
    } else {
      return 0;
    }
  }

  private calculateStructureScore(element: Element): number {
    let score = 0;

    // 包含标题元素
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
    score += Math.min(headings.length * 5, 25);

    // 包含段落
    const paragraphs = element.querySelectorAll('p');
    score += Math.min(paragraphs.length * 2, 20);

    // 包含列表
    const lists = element.querySelectorAll('ul, ol');
    score += Math.min(lists.length * 3, 15);

    // 包含图片
    const images = element.querySelectorAll('img');
    score += Math.min(images.length * 2, 10);

    return score;
  }

  private isUnwantedElement(element: Element): boolean {
    const className = element.className?.toLowerCase() || '';
    const id = element.id?.toLowerCase() || '';

    const unwantedKeywords = [
      'nav',
      'navigation',
      'menu',
      'header',
      'footer',
      'sidebar',
      'aside',
      'ad',
      'advertisement',
      'banner',
      'promo',
      'popup',
      'modal',
      'comment',
      'reply',
      'share',
      'social',
      'related',
      'recommend',
    ];

    return unwantedKeywords.some(keyword => className.includes(keyword) || id.includes(keyword));
  }

  private findTextDenseElements(): Element[] {
    const candidates: Element[] = [];
    const allElements = document.querySelectorAll('div, section, article, main');

    allElements.forEach(element => {
      const textDensity = this.calculateTextDensity(element);
      if (textDensity > 5) {
        candidates.push(element);
      }
    });

    return candidates;
  }

  private isValidContentElement(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const textContent = element.textContent?.trim() || '';

    // 基本检查
    if (rect.width < 100 || rect.height < 100) return false;
    if (textContent.length < 50) return false;

    // 检查是否可见
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;

    return true;
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

  // 设置选中的元素（用于外部调用）
  setSelectedElement(element: Element): void {
    this.selectedElement = element;
  }

  // 高亮选中的元素（用于外部调用）
  public highlightSelectedElement(): void {
    this.removeHighlight();
    if (this.selectedElement) {
      this.highlightElement(this.selectedElement);
    }
  }

  // 触发元素选中事件（用于外部调用）
  public triggerElementSelected(element: Element): void {
    this.onElementSelected(element);
  }
}
