# AppID 泄露修复记录

> 2026-07-13：GitHub Secret Scanner 检测到项目中泄露了微信小程序 AppID（`wx9a27a********02e`），进行了紧急清理。

---

## 一、做了什么

### 1. 修改了 `scrub.py`

| 文件 | 修改内容 |
|------|---------|
| `scrub.py` 第6行 | `"wx9a27a********02e"` → `"YOUR_APPID"` |

- **影响**：此脚本原本用于提交前自动替换 `manifest.json` 中的真实 AppID。修改后成为空操作（将 `YOUR_APPID` 替换为 `YOUR_APPID`），建议后续删除或重写。
- **不影响构建**：该脚本仅用于开发流程，不参与小程序构建或编译。

### 2. 清洗了 Git 历史

使用 `git filter-branch` 在所有历史提交中查找并替换了 AppID 字符串，随后执行了 `git push --force`。

- **影响**：所有旧 commit hash 已变更。
  - 如果你或其他人此前已 `clone` / `pull` 过旧版本，需要**重新 clone** 或执行 `git pull --rebase` 后重置本地分支。
  - `git push --force` 后远程历史被覆盖，旧 commit 不再可用。

### 3. 未修改的文件

以下文件**未改动**，保持原样即可：

| 文件 | 说明 |
|------|------|
| `mp/manifest.json` | 已手动改为 `"appid": "此处填写你的AppID"`，未参与 script 处理 |
| `server/.env` | 不含 AppID，已受 `.gitignore` 保护 |
| `北地书阁项目全档.md` | 本地包含 AppID 但从未提交到 Git，无需处理 |

---

## 二、构建前需注意的事项

### 1. 微信小程序 AppID

`mp/manifest.json` 中的 `mp-weixin.appid` 当前为：

```json
"mp-weixin": {
  "appid": "此处填写你的AppID"
}
```

**构建小程序前请填入你的真实 AppID**，否则微信开发者工具会报错。

### 2. `scrub.py` 已失效

当前 `scrub.py`：

```python
new_c = c.replace("YOUR_APPID", "YOUR_APPID")  # 不执行任何替换
```

- 如果要继续使用，需要改为：
  ```python
  new_c = c.replace("此处填写你的AppID", "你的真实AppID")
  ```
- 或者直接**删除**该文件。

### 3. Git 历史已重写

如果其他人拉取此仓库，需执行：

```bash
git fetch --force
git reset --hard origin/main
```

否则本地旧分支与远程不兼容。

---

## 三、安全建议

- AppID 本身是公开标识符，但建议**不要在代码或文档中硬编码**。
- 真正的密钥 **AppSecret** 本次未泄露，无需重置。
- 若后续 GitHub Secret Scanner 仍然显示告警，可在仓库 Settings → Security → Secret scanning 中标记为已处理。
