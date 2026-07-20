// ── Rank tiers: name color + insignia symbol, escalating with rank number ──
// Ranks 1-44 come from lib/levelSystem.js RANKS. Tiers group them visually.
export const RANK_TIERS = [
  { maxRank: 6, color: "#9ca3af", symbol: "●", tierName: "Bronze" },     // Novice..Adventurer
  { maxRank: 14, color: "#4ade80", symbol: "◆", tierName: "Jade" },      // Scout..Battler
  { maxRank: 21, color: "#60a5fa", symbol: "▲", tierName: "Sapphire" },  // Marauder..Expert
  { maxRank: 28, color: "#c084fc", symbol: "★", tierName: "Amethyst" }, // Vanquisher..Swordmaster
  { maxRank: 35, color: "#fbbf24", symbol: "♛", tierName: "Gold" },      // Keeper..Imperial
  { maxRank: 39, color: "#f87171", symbol: "⚔", tierName: "Crimson" },  // Superstar..Immortal
  { maxRank: 43, color: "#f472b6", symbol: "✦", tierName: "Celestial" },// Hero..Demigod
  { maxRank: 44, color: "#facc15", symbol: "☯", tierName: "Divine" },    // God
];

export function getRankStyle(rankNumber) {
  return RANK_TIERS.find((t) => rankNumber <= t.maxRank) || RANK_TIERS[RANK_TIERS.length - 1];
}

// ── Preset pfps (emoji-based, no image upload/storage needed) ──
export const AVATAR_OPTIONS = [
  "🧑‍🎓", "🦉", "🐺", "🐉", "🦊", "🐧", "🦁", "🐢", "🌙", "⚡", "🔥", "🌸", "🎯", "🗡️", "🛡️", "👾",
];

export function getAvatarDisplay(avatarId) {
  return AVATAR_OPTIONS.includes(avatarId) ? avatarId : AVATAR_OPTIONS[0];
}
