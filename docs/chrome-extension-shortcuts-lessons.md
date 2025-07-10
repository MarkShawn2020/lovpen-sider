# Chrome 扩展快捷键开发经验总结

> 记录在开发 Chrome 扩展快捷键功能时遇到的坑和解决方案

## 核心限制和约束

### 1. 快捷键数量限制
- **每个扩展最多支持 4 个快捷键**
- 超过限制会导致扩展加载失败
- 错误信息：`Too many shortcuts specified for 'commands': The maximum is 4.`

### 2. 快捷键冲突问题
大多数常用快捷键组合已被浏览器或系统占用：

```bash
# 常见冲突的快捷键 (Mac)
cmd+shift+C  # 打开开发者工具
cmd+shift+J  # 打开下载页面
cmd+shift+M  # 打开个人资料菜单
cmd+opt+I    # 打开开发者工具
```

**推荐的安全快捷键组合：**
- `Command+Shift+K` (Mac)
- `Command+Shift+L` (Mac)
- `Ctrl+Shift+K` (Windows/Linux)
- `Ctrl+Shift+L` (Windows/Linux)

## Manifest 配置最佳实践

### 正确的快捷键语法

```javascript
// manifest.ts
commands: {
  'my-command': {
    suggested_key: {
      default: 'Ctrl+Shift+K',
      mac: 'Command+Shift+K',      // ✅ 正确语法
      // mac: 'MacCtrl+Shift+K',   // ❌ 错误语法，会导致失败
    },
    description: 'Command description',
  },
}
```

### 常见配置错误

```javascript
// ❌ 错误示例
{
  "suggested_key": {
    "mac": "MacCtrl+Shift+L"    // 错误：MacCtrl 不是有效语法
  }
}

// ❌ 错误示例  
{
  "suggested_key": {
    "mac": "Command+Alt+C"      // 错误：可能与系统快捷键冲突
  }
}

// ✅ 正确示例
{
  "suggested_key": {
    "default": "Ctrl+Shift+K",
    "mac": "Command+Shift+K"    // 正确：使用 Command 而不是 MacCtrl
  }
}
```

## 错误恢复机制

### 快捷键配置错误后的完整恢复流程

当快捷键配置错误导致扩展无法加载时，热更新和插件刷新都会失效。

**完整恢复步骤：**

1. **移除扩展**
   ```bash
   # 在 chrome://extensions/ 中完全移除扩展
   ```

2. **修复配置文件**
   ```bash
   # 修正 manifest.ts 中的快捷键配置
   ```

3. **重新构建**
   ```bash
   pnpm dev  # 重新启动开发服务器
   ```

4. **重新加载扩展**
   ```bash
   # 在 chrome://extensions/ 中重新加载扩展目录
   ```

⚠️ **注意：** 简单的"重新加载"按钮在配置错误时往往无效，必须完全移除后重新添加。

## 剪贴板访问的技术方案

### 方案演进

1. **Content Script 消息传递** (失败)
   ```javascript
   // ❌ 经常失败：Could not establish connection
   await chrome.tabs.sendMessage(tab.id, {
     action: 'copyToClipboard',
     text: text,
   });
   ```

2. **Offscreen API** (部分成功)
   ```javascript
   // ⚠️ 复杂但有效
   await chrome.offscreen.createDocument({
     url: 'offscreen.html',
     reasons: ['CLIPBOARD'],
     justification: 'Copy text to clipboard'
   });
   ```

3. **Script Injection** (最佳方案)
   ```javascript
   // ✅ 最可靠的方案
   await chrome.scripting.executeScript({
     target: { tabId: tab.id },
     func: async (textToCopy) => {
       await navigator.clipboard.writeText(textToCopy);
     },
     args: [text]
   });
   ```

### 为什么 Script Injection 最可靠

- **直接页面上下文**：在目标页面上下文中执行，拥有完整的剪贴板权限
- **无需预加载**：不依赖预先存在的 content script
- **简单可靠**：避免复杂的消息传递和连接问题
- **权限充足**：使用扩展的 `scripting` 权限直接注入代码

## 必需的权限配置

```javascript
// manifest.ts
{
  permissions: [
    'scripting',        // 用于注入剪贴板代码
    'activeTab',        // 访问当前标签页
    'notifications',    // 显示操作反馈
    'storage',          // 保存用户设置
    // 'offscreen',     // 如果使用 Offscreen API
  ]
}
```

## 用户体验优化

### 操作反馈策略

```javascript
// 优雅的错误处理和用户反馈
try {
  await copyToClipboard(formattedText);
  // 成功通知
  chrome.notifications.create({
    type: 'basic',
    title: 'Super Sider',
    message: `✅ 已复制：${formatName}`,
  });
} catch (error) {
  // 失败但仍提供价值
  chrome.notifications.create({
    type: 'basic', 
    title: 'Super Sider',
    message: `⚠️ 已生成（剪贴板访问失败）：${formatName}`,
  });
  // 在控制台输出文本供手动复制
  console.log('Generated text:', formattedText);
}
```

### 快捷键管理UI

```javascript
// 快捷键状态管理
const getShortcutText = (command) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const shortcutMap = {
    'copy-title-selected': { 
      mac: '⌘⇧K', 
      windows: 'Ctrl+Shift+K' 
    },
  };
  return isMac ? shortcutMap[command]?.mac : shortcutMap[command]?.windows;
};
```

## 调试技巧

### 1. 检查注册的命令
```javascript
// 在 background script 中
chrome.commands.getAll().then(commands => {
  console.log('Registered commands:', commands);
});
```

### 2. 监听命令执行
```javascript
chrome.commands.onCommand.addListener(async command => {
  console.log('Command received:', command);
  // 详细的执行日志
});
```

### 3. 验证快捷键配置
访问 `chrome://extensions/shortcuts` 检查：
- 快捷键是否正确注册
- 是否与其他扩展冲突
- Mac 显示格式是否正确（如 `⌘⇧K`）

## 常见问题和解决方案

### Q: 快捷键按下没有反应
1. 检查是否与其他应用冲突
2. 确认扩展权限是否充足
3. 查看 background script 控制台日志
4. 验证快捷键是否正确注册

### Q: 剪贴板访问失败
1. 确保页面支持 `navigator.clipboard`
2. 检查是否在 HTTPS 页面（HTTP 页面剪贴板权限受限）
3. 尝试使用 script injection 方案
4. 添加降级方案（如控制台输出）

### Q: 配置错误后扩展无法加载
1. 完全移除扩展
2. 修复 manifest 配置
3. 重启开发服务器
4. 重新添加扩展

## 架构建议

### 简化设计原则
- **单一快捷键 + UI选择器**：避免多快捷键的复杂性
- **优雅降级**：剪贴板失败时仍提供价值
- **清晰反馈**：用户始终知道操作状态
- **配置简单**：避免复杂的快捷键管理

### 技术栈推荐
```typescript
// 核心技术选择
- Manifest V3
- TypeScript
- chrome.scripting API (剪贴板)
- chrome.notifications API (反馈)
- React (UI组件)
```

## 参考资源

- [Chrome Extensions Commands API](https://developer.chrome.com/docs/extensions/reference/commands/)
- [Chrome Extensions Scripting API](https://developer.chrome.com/docs/extensions/reference/scripting/)
- [快捷键冲突参考 Issue](https://github.com/greatghoul/profile/issues/1)

---

**总结：** Chrome 扩展快捷键开发看似简单，实际上有很多细节和限制。最重要的是选择安全的快捷键组合、正确的权限配置，以及可靠的剪贴板访问方案。遇到问题时，完整的重新加载流程往往是最有效的解决方案。