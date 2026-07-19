// ── THE WILL OF FOCUS: Core Level/EXP/Rank Engine ──
// This file is the "math" we designed: 1 hour studied = 1 base EXP,
// levels grouped into 24 brackets of 25 levels each, bracket n costs
// n EXP per level-up. Level 600 = 7,500 EXP exactly.

const LEVELS_PER_BRACKET = 25;
const TOTAL_BRACKETS = 24;
const MAX_LEVEL = LEVELS_PER_BRACKET * TOTAL_BRACKETS; // 600

// Cumulative EXP required to *finish* bracket n (n = 1..24)
// Formula: 12.5 * n * (n + 1)
function cumulativeExpAfterBracket(n) {
  return 12.5 * n * (n + 1);
}

// Given total EXP, figure out: current level, current bracket,
// EXP into the current level, EXP needed for next level.
export function getProgressFromExp(totalExp) {
  if (totalExp < 0) totalExp = 0;

  // Cap display at max level/exp
  const maxExp = cumulativeExpAfterBracket(TOTAL_BRACKETS);
  const cappedExp = Math.min(totalExp, maxExp);

  let bracket = 1;
  let expBeforeBracket = 0;

  // Walk brackets until we find the one containing our EXP
  for (let n = 1; n <= TOTAL_BRACKETS; n++) {
    const cumAfter = cumulativeExpAfterBracket(n);
    if (cappedExp < cumAfter || n === TOTAL_BRACKETS) {
      bracket = n;
      expBeforeBracket = cumulativeExpAfterBracket(n - 1);
      break;
    }
  }

  const costPerLevelInBracket = bracket; // bracket n costs n EXP/level
  const expIntoBracket = cappedExp - expBeforeBracket;
  const levelsCompletedInBracket = Math.min(
    Math.floor(expIntoBracket / costPerLevelInBracket),
    LEVELS_PER_BRACKET
  );

  const level = (bracket - 1) * LEVELS_PER_BRACKET + levelsCompletedInBracket;
  const expIntoCurrentLevel = expIntoBracket - levelsCompletedInBracket * costPerLevelInBracket;
  const expNeededForNextLevel = costPerLevelInBracket;

  return {
    totalExp,
    level: Math.min(level, MAX_LEVEL),
    bracket,
    expIntoCurrentLevel,
    expNeededForNextLevel,
    percentToNextLevel:
      level >= MAX_LEVEL ? 100 : Math.round((expIntoCurrentLevel / expNeededForNextLevel) * 100),
    isMaxLevel: level >= MAX_LEVEL,
  };
}

// Locked bracket value for bonus scaling: bonuses use bracket/24 multiplier
export function bracketScaledBonus(baseValue, bracketAtPeriodStart) {
  return baseValue * (bracketAtPeriodStart / TOTAL_BRACKETS);
}

// ── Rank ladder (Will of Focus names, unlocking at levels) ──
export const RANKS = [
  { rank: 1, name: "Novice", level: 1 },
  { rank: 2, name: "Apprentice", level: 3 },
  { rank: 3, name: "Journeyman", level: 5 },
  { rank: 4, name: "Pathfinder", level: 7 },
  { rank: 5, name: "Mad Man", level: 15 },
  { rank: 6, name: "Adventurer", level: 17 },
  { rank: 7, name: "Scout", level: 25 },
  { rank: 8, name: "Guardian", level: 30 },
  { rank: 9, name: "Fighter", level: 35 },
  { rank: 10, name: "Brawler", level: 37 },
  { rank: 11, name: "Corporal", level: 50 },
  { rank: 12, name: "Grinder", level: 52 },
  { rank: 13, name: "Hunter", level: 55 },
  { rank: 14, name: "Battler", level: 57 },
  { rank: 15, name: "Marauder", level: 65 },
  { rank: 16, name: "Slayer", level: 70 },
  { rank: 17, name: "Huntsman", level: 75 },
  { rank: 18, name: "Mercenary", level: 80 },
  { rank: 19, name: "Swordsman", level: 90 },
  { rank: 20, name: "Veteran", level: 100 },
  { rank: 21, name: "Expert", level: 120 },
  { rank: 22, name: "Vanquisher", level: 170 },
  { rank: 23, name: "Professional", level: 175 },
  { rank: 24, name: "Duelist", level: 180 },
  { rank: 25, name: "Gladiator", level: 190 },
  { rank: 26, name: "Warrior", level: 240 },
  { rank: 27, name: "Supreme Warrior", level: 290 },
  { rank: 28, name: "Swordmaster", level: 340 },
  { rank: 29, name: "Keeper", level: 345 },
  { rank: 30, name: "Protector", level: 350 },
  { rank: 31, name: "Master", level: 400 },
  { rank: 32, name: "Grandmaster", level: 550 },
  { rank: 33, name: "Scavenger", level: 555 },
  { rank: 34, name: "Knight", level: 575 },
  { rank: 35, name: "Imperial", level: 600 },
  { rank: 36, name: "Superstar", level: 800 },
  { rank: 37, name: "Conqueror", level: 1100 },
  { rank: 38, name: "Lord (Among Humans)", level: 1500 },
  { rank: 39, name: "Immortal (Among Humans)", level: 2000 },
  { rank: 40, name: "Hero", level: 2600 },
  { rank: 41, name: "Champion", level: 3100 },
  { rank: 42, name: "Legend", level: 4000 },
  { rank: 43, name: "Demigod (Among Humans)", level: 5000 },
  { rank: 44, name: "God (Among Humans)", level: 7000 },
];

export function getCurrentRank(level) {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.level) current = r;
    else break;
  }
  return current;
}

export function getNextRank(level) {
  return RANKS.find((r) => r.level > level) || null;
}

export { MAX_LEVEL, TOTAL_BRACKETS, LEVELS_PER_BRACKET, cumulativeExpAfterBracket };
