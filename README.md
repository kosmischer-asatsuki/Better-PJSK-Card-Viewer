# PJSK 卡面档案室（本地版）

这是一个完全在本机运行的 Project SEKAI 卡面预览器。卡面读取自 `./pjsk_cards`，缩略图读取自 `./pjsk_thumbs`，不依赖线上图床。

## 启动

Windows 下双击：

```text
start-local.cmd
```

服务会固定运行在：

```text
http://127.0.0.1:3000
```

也可以在终端中启动：

```bash
pnpm install
pnpm run local
```

## 更新卡面

把 PNG 卡面按角色放入 `pjsk_cards/<角色目录>/` 后，双击：

```text
refresh-cards.cmd
```

它会重新生成 `app/cards.json`，并为新增或改动的卡面生成 WebP 缩略图。若没有 Codex 自带的 Python 环境，需要先安装 Python 和 Pillow：

```bash
python -m pip install pillow
```

## 本地评分

评分保存在浏览器的 `localStorage` 中，键名为 `pjsk-card-ratings-v1`：

- 不会上传到服务器或外网。
- 关闭并重新启动项目后仍会保留。
- 评分与浏览器、用户配置和访问地址绑定，请始终使用 `http://127.0.0.1:3000`。
- 清除该站点的浏览器数据后，评分也会被删除。

## 项目结构

```text
pjsk_cards/                 原始 PNG 卡面（不提交到 Git）
pjsk_thumbs/                本地 WebP 缩略图（不提交到 Git）
app/cards.json              卡面清单
scripts/prepare_local_assets.py
start-local.cmd             本地启动入口
refresh-cards.cmd           更新清单与缩略图
```
