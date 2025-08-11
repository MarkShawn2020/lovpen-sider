#!/bin/bash
# Usage: ./update_version_improved.sh <new_version>
# FORMAT IS <0.0.0>

NEW_VERSION="$1"

# 验证版本格式
if [[ ! "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "❌ Version format <$NEW_VERSION> isn't correct, proper format is <0.0.0>"
  exit 1
fi

echo "📦 Updating all package versions to $NEW_VERSION"

# 计数器
UPDATED=0
FAILED=0

# 查找所有 package.json 文件
while IFS= read -r package_file; do
  # 显示正在处理的文件（相对路径）
  rel_path="${package_file#$PWD/}"
  
  # 使用 jq 或 node 来安全地更新 JSON
  if command -v jq &> /dev/null; then
    # 使用 jq 更新版本（更安全）
    if jq --arg v "$NEW_VERSION" '.version = $v' "$package_file" > "$package_file.tmp" && mv "$package_file.tmp" "$package_file"; then
      echo "  ✓ Updated: $rel_path"
      ((UPDATED++))
    else
      echo "  ✗ Failed: $rel_path"
      ((FAILED++))
    fi
  else
    # 回退到 perl，但使用更精确的正则
    if perl -i -pe 's/"version"\s*:\s*"[^"]*"/"version": "'$NEW_VERSION'"/' "$package_file"; then
      echo "  ✓ Updated: $rel_path"
      ((UPDATED++))
    else
      echo "  ✗ Failed: $rel_path"
      ((FAILED++))
    fi
  fi
done < <(find . -name 'package.json' -not -path '*/node_modules/*' -not -path '*/.turbo/*' -not -path '*/dist/*' -type f)

echo ""
echo "📊 Summary:"
echo "  ✅ Successfully updated: $UPDATED files"
if [ $FAILED -gt 0 ]; then
  echo "  ❌ Failed to update: $FAILED files"
  exit 1
fi

echo ""
echo "✨ All versions updated to $NEW_VERSION"