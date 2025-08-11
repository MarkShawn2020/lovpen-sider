# 悬浮徽章功能 (Floating Badge Feature)

## 功能概述

成功为 LovPen-sider 扩展实现了**悬浮徽章（Floating Badge）**功能。这是一个贴在浏览器视窗边缘的小按钮，用户点击后可以快速打开扩展的侧边栏。

## 核心功能

### 1. 悬浮徽章组件
- **自动注入**：在每个网页上自动显示悬浮徽章
- **快速访问**：点击徽章立即打开侧边栏
- **智能定位**：默认贴在右侧边缘，支持四个方向
- **可拖动**：用户可以拖动徽章到任意位置
- **边缘吸附**：拖动时自动吸附到浏览器边缘

### 2. 视觉特性
- **三种尺寸**：小、中、大
- **主题适配**：支持浅色、深色和自动模式
- **悬停效果**：鼠标悬停时放大并显示工具提示
- **透明度调节**：可调整徽章透明度（30%-100%）
- **动画反馈**：点击时的缩放动画效果

### 3. 智能行为
- **网站管理**：
  - 黑名单模式：在所有网站显示，除了黑名单中的网站
  - 白名单模式：仅在白名单中的网站显示
- **状态记忆**：记住每个网站的徽章位置和显示状态
- **自动隐藏**：可设置无操作后自动隐藏

## 技术实现

### 文件结构
```
packages/
├── shared/lib/utils/
│   ├── floating-badge.ts      # 悬浮徽章核心组件
│   └── edge-snapping.ts       # 边缘吸附功能（复用）
├── storage/lib/impl/
│   └── floating-badge-storage.ts  # 配置存储
pages/
├── content/src/matches/all/
│   └── index.ts               # Content script 集成
├── side-panel/src/components/
│   └── FloatingBadgePanel.tsx # 配置面板
chrome-extension/src/background/
└── index.ts                   # 后台脚本处理
```

### 核心类：FloatingBadge

```typescript
class FloatingBadge {
  // 初始化并注入到页面
  init(): void
  
  // 显示/隐藏控制
  show(): void
  hide(): void
  toggle(): void
  
  // 配置更新
  updateConfig(config: Partial<FloatingBadgeConfig>): void
  
  // 事件处理
  onClick(callback: () => void): void
  
  // 状态管理
  loadState(): Promise<void>
  saveState(): void
  
  // 销毁清理
  destroy(): void
}
```

### 配置选项

```typescript
interface FloatingBadgeConfig {
  position: 'left' | 'right' | 'top' | 'bottom';  // 初始位置
  offset: { x: number; y: number };                // 偏移量
  size: 'small' | 'medium' | 'large';             // 尺寸
  theme: 'light' | 'dark' | 'auto';               // 主题
  showTooltip: boolean;                           // 显示工具提示
  autoHide: boolean;                              // 自动隐藏
  autoHideDelay: number;                          // 隐藏延迟（毫秒）
  enableDragging: boolean;                        // 启用拖动
  enableSnapping: boolean;                        // 启用边缘吸附
  opacity: number;                                // 透明度（0-1）
  customIcon?: string;                            // 自定义图标
}
```

## 使用方法

### 用户操作

1. **打开设置**：
   - 点击侧边栏的"工具"选项卡
   - 点击"悬浮徽章设置"按钮

2. **配置选项**：
   - 启用/禁用悬浮徽章
   - 选择初始位置（左/右/上/下）
   - 调整尺寸和透明度
   - 配置网站黑白名单

3. **页面交互**：
   - 点击徽章打开侧边栏
   - 拖动徽章到喜欢的位置
   - 徽章会自动吸附到边缘

### 网站管理

#### 黑名单模式（默认）
```javascript
// 在所有网站显示，除了：
blacklist: ['example.com', 'blocked.site']
```

#### 白名单模式
```javascript
// 仅在这些网站显示：
useWhitelist: true,
whitelist: ['allowed.com', 'work.site']
```

## 集成点

### 1. Content Script 集成
```typescript
// 页面加载时自动初始化
async function initializeFloatingBadge() {
  const hostname = window.location.hostname;
  const settings = await floatingBadgeStorage.getSettings();
  
  // 检查是否应该显示
  if (await floatingBadgeStorage.shouldShowOnSite(hostname)) {
    const badge = new FloatingBadge(settings.config);
    badge.init();
  }
}
```

### 2. Background Script 处理
```typescript
// 处理打开侧边栏请求
if (request.action === 'openSidePanel') {
  chrome.sidePanel.open({ tabId: sender.tab.id });
}
```

### 3. 存储同步
```typescript
// 监听配置变化，实时更新
chrome.storage.onChanged.addListener((changes) => {
  if (changes['floating-badge-storage-key']) {
    // 重新初始化徽章
    reinitializeBadge();
  }
});
```

## 特色功能

### 1. 边缘吸附
- 利用 EdgeSnappingManager 实现智能吸附
- 拖动时自动检测最近的边缘
- 释放时平滑动画吸附到边缘

### 2. 状态持久化
- 每个网站独立保存徽章位置
- 记住显示/隐藏状态
- 跨会话保持用户偏好

### 3. 视觉反馈
- 拖动时：透明度降低，尺寸缩小
- 悬停时：放大效果，显示工具提示
- 点击时：缩放动画反馈
- 吸附时：蓝色光晕效果

## 性能优化

1. **延迟加载**：页面加载 500ms 后才初始化，避免影响页面性能
2. **事件委托**：使用单一监听器处理多个事件
3. **防抖处理**：窗口调整大小时的位置更新
4. **内存管理**：页面卸载时自动清理资源

## 兼容性

- **浏览器支持**：Chrome/Edge 114+（需要 sidePanel API）
- **触摸设备**：完整支持触摸拖动
- **响应式**：自动适应窗口大小变化
- **主题适配**：跟随系统深色模式

## 未来优化方向

1. **手势支持**：
   - 双击收起/展开侧边栏
   - 长按显示快捷菜单

2. **智能隐藏**：
   - 检测用户活动区域
   - 避免遮挡重要内容

3. **多徽章模式**：
   - 支持多个功能徽章
   - 徽章组管理

4. **动画预设**：
   - 提供多种进入/退出动画
   - 自定义动画时长和缓动函数

5. **快捷键**：
   - 键盘快捷键显示/隐藏
   - 快捷键直接打开侧边栏

## 注意事项

- 某些网站可能有 z-index 冲突，徽章使用了最高优先级 `z-index: 2147483647`
- 在 iframe 中不会显示徽章，避免重复
- 需要 `sidePanel` 权限才能打开侧边栏
- 徽章位置基于视窗坐标，不随页面滚动

## 测试建议

1. 测试不同网站的兼容性
2. 验证拖动和吸附功能
3. 检查黑白名单功能
4. 测试主题切换效果
5. 验证状态持久化