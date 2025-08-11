/**
 * 边缘吸附浮动元素管理器
 * 支持拖动和自动吸附到浏览器视窗边缘
 */

export interface EdgeSnappingConfig {
  snapDistance: number; // 吸附距离阈值（像素）
  animationDuration: number; // 吸附动画时长（毫秒）
  edgeOffset: number; // 边缘偏移量（像素）
  enableSnapping: boolean; // 是否启用边缘吸附
  enableDragging: boolean; // 是否启用拖动
  constrainToViewport: boolean; // 是否限制在视窗内
  snapToEdges: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
}

export interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  elementStartX: number;
  elementStartY: number;
  currentX: number;
  currentY: number;
}

export interface SnapEdge {
  edge: 'top' | 'right' | 'bottom' | 'left';
  distance: number;
  position: { x: number; y: number };
}

export class EdgeSnappingManager {
  private element: HTMLElement;
  private config: EdgeSnappingConfig;
  private dragState: DragState;
  private isSnapped: boolean = false;
  private currentSnapEdge: SnapEdge['edge'] | null = null;
  private dragHandle: HTMLElement | null = null;
  private onDragStartCallbacks: Array<() => void> = [];
  private onDragEndCallbacks: Array<(snapped: boolean, edge: SnapEdge['edge'] | null) => void> = [];
  private onSnapCallbacks: Array<(edge: SnapEdge['edge']) => void> = [];

  constructor(element: HTMLElement, config?: Partial<EdgeSnappingConfig>) {
    this.element = element;
    this.config = {
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
      ...config,
    };

    this.dragState = {
      isDragging: false,
      startX: 0,
      startY: 0,
      elementStartX: 0,
      elementStartY: 0,
      currentX: 0,
      currentY: 0,
    };

    this.initialize();
  }

  private initialize(): void {
    // 确保元素是绝对或固定定位
    const computedStyle = window.getComputedStyle(this.element);
    if (computedStyle.position !== 'fixed' && computedStyle.position !== 'absolute') {
      this.element.style.position = 'fixed';
    }

    // 设置初始样式
    this.element.style.transition = `all ${this.config.animationDuration}ms ease-out`;
    this.element.style.cursor = this.config.enableDragging ? 'move' : 'default';
    this.element.style.zIndex = '10001'; // 确保在其他元素之上

    if (this.config.enableDragging) {
      this.setupDragging();
    }
  }

  /**
   * 设置拖动手柄（可选）
   */
  public setDragHandle(handle: HTMLElement): void {
    this.dragHandle = handle;
    if (this.config.enableDragging) {
      this.setupDragging();
    }
  }

  /**
   * 设置拖动功能
   */
  private setupDragging(): void {
    const dragTarget = this.dragHandle || this.element;

    // 移除可能存在的旧监听器
    dragTarget.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);

    // 添加新监听器
    dragTarget.addEventListener('mousedown', this.handleMouseDown);

    // 添加触摸事件支持
    dragTarget.addEventListener('touchstart', this.handleTouchStart, { passive: false });
  }

  /**
   * 鼠标按下事件处理
   */
  private handleMouseDown = (e: MouseEvent): void => {
    if (!this.config.enableDragging) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = this.element.getBoundingClientRect();

    this.dragState = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      elementStartX: rect.left,
      elementStartY: rect.top,
      currentX: rect.left,
      currentY: rect.top,
    };

    // 移除过渡效果以实现平滑拖动
    this.element.style.transition = 'none';

    // 添加文档级别的事件监听器
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);

    // 防止文本选择
    document.body.style.userSelect = 'none';

    // 触发拖动开始回调
    this.onDragStartCallbacks.forEach(callback => callback());
  };

  /**
   * 鼠标移动事件处理
   */
  private handleMouseMove = (e: MouseEvent): void => {
    if (!this.dragState.isDragging) return;

    const deltaX = e.clientX - this.dragState.startX;
    const deltaY = e.clientY - this.dragState.startY;

    let newX = this.dragState.elementStartX + deltaX;
    let newY = this.dragState.elementStartY + deltaY;

    // 限制在视窗内
    if (this.config.constrainToViewport) {
      const rect = this.element.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;

      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
    }

    this.dragState.currentX = newX;
    this.dragState.currentY = newY;

    this.element.style.left = `${newX}px`;
    this.element.style.top = `${newY}px`;

    // 检查是否接近边缘
    if (this.config.enableSnapping) {
      this.checkEdgeProximity();
    }
  };

  /**
   * 鼠标释放事件处理
   */
  private handleMouseUp = (): void => {
    if (!this.dragState.isDragging) return;

    this.dragState.isDragging = false;

    // 移除文档级别的事件监听器
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);

    // 恢复文本选择
    document.body.style.userSelect = '';

    // 先设置过渡效果，确保从当前位置平滑过渡
    this.element.style.transition = `all ${this.config.animationDuration}ms ease-out`;

    // 延迟一帧执行吸附，确保过渡效果生效
    requestAnimationFrame(() => {
      // 执行边缘吸附
      if (this.config.enableSnapping) {
        const snapResult = this.snapToNearestEdge();
        this.onDragEndCallbacks.forEach(callback => callback(snapResult.snapped, snapResult.edge));
      } else {
        this.onDragEndCallbacks.forEach(callback => callback(false, null));
      }
    });
  };

  /**
   * 触摸开始事件处理
   */
  private handleTouchStart = (e: TouchEvent): void => {
    if (!this.config.enableDragging) return;

    e.preventDefault();
    const touch = e.touches[0];

    const rect = this.element.getBoundingClientRect();

    this.dragState = {
      isDragging: true,
      startX: touch.clientX,
      startY: touch.clientY,
      elementStartX: rect.left,
      elementStartY: rect.top,
      currentX: rect.left,
      currentY: rect.top,
    };

    this.element.style.transition = 'none';

    document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    document.addEventListener('touchend', this.handleTouchEnd);

    this.onDragStartCallbacks.forEach(callback => callback());
  };

  /**
   * 触摸移动事件处理
   */
  private handleTouchMove = (e: TouchEvent): void => {
    if (!this.dragState.isDragging) return;

    e.preventDefault();
    const touch = e.touches[0];

    const deltaX = touch.clientX - this.dragState.startX;
    const deltaY = touch.clientY - this.dragState.startY;

    let newX = this.dragState.elementStartX + deltaX;
    let newY = this.dragState.elementStartY + deltaY;

    if (this.config.constrainToViewport) {
      const rect = this.element.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;

      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
    }

    this.dragState.currentX = newX;
    this.dragState.currentY = newY;

    this.element.style.left = `${newX}px`;
    this.element.style.top = `${newY}px`;

    if (this.config.enableSnapping) {
      this.checkEdgeProximity();
    }
  };

  /**
   * 触摸结束事件处理
   */
  private handleTouchEnd = (): void => {
    if (!this.dragState.isDragging) return;

    this.dragState.isDragging = false;

    document.removeEventListener('touchmove', this.handleTouchMove);
    document.removeEventListener('touchend', this.handleTouchEnd);

    // 先设置过渡效果，确保从当前位置平滑过渡
    this.element.style.transition = `all ${this.config.animationDuration}ms ease-out`;

    // 延迟一帧执行吸附，确保过渡效果生效
    requestAnimationFrame(() => {
      if (this.config.enableSnapping) {
        const snapResult = this.snapToNearestEdge();
        this.onDragEndCallbacks.forEach(callback => callback(snapResult.snapped, snapResult.edge));
      } else {
        this.onDragEndCallbacks.forEach(callback => callback(false, null));
      }
    });
  };

  /**
   * 检查边缘接近度
   */
  private checkEdgeProximity(): void {
    const rect = this.element.getBoundingClientRect();
    const edges = this.calculateEdgeDistances(rect);

    // 视觉反馈：接近边缘时改变样式
    const nearEdge = edges.some(edge => edge.distance <= this.config.snapDistance);
    if (nearEdge) {
      this.element.style.opacity = '0.8';
      this.element.style.boxShadow = '0 0 10px rgba(0, 123, 255, 0.5)';
    } else {
      this.element.style.opacity = '1';
      this.element.style.boxShadow = '';
    }
  }

  /**
   * 计算到各边缘的距离
   */
  private calculateEdgeDistances(rect: DOMRect): SnapEdge[] {
    const edges: SnapEdge[] = [];

    if (this.config.snapToEdges.top) {
      edges.push({
        edge: 'top',
        distance: rect.top,
        position: { x: rect.left, y: this.config.edgeOffset },
      });
    }

    if (this.config.snapToEdges.right) {
      edges.push({
        edge: 'right',
        distance: window.innerWidth - rect.right,
        position: { x: window.innerWidth - rect.width - this.config.edgeOffset, y: rect.top },
      });
    }

    if (this.config.snapToEdges.bottom) {
      edges.push({
        edge: 'bottom',
        distance: window.innerHeight - rect.bottom,
        position: { x: rect.left, y: window.innerHeight - rect.height - this.config.edgeOffset },
      });
    }

    if (this.config.snapToEdges.left) {
      edges.push({
        edge: 'left',
        distance: rect.left,
        position: { x: this.config.edgeOffset, y: rect.top },
      });
    }

    return edges.sort((a, b) => a.distance - b.distance);
  }

  /**
   * 吸附到最近的边缘
   */
  private snapToNearestEdge(): { snapped: boolean; edge: SnapEdge['edge'] | null } {
    const rect = this.element.getBoundingClientRect();
    const edges = this.calculateEdgeDistances(rect);

    if (edges.length === 0 || edges[0].distance > this.config.snapDistance) {
      this.isSnapped = false;
      this.currentSnapEdge = null;
      return { snapped: false, edge: null };
    }

    const nearestEdge = edges[0];
    this.element.style.left = `${nearestEdge.position.x}px`;
    this.element.style.top = `${nearestEdge.position.y}px`;

    this.isSnapped = true;
    this.currentSnapEdge = nearestEdge.edge;

    // 触发吸附回调
    this.onSnapCallbacks.forEach(callback => callback(nearestEdge.edge));

    return { snapped: true, edge: nearestEdge.edge };
  }

  /**
   * 手动吸附到指定边缘
   */
  public snapToEdge(edge: SnapEdge['edge']): void {
    if (!this.config.snapToEdges[edge]) return;

    const rect = this.element.getBoundingClientRect();
    let x = rect.left;
    let y = rect.top;

    switch (edge) {
      case 'top':
        y = this.config.edgeOffset;
        break;
      case 'right':
        x = window.innerWidth - rect.width - this.config.edgeOffset;
        break;
      case 'bottom':
        y = window.innerHeight - rect.height - this.config.edgeOffset;
        break;
      case 'left':
        x = this.config.edgeOffset;
        break;
    }

    this.element.style.left = `${x}px`;
    this.element.style.top = `${y}px`;

    this.isSnapped = true;
    this.currentSnapEdge = edge;

    this.onSnapCallbacks.forEach(callback => callback(edge));
  }

  /**
   * 释放吸附
   */
  public releaseSnap(): void {
    this.isSnapped = false;
    this.currentSnapEdge = null;
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<EdgeSnappingConfig>): void {
    this.config = { ...this.config, ...config };

    // 更新相关样式
    this.element.style.transition = `all ${this.config.animationDuration}ms ease-out`;
    this.element.style.cursor = this.config.enableDragging ? 'move' : 'default';

    if (this.config.enableDragging) {
      this.setupDragging();
    }
  }

  /**
   * 获取当前状态
   */
  public getState(): {
    isSnapped: boolean;
    currentSnapEdge: SnapEdge['edge'] | null;
    isDragging: boolean;
    position: { x: number; y: number };
  } {
    const rect = this.element.getBoundingClientRect();
    return {
      isSnapped: this.isSnapped,
      currentSnapEdge: this.currentSnapEdge,
      isDragging: this.dragState.isDragging,
      position: { x: rect.left, y: rect.top },
    };
  }

  /**
   * 注册拖动开始回调
   */
  public onDragStart(callback: () => void): void {
    this.onDragStartCallbacks.push(callback);
  }

  /**
   * 注册拖动结束回调
   */
  public onDragEnd(callback: (snapped: boolean, edge: SnapEdge['edge'] | null) => void): void {
    this.onDragEndCallbacks.push(callback);
  }

  /**
   * 注册吸附回调
   */
  public onSnap(callback: (edge: SnapEdge['edge']) => void): void {
    this.onSnapCallbacks.push(callback);
  }

  /**
   * 销毁管理器
   */
  public destroy(): void {
    const dragTarget = this.dragHandle || this.element;

    // 移除事件监听器
    dragTarget.removeEventListener('mousedown', this.handleMouseDown);
    dragTarget.removeEventListener('touchstart', this.handleTouchStart);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('touchmove', this.handleTouchMove);
    document.removeEventListener('touchend', this.handleTouchEnd);

    // 清空回调数组
    this.onDragStartCallbacks = [];
    this.onDragEndCallbacks = [];
    this.onSnapCallbacks = [];

    // 重置样式
    this.element.style.transition = '';
    this.element.style.cursor = '';
    this.element.style.opacity = '';
    this.element.style.boxShadow = '';
  }
}

/**
 * 创建一个带边缘吸附功能的浮动面板
 */
export function createEdgeSnappingPanel(
  content: HTMLElement | string,
  config?: Partial<EdgeSnappingConfig>,
): { panel: HTMLElement; manager: EdgeSnappingManager } {
  // 创建面板容器
  const panel = document.createElement('div');
  panel.className = 'edge-snapping-panel';
  panel.style.cssText = `
    position: fixed;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    padding: 10px;
    min-width: 150px;
    min-height: 100px;
    z-index: 10001;
  `;

  // 添加内容
  if (typeof content === 'string') {
    panel.innerHTML = content;
  } else {
    panel.appendChild(content);
  }

  // 创建拖动手柄
  const handle = document.createElement('div');
  handle.className = 'drag-handle';
  handle.style.cssText = `
    width: 100%;
    height: 20px;
    background: linear-gradient(90deg, #007bff, #0056b3);
    margin: -10px -10px 10px -10px;
    border-radius: 8px 8px 0 0;
    cursor: move;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  handle.innerHTML = '<span style="color: white; font-size: 12px;">⋮⋮⋮</span>';

  panel.insertBefore(handle, panel.firstChild);

  // 添加到文档
  document.body.appendChild(panel);

  // 创建管理器
  const manager = new EdgeSnappingManager(panel, config);
  manager.setDragHandle(handle);

  // 设置初始位置
  panel.style.top = '50px';
  panel.style.right = '50px';

  return { panel, manager };
}
