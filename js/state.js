// state.js - プレイヤーの状態管理

export const INITIAL_STATE = {
  age: 0,
  health: 100,
  stress: 0,
  money: 0,           // 単位: 万円（資産）
  intellect: 50,      // 0-100
  effort: 50,         // 0-100
  luck: 50,           // 0-100 (hidden)
  academic: 50,       // 学力 0-100 (visible from age 10)
  athletic: 50,       // 運動 0-100 (visible from age 8)
  appearance: 50,     // 容姿 0-100 (visible from birth)
  isAlive: true,
  deathCause: null,
  lifeCount: 1,
  job: null,          // job.id
  jobData: null,      // jobs.jsonのフルオブジェクト
  isMarried: false,
  gender: null,       // '男性' | '女性'
  parentIncome: null,
  birthRegion: null,
  birthPrefecture: null,
  birthCity: null,
  parentJob: null,
  lifetimeEarnings: 0, // 生涯総収入（万円）
  datingCount: 0,
  firstLoveAge: null,
  firstLoveName: null,
  currentPrefecture: null,
  currentCity: null,
  traits: {
    openness: 50,
    conscientiousness: 50,
    extraversion: 50,
    agreeableness: 50,
    resilience: 50,
  },
  hasChildren: 0,
  history: [],
  // 拡張フィールド
  personality: null,        // 性格タイプID (studious / athletic / creative / sociable / ambitious / easygoing)
  school: null,             // 出身校名（文字列）
  company: null,            // 勤務会社名（文字列）
  partnerName: null,        // 結婚相手の名前
  partnerAppearance: null,  // 結婚相手の容姿グレード (S/A/B/C/D)
  partnerAppearanceLabel: null,
  partnerPersonality: null, // 結婚相手の性格
  personalityRevealed: false,  // 性格は13歳ごろに確立・開示
  eventCooldowns: {},       // { eventId: lastTriggeredAge }
};

let _state = { ...INITIAL_STATE };

// ライフ間で引き継がれる記録
let _lifeRecords = {
  bestAge: 0,
  bestMoney: 0,
  bestScore: 0,
};

export function getState() {
  return { ..._state };
}

export function getLifeRecords() {
  return { ..._lifeRecords };
}

export function setState(updates) {
  _state = { ..._state, ...updates };
}

export function applyEffect(effect) {
  const next = { ..._state };
  for (const [key, value] of Object.entries(effect)) {
    // boolean の isMarried は別処理
    if (key === 'isMarried') {
      if (value === -1) next.isMarried = false;
      else if (value === 1) next.isMarried = true;
      continue;
    }
    if (!(key in next) || typeof next[key] !== 'number') continue;
    const isUnbounded = key === 'money' || key === 'lifetimeEarnings' || key === 'datingCount' || key === 'hasChildren';
    next[key] = Math.max(isUnbounded ? -9999 : 0, Math.min(isUnbounded ? Infinity : 100, next[key] + value));
  }
  _state = next;
}

export function addHistory(entry) {
  _state = {
    ..._state,
    history: [..._state.history, { age: _state.age, ...entry }],
  };
}

export function saveLifeRecords(score) {
  _lifeRecords = {
    bestAge:   Math.max(_lifeRecords.bestAge, _state.age),
    bestMoney: Math.max(_lifeRecords.bestMoney, _state.money),
    bestScore: Math.max(_lifeRecords.bestScore, Math.round(score)),
  };
}

export function resetState() {
  const lifeCount = _state.lifeCount + 1;
  _state = { ...INITIAL_STATE, lifeCount };
}
