# 边缘吸附功能 (Edge Snapping Feature)

## 功能概述

已成功为 LovPen-sider 扩展实现了浮动元素的边缘吸附功能。此功能允许用户拖动浮动元素（如标记覆盖层），当接近浏览器视窗边缘时会自动吸附。

## 已实现的功能

### 1. 核心边缘吸附模块 (`edge-snapping.ts`)

创建了一个通用的 `EdgeSnappingManager` 类，提供以下功能：

- **拖动支持**：支持鼠标和触摸设备的拖动操作
- **边缘检测**：自动检测元素与视窗边缘的距离
- **智能吸附**：当元素接近边缘时自动吸附
- **视觉反馈**：拖动和吸附时提供视觉效果
- **可配置选项**：
  - `snapDistance`: 吸附触发距离（默认 30px）
  - `animationDuration`: 吸附动画时长（默认 200ms）
  - `edgeOffset`: 吸附后与边缘的距离（默认 10px）
  - `enableSnapping`: 是否启用吸附
  - `enableDragging`: 是否启用拖动
  - `constrainToViewport`: 是否限制在视窗内
  - `snapToEdges`: 可选择吸附到哪些边缘（上/右/下/左）

### 2. 存储配置 (`edge-snapping-storage.ts`)

实现了持久化存储功能，用于保存用户的边缘吸附设置：

- 保存用户的配置偏好
- 记录最后的位置和吸附边缘
- 支持启用/禁用标记元素的吸附功能

### 3. 设置面板 (`EdgeSnappingPanel.tsx`)

在侧边栏的开发者工具中添加了边缘吸附设置面板：

- 可视化配置界面
- 实时调整吸附参数
- 启用/禁用开关
- 边缘选择器
- 应用到标记元素的选项

## 使用方法

### 基础用法

```typescript
import { EdgeSnappingManager } from '@extension/shared';

// 创建一个浮动元素
const floatingElement = document.createElement('div');
floatingElement.style.position = 'fixed';
floatingElement.style.width = '200px';
floatingElement.style.height = '100px';
document.body.appendChild(floatingElement);

// 创建边缘吸附管理器
const manager = new EdgeSnappingManager(floatingElement, {
  snapDistance: 30,
  edgeOffset: 10,
  enableSnapping: true,
  enableDragging: true
});

// 监听事件
manager.onSnap((edge) => {
  console.log(`吸附到 ${edge} 边缘`);
});

manager.onDragEnd((snapped, edge) => {
  if (snapped) {
    console.log(`拖动结束，吸附到 ${edge} 边缘`);
  }
});
```

### 创建带边缘吸附的面板

```typescript
import { createEdgeSnappingPanel } from '@extension/shared';

// 创建内容
const content = document.createElement('div');
content.innerHTML = '<h3>浮动面板</h3><p>可以拖动并吸附到边缘</p>';

// 创建带边缘吸附功能的面板
const { panel, manager } = createEdgeSnappingPanel(content, {
  snapDistance: 50,
  edgeOffset: 20
});

// 设置初始位置
panel.style.top = '100px';
panel.style.right = '100px';
```

## 集成点

### 1. 侧边栏集成

在 `SidePanel.tsx` 的开发者工具模块中添加了边缘吸附设置按钮：

```typescript
// 位置：开发者工具标题栏右侧
🧲 边缘吸附
```

点击按钮会展开设置面板，用户可以：
- 启用/禁用边缘吸附
- 调整吸附距离（10-100px）
- 调整边缘偏移（0-50px）
- 调整动画时长（0-1000ms）
- 选择吸附边缘（上/右/下/左）
- 应用到标记元素

### 2. 存储集成

边缘吸附设置会自动保存到 Chrome 扩展的本地存储中：

```typescript
import { edgeSnappingStorage } from '@extension/storage';

// 获取设置
const settings = await edgeSnappingStorage.getSettings();

// 更新设置
await edgeSnappingStorage.updateSettings({
  settings: {
    snapDistance: 40,
    enableSnapping: true
  }
});

// 启用/禁用标记元素的吸附
await edgeSnappingStorage.setEnabledForMarkers(true);
```

## 技术实现细节

### 拖动实现

- 使用 `mousedown`/`mousemove`/`mouseup` 事件处理鼠标拖动
- 使用 `touchstart`/`touchmove`/`touchend` 事件支持触摸设备
- 拖动时移除过渡动画以实现平滑移动
- 释放时恢复过渡动画以实现吸附效果

### 边缘检测算法

```typescript
// 计算到各边缘的距离
const distanceToTop = rect.top;
const distanceToRight = window.innerWidth - rect.right;
const distanceToBottom = window.innerHeight - rect.bottom;
const distanceToLeft = rect.left;

// 找到最近的边缘
const nearestEdge = Math.min(
  distanceToTop,
  distanceToRight,
  distanceToBottom,
  distanceToLeft
);

// 如果距离小于吸附阈值，执行吸附
if (nearestEdge <= snapDistance) {
  snapToEdge();
}
```

### 视觉反馈

- 拖动时：元素透明度变为 0.8
- 接近边缘时：显示蓝色光晕效果
- 吸附时：短暂的强光晕效果

## 未来扩展建议

1. **多元素管理**：支持同时管理多个浮动元素的吸附
2. **磁性吸附**：元素之间的相互吸附
3. **角落吸附**：支持吸附到视窗角落
4. **记忆位置**：记住每个网站的元素位置偏好
5. **手势支持**：添加更多手势操作（如双击收起/展开）
6. **动画预设**：提供不同的吸附动画效果选择
7. **快捷键**：添加键盘快捷键控制

## 文件结构

```
packages/
├── shared/lib/utils/
│   └── edge-snapping.ts          # 核心边缘吸附模块
├── storage/lib/impl/
│   └── edge-snapping-storage.ts  # 存储配置
pages/side-panel/src/
└── components/
    └── EdgeSnappingPanel.tsx     # 设置面板组件
```

## 注意事项

- 确保元素的 `position` 属性为 `fixed` 或 `absolute`
- 拖动手柄需要合适的 `z-index` 以避免被其他元素遮挡
- 在某些网站上可能需要调整 `z-index` 以确保浮动元素在最上层
- 触摸设备上的拖动操作已通过 `preventDefault()` 防止默认滚动行为