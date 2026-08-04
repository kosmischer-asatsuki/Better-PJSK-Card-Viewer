export type CardRecord = {
  id: string;
  character: string;
  filename: string;
  title: string;
  trained: boolean;
  imageUrl?: string;
};

export type Character = {
  id: string;
  name: string;
  romanized: string;
  mark: string;
  color: string;
};

export type Group = {
  id: string;
  name: string;
  shortName: string;
  color: string;
  softColor: string;
  members: Character[];
};

export const GROUPS: Group[] = [
  {
    id: "virtual-singer",
    name: "虚拟歌手",
    shortName: "VIRTUAL SINGER",
    color: "#00b9ad",
    softColor: "#d9f7f4",
    members: [
      { id: "HatsuneMiku", name: "初音未来", romanized: "Hatsune Miku", mark: "MI", color: "#33ccbb" },
      { id: "KagamineRin", name: "镜音铃", romanized: "Kagamine Rin", mark: "R", color: "#ffcc11" },
      { id: "KagamineLen", name: "镜音连", romanized: "Kagamine Len", mark: "L", color: "#ffee11" },
      { id: "MegurineLuka", name: "巡音流歌", romanized: "Megurine Luka", mark: "LU", color: "#ffbacc" },
      { id: "MEIKO", name: "MEIKO", romanized: "MEIKO", mark: "ME", color: "#dd4444" },
      { id: "KAITO", name: "KAITO", romanized: "KAITO", mark: "KA", color: "#3366cc" },
    ],
  },
  {
    id: "leo-need",
    name: "Leo/need",
    shortName: "LEO/NEED",
    color: "#4455dd",
    softColor: "#e4e7ff",
    members: [
      { id: "HoshinoIchika", name: "星乃一歌", romanized: "Hoshino Ichika", mark: "一", color: "#33aaee" },
      { id: "TenmaSaki", name: "天马咲希", romanized: "Tenma Saki", mark: "咲", color: "#ffdd44" },
      { id: "MochizukiHonami", name: "望月穗波", romanized: "Mochizuki Honami", mark: "穗", color: "#ee6666" },
      { id: "HinomoriShiho", name: "日野森志步", romanized: "Hinomori Shiho", mark: "志", color: "#bbdd22" },
    ],
  },
  {
    id: "more-more-jump",
    name: "MORE MORE JUMP!",
    shortName: "MORE MORE JUMP!",
    color: "#67b934",
    softColor: "#e7f7d8",
    members: [
      { id: "HanasatoMinori", name: "花里实乃理", romanized: "Hanasato Minori", mark: "实", color: "#ffccaa" },
      { id: "KiritaniHaruka", name: "桐谷遥", romanized: "Kiritani Haruka", mark: "遥", color: "#99ccff" },
      { id: "MomoiAiri", name: "桃井爱莉", romanized: "Momoi Airi", mark: "爱", color: "#ffaacc" },
      { id: "HinomoriShizuku", name: "日野森雫", romanized: "Hinomori Shizuku", mark: "雫", color: "#99eedd" },
    ],
  },
  {
    id: "vivid-bad-squad",
    name: "Vivid BAD SQUAD",
    shortName: "VIVID BAD SQUAD",
    color: "#f15464",
    softColor: "#ffe4e8",
    members: [
      { id: "AzusawaKohane", name: "小豆泽心羽", romanized: "Azusawa Kohane", mark: "心", color: "#ff6699" },
      { id: "ShiraishiAn", name: "白石杏", romanized: "Shiraishi An", mark: "杏", color: "#00bbdd" },
      { id: "ShinonomeAkito", name: "东云彰人", romanized: "Shinonome Akito", mark: "彰", color: "#ff7722" },
      { id: "AoyagiToya", name: "青柳冬弥", romanized: "Aoyagi Toya", mark: "冬", color: "#0077dd" },
    ],
  },
  {
    id: "wonderlands-showtime",
    name: "Wonderlands×Showtime",
    shortName: "WONDERLANDS×SHOWTIME",
    color: "#ed7f24",
    softColor: "#fff0dd",
    members: [
      { id: "TenmaTsukasa", name: "天马司", romanized: "Tenma Tsukasa", mark: "司", color: "#ffbb00" },
      { id: "OtoriEmu", name: "凤笑梦", romanized: "Otori Emu", mark: "笑", color: "#ff66bb" },
      { id: "KusanagiNene", name: "草薙宁宁", romanized: "Kusanagi Nene", mark: "宁", color: "#33dd99" },
      { id: "KamishiroRui", name: "神代类", romanized: "Kamishiro Rui", mark: "类", color: "#bb88ee" },
    ],
  },
  {
    id: "nightcord",
    name: "25点，Nightcord见。",
    shortName: "25-JI, NIGHTCORD DE.",
    color: "#79649d",
    softColor: "#eee8f7",
    members: [
      { id: "YoisakiKanade", name: "宵崎奏", romanized: "Yoisaki Kanade", mark: "奏", color: "#bb6688" },
      { id: "AsahinaMafuyu", name: "朝比奈真冬", romanized: "Asahina Mafuyu", mark: "冬", color: "#8888cc" },
      { id: "ShinonomeEna", name: "东云绘名", romanized: "Shinonome Ena", mark: "绘", color: "#ccaa88" },
      { id: "AkiyamaMizuki", name: "晓山瑞希", romanized: "Akiyama Mizuki", mark: "瑞", color: "#ddaacc" },
    ],
  },
];

export const CHARACTERS = GROUPS.flatMap((group) =>
  group.members.map((character) => ({ ...character, groupId: group.id })),
);

export const CHARACTER_BY_ID = Object.fromEntries(
  CHARACTERS.map((character) => [character.id, character]),
);

export const GROUP_BY_CHARACTER = Object.fromEntries(
  GROUPS.flatMap((group) => group.members.map((character) => [character.id, group])),
);
