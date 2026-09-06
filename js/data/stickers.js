// ごほうびシールのデータ
//
// テーマごとの「アルバム」に分かれていて、1冊そろえると次のアルバムに進む。
// レア度(normal / rare / super)があり、たまに出るレアシールが楽しみになる。
//
// 拡張するときは、この配列にアルバムを追加するだけでよい。
// (獲得済みシールはidで保存しているので、既存の進捗は壊れない)

export const RARITY_LABEL = {
  normal: "ノーマル",
  rare: "レア",
  super: "スーパーレア"
};

export const STICKER_ALBUMS = [
  {
    id: "animal", name: "どうぶつ", cover: "🐾",
    stickers: [
      { id: "an01", emoji: "🐶", name: "いぬ", rarity: "normal" },
      { id: "an02", emoji: "🐱", name: "ねこ", rarity: "normal" },
      { id: "an03", emoji: "🐰", name: "うさぎ", rarity: "normal" },
      { id: "an04", emoji: "🐹", name: "はむすたー", rarity: "normal" },
      { id: "an05", emoji: "🐷", name: "ぶた", rarity: "normal" },
      { id: "an06", emoji: "🐮", name: "うし", rarity: "normal" },
      { id: "an07", emoji: "🐸", name: "かえる", rarity: "normal" },
      { id: "an08", emoji: "🐵", name: "さる", rarity: "normal" },
      { id: "an09", emoji: "🐻", name: "くま", rarity: "rare" },
      { id: "an10", emoji: "🐼", name: "ぱんだ", rarity: "rare" },
      { id: "an11", emoji: "🦊", name: "きつね", rarity: "rare" },
      { id: "an12", emoji: "🦁", name: "らいおん", rarity: "super" }
    ]
  },
  {
    id: "vehicle", name: "のりもの", cover: "🚗",
    stickers: [
      { id: "ve01", emoji: "🚗", name: "くるま", rarity: "normal" },
      { id: "ve02", emoji: "🚕", name: "たくしー", rarity: "normal" },
      { id: "ve03", emoji: "🚌", name: "ばす", rarity: "normal" },
      { id: "ve04", emoji: "🚓", name: "ぱとかー", rarity: "normal" },
      { id: "ve05", emoji: "🚑", name: "きゅうきゅうしゃ", rarity: "normal" },
      { id: "ve06", emoji: "🚚", name: "とらっく", rarity: "normal" },
      { id: "ve07", emoji: "🚲", name: "じてんしゃ", rarity: "normal" },
      { id: "ve08", emoji: "🛵", name: "ばいく", rarity: "normal" },
      { id: "ve09", emoji: "🚒", name: "しょうぼうしゃ", rarity: "rare" },
      { id: "ve10", emoji: "🚂", name: "きかんしゃ", rarity: "rare" },
      { id: "ve11", emoji: "🚁", name: "へりこぷたー", rarity: "rare" },
      { id: "ve12", emoji: "🚀", name: "ろけっと", rarity: "super" }
    ]
  },
  {
    id: "food", name: "たべもの", cover: "🍎",
    stickers: [
      { id: "fo01", emoji: "🍎", name: "りんご", rarity: "normal" },
      { id: "fo02", emoji: "🍌", name: "ばなな", rarity: "normal" },
      { id: "fo03", emoji: "🍓", name: "いちご", rarity: "normal" },
      { id: "fo04", emoji: "🍇", name: "ぶどう", rarity: "normal" },
      { id: "fo05", emoji: "🍉", name: "すいか", rarity: "normal" },
      { id: "fo06", emoji: "🍞", name: "ぱん", rarity: "normal" },
      { id: "fo07", emoji: "🍙", name: "おにぎり", rarity: "normal" },
      { id: "fo08", emoji: "🍜", name: "らーめん", rarity: "normal" },
      { id: "fo09", emoji: "🍰", name: "けーき", rarity: "rare" },
      { id: "fo10", emoji: "🍩", name: "どーなつ", rarity: "rare" },
      { id: "fo11", emoji: "🍦", name: "あいす", rarity: "rare" },
      { id: "fo12", emoji: "🎂", name: "ばーすでーけーき", rarity: "super" }
    ]
  },
  {
    id: "sea", name: "うみのなかま", cover: "🐟",
    stickers: [
      { id: "se01", emoji: "🐟", name: "さかな", rarity: "normal" },
      { id: "se02", emoji: "🐠", name: "ねったいぎょ", rarity: "normal" },
      { id: "se03", emoji: "🦀", name: "かに", rarity: "normal" },
      { id: "se04", emoji: "🦐", name: "えび", rarity: "normal" },
      { id: "se05", emoji: "🐙", name: "たこ", rarity: "normal" },
      { id: "se06", emoji: "🦑", name: "いか", rarity: "normal" },
      { id: "se07", emoji: "🐡", name: "ふぐ", rarity: "normal" },
      { id: "se08", emoji: "🐚", name: "かい", rarity: "normal" },
      { id: "se09", emoji: "🐢", name: "かめ", rarity: "rare" },
      { id: "se10", emoji: "🦈", name: "さめ", rarity: "rare" },
      { id: "se11", emoji: "🐬", name: "いるか", rarity: "rare" },
      { id: "se12", emoji: "🐳", name: "くじら", rarity: "super" }
    ]
  },
  {
    id: "sky", name: "そらとてんき", cover: "🌈",
    stickers: [
      { id: "sk01", emoji: "🌞", name: "たいよう", rarity: "normal" },
      { id: "sk02", emoji: "🌙", name: "つき", rarity: "normal" },
      { id: "sk03", emoji: "⭐", name: "ほし", rarity: "normal" },
      { id: "sk04", emoji: "☁️", name: "くも", rarity: "normal" },
      { id: "sk05", emoji: "⛅", name: "はれときどきくもり", rarity: "normal" },
      { id: "sk06", emoji: "☔", name: "あめ", rarity: "normal" },
      { id: "sk07", emoji: "⚡", name: "かみなり", rarity: "normal" },
      { id: "sk08", emoji: "🌊", name: "なみ", rarity: "normal" },
      { id: "sk09", emoji: "🌈", name: "にじ", rarity: "rare" },
      { id: "sk10", emoji: "❄️", name: "ゆき", rarity: "rare" },
      { id: "sk11", emoji: "🌸", name: "さくら", rarity: "rare" },
      { id: "sk12", emoji: "🎆", name: "はなび", rarity: "super" }
    ]
  },
  {
    id: "space", name: "うちゅう", cover: "🚀",
    stickers: [
      { id: "sp01", emoji: "🌍", name: "ちきゅう", rarity: "normal" },
      { id: "sp02", emoji: "🌕", name: "まんげつ", rarity: "normal" },
      { id: "sp03", emoji: "🌑", name: "しんげつ", rarity: "normal" },
      { id: "sp04", emoji: "🔭", name: "ぼうえんきょう", rarity: "normal" },
      { id: "sp05", emoji: "👽", name: "うちゅうじん", rarity: "normal" },
      { id: "sp06", emoji: "🛸", name: "ゆーふぉー", rarity: "normal" },
      { id: "sp07", emoji: "🌌", name: "ぎんが", rarity: "normal" },
      { id: "sp08", emoji: "☄️", name: "すいせい", rarity: "normal" },
      { id: "sp09", emoji: "🌠", name: "ながれぼし", rarity: "rare" },
      { id: "sp10", emoji: "🛰", name: "じんこうえいせい", rarity: "rare" },
      { id: "sp11", emoji: "🪐", name: "どせい", rarity: "rare" },
      { id: "sp12", emoji: "🌟", name: "かがやくほし", rarity: "super" }
    ]
  }
];

export const ALL_STICKERS = STICKER_ALBUMS.flatMap((a) =>
  a.stickers.map((s) => ({ ...s, albumId: a.id }))
);

export function findSticker(id) {
  return ALL_STICKERS.find((s) => s.id === id) || null;
}
