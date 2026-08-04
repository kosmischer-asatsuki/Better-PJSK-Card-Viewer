# PJSK 卡面档案室（本地版）

这是一个完全在本机运行的 Project SEKAI 卡面预览器。卡面读取自 `./pjsk_cards`，缩略图读取自 `./pjsk_thumbs`，26 个角色头像缓存于 `./public/character-icons`，运行时不依赖线上图床。

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

## 本地评分与跨机器同步

已完成评级的星级会自动写入独立文件：

```text
data/ratings.json
```

- 文件只保存 1～5 星的已评级卡面，不会上传到外网。
- 浏览器的 `localStorage`（键名 `pjsk-card-ratings-v1`）同时作为缓存与故障降级。
- 切换机器时，可以在项目关闭后直接复制 `data/ratings.json`；也可以在筛选栏使用“导出 JSON / 导入 JSON”。
- 导入采用合并方式：导入文件中的同一卡面评分会覆盖当前评分，其他评分不会被删除。

## 更新角色头像

双击 `refresh-icons.cmd` 可重新从[萌娘百科 PJSK 角色表](https://mzh.moegirl.org.cn/世界计划_%E7%BC%A4%E7%BA%B7%E8%88%9E%E5%8F%B0%EF%BC%81_feat._%E5%88%9D%E9%9F%B3%E6%9C%AA%E6%9D%A5)抓取并缓存 26 个角色 icon。只有刷新头像时需要联网，日常浏览不需要。

## 项目结构

```text
pjsk_cards/                 原始 PNG 卡面（不提交到 Git）
pjsk_thumbs/                本地 WebP 缩略图（不提交到 Git）
public/character-icons/     萌娘百科角色 icon 的本地缓存
data/ratings.json           可复制、可同步的已评级星级文件
app/cards.json              卡面清单
scripts/prepare_local_assets.py
scripts/fetch_character_icons.py
start-local.cmd             本地启动入口
refresh-cards.cmd           更新清单与缩略图
refresh-icons.cmd           更新角色头像
```
