````text
# PJSK 卡面档案室（本地版）

这是一个完全在本机运行的 Project SEKAI 卡面预览器，因此可以高流畅度的运行。卡面读取自 `./pjsk_cards`，缩略图读取自 `./pjsk_thumbs`，角色头像、团体 Logo、卡面花色、游戏内星级和中日英标题均缓存于项目中，运行时不依赖线上图床。

页面右上角可切换中文、日文和英文。语言切换会同步更新整套界面、角色与团体名称、筛选器、弹窗和卡面标题；3 星与 4 星在特训前显示横向金色星星，特训后显示横向彩色星星。

## 环境要求

- [Node.js](https://nodejs.org/) 22.13.0 或更高版本（安装时会自带 npm）。
- Python 3.10 或更高版本。
- 足够的磁盘空间用于保存原始卡面和生成的缩略图。

`node_modules`、`pjsk_cards` 和 `pjsk_thumbs` 均不会上传到 GitHub。克隆项目后可通过以下步骤在本机重建。

## 首次克隆与构建

1. 克隆项目并进入项目目录：

```bash
git clone <你的 GitHub 仓库地址>
cd PJSK
```

2. 根据 `package-lock.json` 安装前端依赖并重建 `node_modules`：

```bash
npm ci
```

3. 安装卡面下载及图片处理所需的 Python 模块：

```bash
python -m pip install requests beautifulsoup4 pillow
```

4. 下载卡面。脚本默认保存到 `./pjsk_cards`，支持跳过已有文件和断点续传：

```bash
python download.py
```

5. 生成 `./pjsk_thumbs` 缩略图并刷新本地卡面清单：

```bash
npm run prepare:local
```

6. 检查项目能否正常构建：

```bash
npm run build
```

7. 启动本地服务：

```bash
npm run local
```

浏览器访问：

```text
http://127.0.0.1:3000
```

Windows 用户完成首次安装后，日常使用也可以直接双击 `start-local.cmd` 启动。再次执行 `npm ci` 时，npm 会按照锁文件恢复一致的依赖版本，无需从 GitHub 下载 `node_modules`。

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

## 更新卡面资料与筛选图标

双击 `refresh-card-data.cmd` 可从 [Project SEKAI Wiki Card List](https://projectsekai.fandom.com/wiki/Card_List) 更新：

- 2364 张本地卡面的五种 Attributes。
- 1 星、2 星、3 星、4 星、3 星彩（特训后）、4 星彩（特训后）和生日卡分类。
- 五种花色图标、七种稀有度图标和六个团体 Logo。
- 从 [Sekai Viewer](https://sekai.best/card) 使用的简中、日文和英文主数据更新三语卡面标题。

抓取结果保存在 `data/card-metadata.json` 和 `data/card-titles.json`，并自动合并进 `app/cards.json`。脚本会兼容 Wiki 文件名与 Windows 本地文件名之间的问号、引号和下划线差异。尚未在简中服或国际服实装的卡片会回退到已有英文标题，不会显示为空。

## 项目结构

```text
pjsk_cards/                 原始 PNG 卡面（不提交到 Git）
pjsk_thumbs/                本地 WebP 缩略图（不提交到 Git）
public/character-icons/     萌娘百科角色 icon 的本地缓存
public/filter-icons/        花色、稀有度和团体 Logo 的本地缓存
data/card-metadata.json     Fandom 卡面花色与稀有度缓存
data/card-titles.json       Sekai Viewer 中、日、英卡面标题缓存
data/ratings.json           可复制、可同步的已评级星级文件
app/cards.json              卡面清单
scripts/prepare_local_assets.py
scripts/fetch_character_icons.py
scripts/fetch_fandom_metadata.py
scripts/fetch_sekai_titles.py
start-local.cmd             本地启动入口
refresh-cards.cmd           更新清单与缩略图
refresh-icons.cmd           更新角色头像
refresh-card-data.cmd       更新卡面资料和筛选图标
```xxxxxxxxxx pjsk_cards/                 原始 PNG 卡面（不提交到 Git）pjsk_thumbs/                本地 WebP 缩略图（不提交到 Git）public/character-icons/     萌娘百科角色 icon 的本地缓存public/filter-icons/        花色、稀有度和团体 Logo 的本地缓存data/card-metadata.json     Fandom 卡面花色与稀有度缓存data/card-titles.json       Sekai Viewer 中、日、英卡面标题缓存data/ratings.json           可复制、可同步的已评级星级文件app/cards.json              卡面清单scripts/prepare_local_assets.pyscripts/fetch_character_icons.pyscripts/fetch_fandom_metadata.pyscripts/fetch_sekai_titles.pystart-local.cmd             本地启动入口refresh-cards.cmd           更新清单与缩略图refresh-icons.cmd           更新角色头像refresh-card-data.cmd       更新卡面资料和筛选图标text
````
