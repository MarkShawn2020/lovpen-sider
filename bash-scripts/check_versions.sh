#!/bin/bash
# 检查所有 package.json 文件的版本是否同步

echo "🔍 检查项目中所有 package.json 版本同步情况..."
echo ""

# 获取根 package.json 的版本
ROOT_VERSION=$(grep '"version"' package.json | head -1 | cut -d'"' -f4)
echo "📌 根版本: $ROOT_VERSION"
echo ""

SYNC_ISSUES=0
TOTAL_PACKAGES=0

echo "📦 子包版本:"
echo "----------------------------------------"

# 查找所有 package.json 文件
while IFS= read -r package_file; do
  # 获取相对路径
  rel_path="${package_file#$PWD/}"
  
  # 跳过根 package.json
  if [ "$rel_path" = "package.json" ]; then
    continue
  fi
  
  # 提取版本号
  if [ -f "$package_file" ]; then
    version=$(grep '"version"' "$package_file" | head -1 | cut -d'"' -f4)
    ((TOTAL_PACKAGES++))
    
    # 检查是否与根版本一致
    if [ "$version" = "$ROOT_VERSION" ]; then
      echo "  ✅ $rel_path: $version"
    else
      echo "  ⚠️  $rel_path: $version (不同步!)"
      ((SYNC_ISSUES++))
    fi
  fi
done < <(find . -name 'package.json' -not -path '*/node_modules/*' -not -path '*/.turbo/*' -not -path '*/dist/*' -type f | sort)

echo ""
echo "📊 统计摘要:"
echo "----------------------------------------"
echo "  总包数: $TOTAL_PACKAGES"
echo "  同步包: $((TOTAL_PACKAGES - SYNC_ISSUES))"
echo "  不同步: $SYNC_ISSUES"
echo ""

# 总结
if [ $SYNC_ISSUES -eq 0 ]; then
  echo "✅ 所有包版本已同步 ($ROOT_VERSION)"
else
  echo "⚠️  发现 $SYNC_ISSUES 个包版本不同步!"
  echo ""
  echo "💡 建议运行以下命令同步版本:"
  echo "   ./bash-scripts/update_version.sh $ROOT_VERSION"
  echo ""
  echo "或使用改进版脚本:"
  echo "   chmod +x ./bash-scripts/update_version_improved.sh"
  echo "   ./bash-scripts/update_version_improved.sh $ROOT_VERSION"
fi