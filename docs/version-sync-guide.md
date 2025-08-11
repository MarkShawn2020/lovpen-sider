# 版本同步管理指南

## 问题诊断

你的项目版本号**已经同步**。所有 25 个包（1 个根包 + 24 个子包）都是版本 `1.1.1`。

## 当前版本管理机制

### 工作流程
```bash
pnpm version patch
# ↓
# 1. 更新根 package.json 版本
# 2. 触发 postversion 钩子
# 3. 运行 update_version.sh 同步所有子包
# 4. git add & commit --amend
```

### 为什么需要同步？

这是一个 **monorepo** 项目，包含：
- 1 个根 package.json
- 24 个子包的 package.json

每个包都有独立的版本号，但为了简化管理，项目采用了**统一版本策略**（所有包使用相同版本号）。

## 可能的问题原因

如果你觉得版本"不同步"，可能是因为：

### 1. 构建缓存问题
```bash
# 清理所有缓存
pnpm clean
pnpm install --frozen-lockfile
pnpm build
```

### 2. IDE/编辑器缓存
- VSCode: `Cmd+Shift+P` → "Reload Window"
- WebStorm: "File" → "Invalidate Caches and Restart"

### 3. Chrome 扩展缓存
```bash
# 重新构建扩展
pnpm clean:bundle
pnpm build

# 在 Chrome 中重新加载扩展
# chrome://extensions/ → 点击"刷新"按钮
```

## 版本管理工具

### 1. 检查版本同步状态
```bash
# 使用新的检查脚本
./bash-scripts/check_versions.sh
```

### 2. 手动同步版本
```bash
# 如果版本不同步，手动修复
./bash-scripts/update_version.sh 1.1.1
```

### 3. 改进的版本更新脚本
```bash
# 使用更安全的版本更新脚本
chmod +x ./bash-scripts/update_version_improved.sh
./bash-scripts/update_version_improved.sh 1.1.1
```

## 改进建议

### 方案 1: 使用 Changesets (推荐)
```bash
# 安装 changesets
pnpm add -D @changesets/cli

# 初始化
pnpm changeset init

# 配置为固定版本模式
# .changeset/config.json
{
  "fixed": [["*"]],
  "linked": [],
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch"
}
```

### 方案 2: 使用 Lerna
```bash
# 安装 lerna
pnpm add -D lerna

# lerna.json
{
  "version": "1.1.1",
  "npmClient": "pnpm",
  "command": {
    "version": {
      "exact": true
    }
  }
}

# 更新版本
pnpm lerna version patch
```

### 方案 3: 使用 pnpm 的 workspace 版本功能
```bash
# pnpm-workspace.yaml 已存在
# 使用 workspace 协议
pnpm -r exec pnpm version patch
```

## 最佳实践

### 1. 版本更新前检查
```bash
# 更新版本前先检查同步状态
./bash-scripts/check_versions.sh

# 确保工作区干净
git status

# 运行测试
pnpm test
pnpm type-check
```

### 2. 版本更新流程
```bash
# 1. 更新版本
pnpm version patch

# 2. 验证同步
./bash-scripts/check_versions.sh

# 3. 构建测试
pnpm build

# 4. 推送
git push && git push --tags
```

### 3. CI/CD 集成
```yaml
# .github/workflows/version-check.yml
name: Version Sync Check
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: ./bash-scripts/check_versions.sh
```

## 故障排除

### 问题：版本更新后某些包没有同步
```bash
# 检查哪些包没有同步
./bash-scripts/check_versions.sh

# 强制同步到根版本
ROOT_VERSION=$(grep '"version"' package.json | head -1 | cut -d'"' -f4)
./bash-scripts/update_version.sh $ROOT_VERSION
```

### 问题：版本号格式错误
```bash
# 验证版本格式 (必须是 x.y.z)
echo "1.1.1" | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' && echo "✅ Valid" || echo "❌ Invalid"
```

### 问题：Git 提交包含错误的版本
```bash
# 回滚最后一次提交
git reset --soft HEAD~1

# 修复版本
./bash-scripts/update_version.sh 1.1.1

# 重新提交
git add .
git commit -m "chore: sync versions to 1.1.1"
```

## 总结

你的版本号**已经同步**。如果仍有问题，请：

1. 运行 `./bash-scripts/check_versions.sh` 查看详细状态
2. 清理缓存：`pnpm clean && pnpm install`
3. 重新构建：`pnpm build`
4. 检查 Chrome 扩展是否已更新到最新版本

如需帮助，请提供 `check_versions.sh` 的输出结果。