import type { CardAttributeId, CardLanguage, CardRarityId, Character, Group } from "./data";

export const LANGUAGE_TAGS: Record<CardLanguage, string> = {
  zh: "zh-CN",
  ja: "ja-JP",
  en: "en",
};

export const UI_COPY = {
  zh: {
    pageTitle: "PJSK 卡面档案室｜SEKAI ARCHIVE",
    multiFilter: "多重筛选",
    filterCards: "筛选卡面",
    resetAll: "重置全部",
    closeFilters: "关闭筛选",
    groups: "团体",
    characters: "角色",
    attributes: "卡面花色",
    gameRarity: "游戏内星级",
    myRating: "我的评分",
    reset: "重置",
    unrated: "未评分",
    ratingFile: "评分文件",
    loading: "正在读取…",
    saving: "正在保存…",
    synced: "已同步",
    localOnly: "仅浏览器存储",
    syncFailed: "同步失败",
    exportJson: "导出 JSON",
    importJson: "导入 JSON",
    filterLogic: "同类选项取并集，不同条件取交集。评分同时保存到浏览器与本地文件。",
    cardViewer: "PJSK 卡面预览器",
    heroKicker: "你的世界，你的心选",
    heroTitle: "卡面档案室",
    heroDescription: "",
    collectionStats: "收藏统计",
    completeCollection: "完整收藏",
    averageRating: "平均星级",
    cardsShort: "卡面",
    ratedShort: "已评分",
    averageShort: "平均",
    searchPlaceholder: "搜索卡名或角色…",
    searchCards: "搜索卡名或角色",
    clearSearch: "清空搜索",
    filters: "筛选",
    interfaceLanguage: "界面语言",
    sort: "排序",
    catalogOrder: "目录顺序",
    ratingOrder: "我的评分最高",
    titleOrder: "卡名 A–Z",
    matchingLabel: "张符合条件的卡面",
    clearFilters: "清除筛选",
    clickOriginal: "点击卡面查看原图",
    openOriginal: "查看原图 ↗",
    loadMore: "加载更多",
    noCards: "没有找到卡面",
    noCardsDescription: "试试减少筛选条件，或换一个搜索词。",
    resetFilters: "重置筛选",
    footer: "角色头像参考萌娘百科；卡面花色、稀有度与团体 Logo 参考 Project SEKAI Wiki；评分同步至 data/ratings.json。",
    closeOriginal: "关闭原图",
    previousCard: "上一张",
    nextCard: "下一张",
    openNewWindow: "新窗口打开原图 ↗",
    invalidRatings: "导入失败：请选择有效的评分 JSON 文件",
  },
  ja: {
    pageTitle: "PJSK カードアーカイブ｜SEKAI ARCHIVE",
    multiFilter: "マルチフィルター",
    filterCards: "カードを絞り込む",
    resetAll: "すべてリセット",
    closeFilters: "フィルターを閉じる",
    groups: "ユニット",
    characters: "キャラクター",
    attributes: "カード属性",
    gameRarity: "レアリティ",
    myRating: "マイ評価",
    reset: "リセット",
    unrated: "未評価",
    ratingFile: "評価ファイル",
    loading: "読み込み中…",
    saving: "保存中…",
    synced: "同期済み",
    localOnly: "ブラウザ保存のみ",
    syncFailed: "同期失敗",
    exportJson: "JSONを書き出す",
    importJson: "JSONを読み込む",
    filterLogic: "同じカテゴリ内はOR、異なる条件間はANDです。評価はブラウザとローカルファイルに保存されます。",
    cardViewer: "PJSK カードビューアー",
    heroKicker: "あなたのセカイ、あなたの一枚",
    heroTitle: "カードアーカイブ",
    heroDescription: "輝く一瞬を集めよう。カードを眺め、お気に入りに星を残せます。",
    collectionStats: "コレクション統計",
    completeCollection: "全カード",
    averageRating: "平均評価",
    cardsShort: "カード",
    ratedShort: "評価済み",
    averageShort: "平均",
    searchPlaceholder: "カード名・キャラクターを検索…",
    searchCards: "カード名・キャラクターを検索",
    clearSearch: "検索をクリア",
    filters: "フィルター",
    interfaceLanguage: "表示言語",
    sort: "並び順",
    catalogOrder: "カタログ順",
    ratingOrder: "評価が高い順",
    titleOrder: "カード名 A–Z",
    matchingLabel: "枚のカードが条件に一致",
    clearFilters: "フィルターを解除",
    clickOriginal: "カードをクリックして原寸表示",
    openOriginal: "原寸を見る ↗",
    loadMore: "さらに読み込む",
    noCards: "カードが見つかりません",
    noCardsDescription: "条件を減らすか、別の検索語を試してください。",
    resetFilters: "フィルターをリセット",
    footer: "キャラクターアイコンは萌娘百科、属性・レアリティ・ユニットロゴはProject SEKAI Wikiを参照。評価はdata/ratings.jsonに同期されます。",
    closeOriginal: "原寸画像を閉じる",
    previousCard: "前のカード",
    nextCard: "次のカード",
    openNewWindow: "新しいウィンドウで原寸表示 ↗",
    invalidRatings: "読み込み失敗：有効な評価JSONファイルを選択してください",
  },
  en: {
    pageTitle: "PJSK Card Archive | SEKAI ARCHIVE",
    multiFilter: "MULTI FILTER",
    filterCards: "Filter Cards",
    resetAll: "Reset All",
    closeFilters: "Close filters",
    groups: "Units",
    characters: "Characters",
    attributes: "Attributes",
    gameRarity: "In-game Rarity",
    myRating: "My Rating",
    reset: "Reset",
    unrated: "Unrated",
    ratingFile: "Rating File",
    loading: "Loading…",
    saving: "Saving…",
    synced: "Synced",
    localOnly: "Browser storage only",
    syncFailed: "Sync failed",
    exportJson: "Export JSON",
    importJson: "Import JSON",
    filterLogic: "Options in one category use OR; different categories use AND. Ratings are saved to the browser and local file.",
    cardViewer: "PJSK CARD VIEWER",
    heroKicker: "YOUR SEKAI, YOUR PICKS",
    heroTitle: "Card Archive",
    heroDescription: "Collect every shining moment. Browse cards and rate your favorites.",
    collectionStats: "Collection statistics",
    completeCollection: "Full Collection",
    averageRating: "Average Rating",
    cardsShort: "CARDS",
    ratedShort: "RATED",
    averageShort: "AVERAGE",
    searchPlaceholder: "Search cards or characters…",
    searchCards: "Search cards or characters",
    clearSearch: "Clear search",
    filters: "Filters",
    interfaceLanguage: "Interface language",
    sort: "Sort",
    catalogOrder: "Catalog order",
    ratingOrder: "My rating: highest",
    titleOrder: "Card title A–Z",
    matchingLabel: "matching cards",
    clearFilters: "Clear filters",
    clickOriginal: "Click a card to view the original",
    openOriginal: "View original ↗",
    loadMore: "Load More",
    noCards: "No cards found",
    noCardsDescription: "Try fewer filters or a different search term.",
    resetFilters: "Reset Filters",
    footer: "Character icons reference Moegirlpedia; attributes, rarities, and unit logos reference Project SEKAI Wiki. Ratings sync to data/ratings.json.",
    closeOriginal: "Close original image",
    previousCard: "Previous card",
    nextCard: "Next card",
    openNewWindow: "Open original in a new window ↗",
    invalidRatings: "Import failed: select a valid ratings JSON file",
  },
} as const;

const JAPANESE_CHARACTER_NAMES: Record<string, string> = {
  HatsuneMiku: "初音ミク", KagamineRin: "鏡音リン", KagamineLen: "鏡音レン",
  MegurineLuka: "巡音ルカ", MEIKO: "MEIKO", KAITO: "KAITO",
  HoshinoIchika: "星乃一歌", TenmaSaki: "天馬咲希", MochizukiHonami: "望月穂波", HinomoriShiho: "日野森志歩",
  HanasatoMinori: "花里みのり", KiritaniHaruka: "桐谷遥", MomoiAiri: "桃井愛莉", HinomoriShizuku: "日野森雫",
  AzusawaKohane: "小豆沢こはね", ShiraishiAn: "白石杏", ShinonomeAkito: "東雲彰人", AoyagiToya: "青柳冬弥",
  TenmaTsukasa: "天馬司", OtoriEmu: "鳳えむ", KusanagiNene: "草薙寧々", KamishiroRui: "神代類",
  YoisakiKanade: "宵崎奏", AsahinaMafuyu: "朝比奈まふゆ", ShinonomeEna: "東雲絵名", AkiyamaMizuki: "暁山瑞希",
};

const GROUP_NAMES: Record<string, Record<CardLanguage, string>> = {
  "virtual-singer": { zh: "虚拟歌手", ja: "バーチャル・シンガー", en: "VIRTUAL SINGER" },
  "leo-need": { zh: "Leo/need", ja: "Leo/need", en: "Leo/need" },
  "more-more-jump": { zh: "MORE MORE JUMP!", ja: "MORE MORE JUMP!", en: "MORE MORE JUMP!" },
  "vivid-bad-squad": { zh: "Vivid BAD SQUAD", ja: "Vivid BAD SQUAD", en: "Vivid BAD SQUAD" },
  "wonderlands-showtime": { zh: "Wonderlands×Showtime", ja: "ワンダーランズ×ショウタイム", en: "Wonderlands×Showtime" },
  nightcord: { zh: "25点，Nightcord见。", ja: "25時、ナイトコードで。", en: "Nightcord at 25:00" },
};

const ATTRIBUTE_NAMES: Record<CardAttributeId, Record<CardLanguage, string>> = {
  cool: { zh: "酷炫", ja: "クール", en: "Cool" },
  cute: { zh: "可爱", ja: "キュート", en: "Cute" },
  happy: { zh: "欢乐", ja: "ハッピー", en: "Happy" },
  mysterious: { zh: "神秘", ja: "ミステリアス", en: "Mysterious" },
  pure: { zh: "纯真", ja: "ピュア", en: "Pure" },
};

const RARITY_NAMES: Record<CardRarityId, Record<CardLanguage, string>> = {
  "1": { zh: "1 星", ja: "★1", en: "1 Star" },
  "2": { zh: "2 星", ja: "★2", en: "2 Stars" },
  "3": { zh: "3 星", ja: "★3", en: "3 Stars" },
  "4": { zh: "4 星", ja: "★4", en: "4 Stars" },
  "3-trained": { zh: "3 星彩（特训后）", ja: "★3（特訓後）", en: "3 Stars (Trained)" },
  "4-trained": { zh: "4 星彩（特训后）", ja: "★4（特訓後）", en: "4 Stars (Trained)" },
  birthday: { zh: "生日卡", ja: "バースデーカード", en: "Birthday Card" },
};

export function characterName(character: Character, language: CardLanguage) {
  if (language === "en") return character.romanized;
  if (language === "ja") return JAPANESE_CHARACTER_NAMES[character.id] ?? character.name;
  return character.name;
}

export function groupName(group: Group, language: CardLanguage) {
  return GROUP_NAMES[group.id]?.[language] ?? group.name;
}

export function attributeName(attribute: CardAttributeId, language: CardLanguage) {
  return ATTRIBUTE_NAMES[attribute][language];
}

export function rarityName(rarity: CardRarityId, language: CardLanguage) {
  return RARITY_NAMES[rarity][language];
}

export function memberCount(language: CardLanguage, count: number) {
  if (language === "ja") return `${count}人`;
  if (language === "en") return `${count} members`;
  return `${count} 名角色`;
}

export function cardCount(language: CardLanguage, count: number) {
  if (language === "ja") return `${count}枚のカード`;
  if (language === "en") return `${count} cards`;
  return `${count} 张卡面`;
}

export function ratedCount(language: CardLanguage, count: number) {
  if (language === "ja") return `${count}枚評価済み`;
  if (language === "en") return `${count} rated`;
  return `${count} 已评分`;
}

export function resultCount(language: CardLanguage, count: number) {
  if (language === "ja") return `${count}枚の結果`;
  if (language === "en") return `${count} results`;
  return `${count} 张结果`;
}

export function matchingCount(language: CardLanguage, count: number) {
  if (language === "ja") return `${count}枚のカードが条件に一致`;
  if (language === "en") return `${count} matching cards`;
  return `${count} 张符合条件的卡面`;
}

export function viewResults(language: CardLanguage, count: number) {
  if (language === "ja") return `${count}枚を見る`;
  if (language === "en") return `View ${count} cards`;
  return `查看 ${count} 张`;
}

export function ratingFileCopy(language: CardLanguage, count: number) {
  if (language === "ja") return `${count}件の評価を data/ratings.json に自動保存します。`;
  if (language === "en") return `${count} ratings are automatically saved to data/ratings.json.`;
  return `${count} 条已评级记录，自动保存到 data/ratings.json。`;
}

export function displayedCount(language: CardLanguage, shown: number, total: number) {
  if (language === "ja") return `${shown} / ${total}枚を表示`;
  if (language === "en") return `Showing ${shown} / ${total}`;
  return `已显示 ${shown} / ${total}`;
}

export function currentRating(language: CardLanguage, value: number) {
  if (language === "ja") return `現在の評価：${value || "未評価"}`;
  if (language === "en") return `Current rating: ${value || "unrated"}`;
  return `当前评分 ${value || "未评分"}`;
}

export function starLabel(language: CardLanguage, value: number) {
  if (language === "ja") return `${value}つ星`;
  if (language === "en") return `${value} star${value === 1 ? "" : "s"}`;
  return `评分 ${value} 星`;
}

export function ratingNotice(language: CardLanguage, kind: "exported" | "imported", count: number) {
  if (language === "ja") return `${count}件の評価を${kind === "exported" ? "書き出しました" : "読み込みました"}`;
  if (language === "en") return `${kind === "exported" ? "Exported" : "Imported"} ${count} ratings`;
  return `已${kind === "exported" ? "导出" : "导入"} ${count} 条评分`;
}
