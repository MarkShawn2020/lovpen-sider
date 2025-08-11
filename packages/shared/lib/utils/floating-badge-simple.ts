/**
 * 悬浮徽章 - 极简版本（支持垂直拖拽）
 * 直接按住徽章即可拖动，智能区分点击和拖拽操作
 */

export class FloatingBadgeSimple {
  private container: HTMLDivElement | null = null;
  private button: HTMLButtonElement | null = null;
  private isOpen = false;

  // 拖拽状态
  private isDragging = false;
  private dragStartY = 0;
  private elementStartY = 0;
  private currentY = 100; // 默认初始位置
  private mouseDownTime = 0;
  private hasMoved = false;

  // 配置
  private readonly STORAGE_KEY = 'lovpen-badge-position';
  private readonly MIN_Y = 10;
  private readonly DRAG_THRESHOLD = 5; // 移动5px以上才认为是拖拽
  private readonly CLICK_TIME_THRESHOLD = 200; // 200ms内完成的是点击

  public init(): void {
    // 移除任何已存在的徽章
    const existing = document.getElementById('lovpen-simple-badge');
    if (existing) existing.remove();

    // 加载保存的位置
    this.loadPosition();

    // 创建容器
    this.container = document.createElement('div');
    this.container.id = 'lovpen-simple-badge';
    this.container.style.cssText = `
      position: fixed;
      right: 20px;
      top: ${this.currentY}px;
      width: 48px;
      height: 48px;
      z-index: 2147483647;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    `;

    // 创建按钮
    this.button = document.createElement('button');
    this.button.style.cssText = `
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 0;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
      transform-origin: center center;
      position: relative;
      outline: none;
      -webkit-tap-highlight-color: transparent;
    `;

    // 设置内容
    this.button.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style="pointer-events: none;">
        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
      </svg>
    `;

    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      #lovpen-simple-badge {
        transition: top 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      #lovpen-simple-badge.dragging {
        transition: none !important;
      }
      #lovpen-simple-badge button:hover:not(.dragging) {
        transform: scale(1.1);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      }
      #lovpen-simple-badge button:active:not(.dragging) {
        transform: scale(0.95);
      }
      #lovpen-simple-badge button.dragging {
        opacity: 0.8;
        transform: scale(0.95);
        cursor: ns-resize !important;
        box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
      }
      
      /* 拖拽时的提示动画 */
      @keyframes dragHint {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-2px); }
      }
      
      #lovpen-simple-badge.drag-ready button {
        animation: dragHint 1.5s ease-in-out infinite;
      }
      
      /* 长按提示效果 */
      #lovpen-simple-badge button::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: translate(-50%, -50%);
        transition: width 0.3s ease, height 0.3s ease;
        pointer-events: none;
      }
      
      #lovpen-simple-badge button.pressing::after {
        width: 60px;
        height: 60px;
      }
    `;
    document.head.appendChild(style);

    // 组装元素
    this.container.appendChild(this.button);

    // 设置事件处理
    this.setupEventHandlers();

    // 添加到页面
    document.body.appendChild(this.container);
  }

  private setupEventHandlers(): void {
    if (!this.button || !this.container) return;

    let startX = 0;
    let startY = 0;

    // 鼠标事件处理
    const handleMouseDown = (e: MouseEvent) => {
      // 只响应左键
      if (e.button !== 0) return;

      e.preventDefault();

      // 记录起始状态
      this.mouseDownTime = Date.now();
      this.hasMoved = false;
      this.isDragging = false;
      startX = e.clientX;
      startY = e.clientY;
      this.dragStartY = e.clientY;
      this.elementStartY = this.container!.offsetTop;

      // 添加按压效果
      this.button!.classList.add('pressing');

      // 添加文档级事件监听
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      // 防止文本选择
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';

      // 设置长按提示（如果300ms后还没移动，显示可拖拽提示）
      setTimeout(() => {
        if (!this.hasMoved && this.button?.classList.contains('pressing')) {
          this.container?.classList.add('drag-ready');
        }
      }, 300);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = Math.abs(e.clientX - startX);
      const deltaY = Math.abs(e.clientY - startY);
      const totalDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // 检查是否超过拖拽阈值
      if (totalDelta > this.DRAG_THRESHOLD) {
        this.hasMoved = true;

        // 第一次触发拖拽
        if (!this.isDragging) {
          this.isDragging = true;
          this.container!.classList.add('dragging');
          this.container!.classList.remove('drag-ready');
          this.button!.classList.add('dragging');
          this.button!.classList.remove('pressing');
        }

        // 执行拖拽（只允许垂直移动）
        const deltaY = e.clientY - this.dragStartY;
        let newY = this.elementStartY + deltaY;

        // 限制在视窗内
        const maxY = window.innerHeight - this.container!.offsetHeight - 10;
        newY = Math.max(this.MIN_Y, Math.min(newY, maxY));

        this.container!.style.top = `${newY}px`;
        this.currentY = newY;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const timeDiff = Date.now() - this.mouseDownTime;

      // 移除类
      this.container!.classList.remove('dragging', 'drag-ready');
      this.button!.classList.remove('dragging', 'pressing');

      // 移除事件监听
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // 恢复文本选择
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';

      // 判断是点击还是拖拽
      if (!this.isDragging && timeDiff < 500) {
        // 是点击操作，切换侧边栏
        this.toggleSidebar();
      } else if (this.isDragging) {
        // 拖拽结束，保存位置并执行吸附
        this.savePosition();
        this.snapToEdge();
      }

      // 重置状态
      this.isDragging = false;
      this.hasMoved = false;
    };

    // 触摸事件处理（移动端支持）
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];

      this.mouseDownTime = Date.now();
      this.hasMoved = false;
      this.isDragging = false;
      startX = touch.clientX;
      startY = touch.clientY;
      this.dragStartY = touch.clientY;
      this.elementStartY = this.container!.offsetTop;

      this.button!.classList.add('pressing');

      const handleTouchMove = (e: TouchEvent) => {
        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - startX);
        const deltaY = Math.abs(touch.clientY - startY);
        const totalDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (totalDelta > this.DRAG_THRESHOLD) {
          e.preventDefault(); // 只在确认拖拽后阻止默认行为
          this.hasMoved = true;

          if (!this.isDragging) {
            this.isDragging = true;
            this.container!.classList.add('dragging');
            this.button!.classList.add('dragging');
            this.button!.classList.remove('pressing');
          }

          const dragDeltaY = touch.clientY - this.dragStartY;
          let newY = this.elementStartY + dragDeltaY;
          const maxY = window.innerHeight - this.container!.offsetHeight - 10;
          newY = Math.max(this.MIN_Y, Math.min(newY, maxY));

          this.container!.style.top = `${newY}px`;
          this.currentY = newY;
        }
      };

      const handleTouchEnd = () => {
        const timeDiff = Date.now() - this.mouseDownTime;

        this.container!.classList.remove('dragging');
        this.button!.classList.remove('dragging', 'pressing');

        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);

        if (!this.isDragging && timeDiff < 500) {
          this.toggleSidebar();
        } else if (this.isDragging) {
          this.savePosition();
          this.snapToEdge();
        }

        this.isDragging = false;
        this.hasMoved = false;
      };

      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);

      // 长按提示
      setTimeout(() => {
        if (!this.hasMoved && this.button?.classList.contains('pressing')) {
          this.container?.classList.add('drag-ready');
        }
      }, 300);
    };

    // 绑定事件
    this.button.addEventListener('mousedown', handleMouseDown);
    this.button.addEventListener('touchstart', handleTouchStart, { passive: true });

    // 阻止右键菜单
    this.button.addEventListener('contextmenu', e => {
      e.preventDefault();
    });
  }

  private toggleSidebar(): void {
    this.isOpen = !this.isOpen;
    if (this.button) {
      this.button.style.background = this.isOpen
        ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }

    chrome.runtime.sendMessage({
      action: this.isOpen ? 'openSidePanel' : 'closeSidePanel',
    });
  }

  private snapToEdge(): void {
    if (!this.container) return;

    const topDistance = this.currentY;
    const bottomDistance = window.innerHeight - this.currentY - this.container.offsetHeight;
    const snapThreshold = 50;

    if (topDistance < snapThreshold) {
      // 吸附到顶部
      this.currentY = this.MIN_Y;
      this.container.style.top = `${this.MIN_Y}px`;
      this.savePosition();
    } else if (bottomDistance < snapThreshold) {
      // 吸附到底部
      const newY = window.innerHeight - this.container.offsetHeight - 10;
      this.currentY = newY;
      this.container.style.top = `${newY}px`;
      this.savePosition();
    }
  }

  private savePosition(): void {
    try {
      const hostname = window.location.hostname;
      const key = `${this.STORAGE_KEY}-${hostname}`;
      localStorage.setItem(key, JSON.stringify({ y: this.currentY }));
    } catch (error) {
      console.error('Failed to save badge position:', error);
    }
  }

  private loadPosition(): void {
    try {
      const hostname = window.location.hostname;
      const key = `${this.STORAGE_KEY}-${hostname}`;
      const saved = localStorage.getItem(key);

      if (saved) {
        const data = JSON.parse(saved);
        if (typeof data.y === 'number') {
          // 确保位置在当前视窗内
          const maxY = window.innerHeight - 48 - 10; // 48是徽章高度
          this.currentY = Math.max(this.MIN_Y, Math.min(data.y, maxY));
        }
      }
    } catch (error) {
      console.error('Failed to load badge position:', error);
    }
  }

  public updateSidebarState(isOpen: boolean): void {
    this.isOpen = isOpen;
    if (this.button) {
      this.button.style.background = isOpen
        ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    }
  }

  public show(): void {
    if (this.container) {
      this.container.style.display = 'block';
    }
  }

  public hide(): void {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  public toggle(): void {
    if (this.container) {
      const isHidden = this.container.style.display === 'none';
      this.container.style.display = isHidden ? 'block' : 'none';
    }
  }

  public destroy(): void {
    if (this.container) {
      this.container.remove();
    }
    this.container = null;
    this.button = null;
  }
}
