// gameEngine.js - ゲームのコアロジック

import { getState, setState, applyEffect, addHistory, saveLifeRecords } from './state.js';

let _data = {
  statistics: null,
  jobs: null,
  turningPoints: null,
  karmaEvents: null,
  prefectures: null,
  schools: null,
  companies: null,
  narratives: null,
};

// ─── データ読み込み ───────────────────────────────────────────
export async function loadData() {
  const [statistics, jobs, turningPoints, karmaEvents, prefectures, schools, companies, narratives] = await Promise.all([
    fetch('./data/statistics.json').then(r => r.json()),
    fetch('./data/jobs.json').then(r => r.json()),
    fetch('./data/turningPoints.json').then(r => r.json()),
    fetch('./data/karmaEvents.json').then(r => r.json()),
    fetch('./data/prefectures.json').then(r => r.json()),
    fetch('./data/schools.json').then(r => r.json()),
    fetch('./data/companies.json').then(r => r.json()),
    fetch('./data/narratives.json').then(r => r.json()),
  ]);
  _data = { statistics, jobs, turningPoints, karmaEvents, prefectures, schools, companies, narratives };
}

export function getJobs() {
  return _data.jobs.filter(j => !j.dreamOnly);
}

// ─── ナラティブテキスト生成 ───────────────────────────────────
export function getNarrative(age, state) {
  if (!_data.narratives) return '';
  const keys = Object.keys(_data.narratives)
    .filter(k => k !== 'quote_midgame')
    .map(Number)
    .sort((a, b) => a - b);
  let bestKey = keys[0] || 0;
  for (const k of keys) { if (k <= age) bestKey = k; }
  const patterns = _data.narratives[String(bestKey)] || [];
  if (!patterns.length) return '';
  const raw = patterns[Math.floor(Math.random() * patterns.length)];
  return fillTemplate(raw, state);
}

export function getRandomMidgameQuote() {
  if (!_data.narratives?.quote_midgame?.length) return null;
  const pool = _data.narratives.quote_midgame;
  return pool[Math.floor(Math.random() * pool.length)];
}

function fillTemplate(template, state) {
  const hour = String(Math.floor(Math.random() * 24)).padStart(2, '0');
  const min  = String(Math.floor(Math.random() * 60)).padStart(2, '0');
  const weight = 2500 + Math.floor(Math.random() * 1500);
  const incomeDescs = {
    '低所得': '慎ましい', '中所得': '普通の', '高所得': '余裕のある', '富裕層': '裕福な',
  };
  return template
    .replace(/{prefecture}/g, state.birthPrefecture || '日本')
    .replace(/{city}/g, state.birthCity || 'どこか')
    .replace(/{parentJob}/g, state.parentJob || '会社員')
    .replace(/{parent_income_desc}/g, incomeDescs[state.parentIncome] || '普通の')
    .replace(/{gender}/g, state.gender || '子')
    .replace(/{job}/g, state.jobData?.name || '社会人')
    .replace(/{company}/g, state.company || state.jobData?.name || '会社')
    .replace(/{school}/g, state.school || '地元の学校')
    .replace(/{partner}/g, state.partnerName || 'パートナー')
    .replace(/{age}/g, String(state.age))
    .replace(/{hour}/g, hour)
    .replace(/{min}/g, min)
    .replace(/{weight}/g, String(weight));
}

// ─── 親ガチャ（ゲーム開始時） ─────────────────────────────────
export function rollBirth() {
  const prev  = getState();
  const lifeCount = prev.age > 0 ? prev.lifeCount + 1 : prev.lifeCount;

  const stats = _data.statistics;
  const parentIncome = weightedRandom(stats.parentIncome);
  const birthRegion  = weightedRandom(stats.birthRegion);

  const gender = Math.random() < 0.512 ? '男性' : '女性';

  // 性格タイプ
  const [personalityId, personalityData] = weightedRandomEntry(stats.personalities);

  const base = {
    intellect: clampStat(gaussRandom(50, 15)),
    effort:    clampStat(gaussRandom(50, 15)),
    luck:      clampStat(gaussRandom(50, 15)),
    health: 100,
    stress: 0,
    money: 0,
  };

  // 親・地域ボーナス
  for (const bonus of [parentIncome.bonus, birthRegion.bonus]) {
    for (const [k, v] of Object.entries(bonus)) {
      if (k in base) base[k] = clampStat(base[k] + v);
    }
  }

  // 性格ボーナス
  for (const [k, v] of Object.entries(personalityData.bonus || {})) {
    if (k in base) base[k] = clampStat(base[k] + v);
  }

  const appearance = clampStat(gaussRandom(50, 15) + (personalityData.bonus?.appearance || 0));
  const academic   = clampStat(Math.round(base.intellect * 0.7 + gaussRandom(0, 10) + (personalityData.bonus?.academic || 0)));
  const athletic   = clampStat(Math.round(base.effort * 0.5 + base.luck * 0.2 + gaussRandom(0, 10) + (personalityData.bonus?.athletic || 0)));

  // 都道府県・市区町村
  const prefectureObj = weightedRandom(_data.prefectures);
  const birthCity = prefectureObj.cities[Math.floor(Math.random() * prefectureObj.cities.length)];

  // 親の職業
  const jobsForIncome = stats.parentJobs[parentIncome.label] || [];
  const parentJob = jobsForIncome.length
    ? jobsForIncome[Math.floor(Math.random() * jobsForIncome.length)]
    : null;

  setState({
    ...base,
    age: 0,
    isAlive: true,
    deathCause: null,
    lifeCount,
    gender,
    personality: personalityId,
    parentIncome: parentIncome.label,
    birthRegion: birthRegion.label,
    birthPrefecture: prefectureObj.prefecture,
    birthCity,
    parentJob,
    appearance,
    academic,
    athletic,
    history: [],
    job: null,
    jobData: null,
    company: null,
    school: null,
    isMarried: false,
    partnerName: null,
    partnerAppearance: null,
    partnerAppearanceLabel: null,
    partnerPersonality: null,
    lifetimeEarnings: 0,
    datingCount: 0,
    firstLoveAge: null,
    firstLoveName: null,
    currentPrefecture: prefectureObj.prefecture,
    currentCity: birthCity,
    hasChildren: 0,
  });

  addHistory({
    icon: '👶',
    text: `誕生。${prefectureObj.prefecture} ${birthCity}生まれ。親の所得：${parentIncome.label}（${parentJob || '不明'}）。性格：${personalityData.label}`,
  });

  return getState();
}

// ─── 1年進める ────────────────────────────────────────────────
export function advanceYear() {
  const state = getState();
  if (!state.isAlive) return { state, events: [], turningPoint: null };

  const newAge = state.age + 1;
  setState({ age: newAge });

  const events = [];
  let personalityRevealed = false;

  // 性格の後天的開示（中学入学後、13歳）
  if (newAge === 13 && !state.personalityRevealed) {
    const pd = _data.statistics.personalities[state.personality];
    setState({ personalityRevealed: true });
    personalityRevealed = true;
    addHistory({
      icon: pd?.emoji || '✨',
      text: `あなたの性格は【${pd?.label || '不明'}】として確立した。${pd?.desc || ''}`,
    });
  }

  // カルマイベント判定
  for (const karma of rollKarmaEvents(newAge)) {
    applyEffect(karma.effect);
    addHistory({ icon: karma.label.split(' ')[0], text: karma.description });
    events.push(karma);
  }

  // 死亡判定（カルマ後）
  const deathResult = rollDeath(newAge);
  if (deathResult.isDead) {
    const score = calcLifeScore(getState());
    saveLifeRecords(score);
    setState({ isAlive: false, deathCause: deathResult.cause });
    addHistory({ icon: '💀', text: `${newAge}歳で死亡。原因：${deathResult.cause}` });
    return { state: getState(), events, turningPoint: null, isDead: true, personalityRevealed };
  }

  // 就職中：年収・ストレス反映
  const cs = getState();
  if (cs.jobData) {
    const job = cs.jobData;
    const netSavings = Math.round(job.baseSalary * 0.12);
    applyEffect({ money: netSavings, lifetimeEarnings: job.baseSalary });
    const jobStress = Math.round(job.requiredEffort / 25);
    applyEffect({ stress: jobStress });
  } else if (cs.age < 22) {
    // 未成年・学生：お小遣い程度（家庭の収入に依存）
    const allowanceMap = { '富裕層': 3, '高所得': 2, '中所得': 1, '低所得': 0 };
    const allowance = allowanceMap[cs.parentIncome] ?? 1;
    applyEffect({ money: allowance, stress: -2 });
  } else {
    // 無職の成人：生活費で微減
    applyEffect({ money: -5, stress: 5 });
  }

  // 健康悪化
  const s = getState();
  if (s.stress > 70)      applyEffect({ health: -2 });
  else if (s.stress > 50) applyEffect({ health: -1 });

  // 中学・高校・大学の学校割り当て
  autoAssignSchool(newAge);

  // ターニングポイント確認
  const turningPoint = getTurningPoint(newAge);

  return { state: getState(), events, turningPoint, isDead: false, personalityRevealed };
}

// ─── 学校自動割り当て ─────────────────────────────────────────
function autoAssignSchool(age) {
  const state = getState();
  if (!_data.schools) return;

  if (age === 12 && !state.school) {
    const school = assignMiddleSchool(state.academic);
    if (school) {
      setState({ school });
      addHistory({ icon: '🏫', text: `中学校入学：${school}` });
    }
  } else if (age === 16) {
    const school = assignHighSchool(state.academic);
    if (school) {
      setState({ school });
      addHistory({ icon: '🏫', text: `高校入学：${school}` });
    }
  } else if (age === 18) {
    const school = assignUniversity(state.academic);
    if (school) {
      setState({ school });
      addHistory({ icon: '🎓', text: `進学：${school}` });
      const cs2 = getState();
      if (cs2.academic >= 70) {
        // 進学で上京する可能性
        if (Math.random() < 0.4) {
          setState({ currentPrefecture: '東京都', currentCity: '新宿区' });
          addHistory({ icon: '🏙', text: `進学のため上京。東京での新生活が始まった。` });
        }
      }
    }
  }
}

function assignMiddleSchool(academic) {
  const s = _data.schools;
  if (academic >= 85 && s.middle_elite?.length) {
    const pool = s.middle_elite.filter(sc => academic >= (sc.requiredAcademic || 0));
    return pool.length ? pool[Math.floor(Math.random() * pool.length)].name : randomFrom(s.middle_good)?.name;
  }
  if (academic >= 65 && s.middle_good?.length) {
    return randomFrom(s.middle_good)?.name;
  }
  return randomFrom(s.middle_public) || '地元中学校';
}

function assignHighSchool(academic) {
  const s = _data.schools;
  if (academic >= 88 && s.high_elite?.length) {
    const pool = s.high_elite.filter(sc => academic >= (sc.requiredAcademic || 0));
    return pool.length ? pool[Math.floor(Math.random() * pool.length)].name : randomFrom(s.high_good)?.name;
  }
  if (academic >= 70 && s.high_good?.length) {
    return randomFrom(s.high_good)?.name;
  }
  if (academic >= 45 && s.high_regular?.length) {
    return randomFrom(s.high_regular)?.name;
  }
  return randomFrom(s.high_vocational)?.name || '地元高校';
}

function assignUniversity(academic) {
  const s = _data.schools;
  if (academic >= 90 && s.university_top?.length) {
    const pool = s.university_top.filter(sc => academic >= (sc.requiredAcademic || 0));
    return pool.length ? pool[Math.floor(Math.random() * pool.length)].name : randomFrom(s.university_middle)?.name;
  }
  if (academic >= 70 && s.university_middle?.length) {
    return randomFrom(s.university_middle)?.name;
  }
  if (academic >= 50 && s.university_regional?.length) {
    return randomFrom(s.university_regional)?.name;
  }
  if (s.vocational?.length) {
    return randomFrom(s.vocational)?.name;
  }
  return null;
}

function randomFrom(arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── ターニングポイント選択（成功/失敗ロール付き） ────────────
export function chooseTurningPoint(turningPoint, choiceIndex) {
  const state = getState();
  const choice = turningPoint.choices[choiceIndex];

  if (!canChoose(state, choice.condition)) {
    return { success: false, message: '条件を満たしていないため選べません。' };
  }

  // 性格ボーナスを successRate に反映
  let baseSuccessRate = choice.successRate;
  if (baseSuccessRate !== undefined && choice.personalityBonus && state.personality) {
    const bonus = choice.personalityBonus[state.personality] || 0;
    baseSuccessRate = Math.min(1, baseSuccessRate + bonus);
  }

  // 成功判定ロール
  const hasRoll = baseSuccessRate !== undefined && baseSuccessRate < 1.0;
  let succeeded = true;
  let rolledValue = 1;

  if (hasRoll) {
    rolledValue = Math.random();
    succeeded = rolledValue < baseSuccessRate;
  }

  // setJobOnSuccess（夢追いジョブ）
  if (choice.setJobOnSuccess && succeeded) {
    const jobData = _data.jobs.find(j => j.id === choice.setJobOnSuccess);
    if (jobData) {
      const company = pickCompanyForJob(choice.setJobOnSuccess);
      setState({ job: choice.setJobOnSuccess, jobData, company });
      addHistory({
        icon: '🌟',
        text: `夢を掴んだ！${jobData.name}として生きていく（年収 ${jobData.baseSalary.toLocaleString()}万円）`,
      });
    }
  }

  // 就職選択（setJob）
  if (choice.setJob) {
    if (hasRoll && !succeeded) {
      // 不採用 → フォールバックジョブへ
      const originalJob = _data.jobs.find(j => j.id === choice.setJob);
      const fallbackId  = originalJob?.failJobId || 'part_time';
      const fallbackJob = _data.jobs.find(j => j.id === fallbackId) || _data.jobs.find(j => j.id === 'part_time');
      const company = pickCompanyForJob(fallbackJob?.id);
      setState({ job: fallbackJob.id, jobData: fallbackJob, company });
      applyEffect(choice.failureEffect || { stress: 20 });
      addHistory({
        icon: '😞',
        text: `就職失敗：${originalJob?.name}に不採用。${fallbackJob.name}として働き始めた。`,
      });
      return {
        success: true,
        hasRoll: true,
        succeeded: false,
        successRate: baseSuccessRate,
        rolledValue,
        message: `${originalJob?.name}への採用は叶わなかった…\n採用率${Math.round((baseSuccessRate || 0) * 100)}%の壁は高かった。\n${fallbackJob.name}として再出発。`,
        effect: choice.failureEffect || { stress: 20 },
        stat: choice.stat || originalJob?.fact || '',
        state: getState(),
      };
    }

    // 採用成功
    const jobData = _data.jobs.find(j => j.id === choice.setJob);
    const company = pickCompanyForJob(choice.setJob);
    setState({ job: choice.setJob, jobData, company });
    addHistory({
      icon: '💼',
      text: `就職：${jobData.name}${company ? `（${company}）` : ''}（年収 ${jobData.baseSalary.toLocaleString()}万円）`,
    });
    return {
      success: true,
      hasRoll,
      succeeded: true,
      successRate: baseSuccessRate || jobData.acceptanceRate,
      rolledValue,
      message: `${jobData.name}に内定！${company ? `\n配属先：${company}` : ''}\n年収 ${jobData.baseSalary.toLocaleString()}万円で社会人生活スタート。`,
      effect: { stress: 5 },
      stat: choice.stat || jobData.fact || '',
      state: getState(),
    };
  }

  // 通常の選択肢
  const effect = succeeded
    ? (choice.successEffect ?? choice.effect ?? {})
    : (choice.failureEffect ?? choice.effect ?? {});

  // 結婚TP：パートナー生成
  let partnerInfo = null;
  if (choice.setMarried && succeeded) {
    partnerInfo = generatePartner(state);
    setState({
      isMarried: true,
      partnerName: partnerInfo.name,
      partnerAppearance: partnerInfo.gradeKey,
      partnerAppearanceLabel: partnerInfo.gradeLabel,
      partnerPersonality: partnerInfo.personality,
    });
    addHistory({
      icon: '💍',
      text: `${partnerInfo.name}と結婚。容姿：${partnerInfo.gradeLabel}、性格：${partnerInfo.personality}`,
    });
  }

  // 初恋TP：相手の名前を設定
  if (turningPoint.firstLoveTP) {
    const loveName = generateFirstLoveName(state);
    setState({ firstLoveName: loveName, firstLoveAge: state.age });
  }

  applyEffect(effect);
  if (!choice.setMarried || !succeeded) {
    addHistory({
      icon: succeeded ? choice.label.split(' ')[0] : '💔',
      text: choice.setMarried && !succeeded
        ? `${turningPoint.title}：告白失敗…`
        : `${turningPoint.title}：「${choice.label.replace(/^[^\s]+ /, '')}」${!succeeded ? '→ 失敗' : ''}`,
    });
  }

  return {
    success: true,
    hasRoll,
    succeeded,
    successRate: baseSuccessRate,
    rolledValue,
    message: succeeded
      ? (choice.successMsg || choice.label.replace(/^[^\s]+ /, ''))
      : (choice.failureMsg || '思い通りにはいかなかった…'),
    effect,
    stat: choice.stat || '',
    partner: partnerInfo,
    state: getState(),
  };
}

// ─── 初恋の相手名生成 ─────────────────────────────────────────
export function generateFirstLoveName(state) {
  const stats = _data.statistics;
  const genderKey = state.gender === '男性' ? 'female' : 'male';
  const names = stats.partnerNames[genderKey] || [];
  return names.length ? names[Math.floor(Math.random() * names.length)] : 'あのひと';
}

// ─── 結婚相手生成 ─────────────────────────────────────────────
function generatePartner(state) {
  const stats = _data.statistics;
  const playerLuck = state.luck || 50;

  // luckRequired を満たすグレードのみ対象
  const availableGrades = Object.entries(stats.partnerAppearance)
    .filter(([, v]) => playerLuck >= v.luckRequired);
  if (!availableGrades.length) availableGrades.push(...Object.entries(stats.partnerAppearance).slice(-2));

  const total = availableGrades.reduce((s, [, v]) => s + v.weight, 0);
  let r = Math.random() * total;
  let gradeKey = availableGrades[availableGrades.length - 1][0];
  let gradeData = availableGrades[availableGrades.length - 1][1];
  for (const [k, v] of availableGrades) {
    r -= v.weight;
    if (r <= 0) { gradeKey = k; gradeData = v; break; }
  }

  const personality = stats.partnerPersonalities[Math.floor(Math.random() * stats.partnerPersonalities.length)];
  const genderKey = state.gender === '男性' ? 'female' : 'male';
  const names = stats.partnerNames[genderKey] || [];
  const name = names.length ? names[Math.floor(Math.random() * names.length)] : 'あいて';

  return {
    name,
    gradeKey,
    gradeLabel: gradeData.label,
    gradeDesc: gradeData.desc,
    personality,
  };
}

// ─── 企業名割り当て ───────────────────────────────────────────
function pickCompanyForJob(jobId) {
  if (!_data.companies || !jobId) return null;
  const matching = _data.companies.filter(c => c.job_ids?.includes(jobId));
  if (!matching.length) return null;
  return matching[Math.floor(Math.random() * matching.length)].name;
}

export function checkChoiceAvailability(state, turningPoint) {
  return (turningPoint.choices || []).map(choice => ({
    ...choice,
    available: canChoose(state, choice.condition),
  }));
}

// ─── 人生スコア計算 ──────────────────────────────────────────
export function calcLifeScore(state) {
  const longevity = Math.min(state.age, 90) / 90 * 35;
  const wealth    = Math.min(Math.max(state.money, 0), 3000) / 3000 * 30;
  const mental    = (100 - Math.min(state.stress, 100)) / 100 * 20;
  const health    = state.health / 100 * 15;
  return longevity + wealth + mental + health;
}

export function lifeScoreGrade(score) {
  if (score >= 90) return { grade: 'S', label: '伝説的な人生', color: '#f59e0b' };
  if (score >= 75) return { grade: 'A', label: '充実した人生',  color: '#22c55e' };
  if (score >= 60) return { grade: 'B', label: '平均的な人生',  color: '#3b82f6' };
  if (score >= 45) return { grade: 'C', label: '苦労が多かった', color: '#8b5cf6' };
  if (score >= 30) return { grade: 'D', label: '厳しい人生',   color: '#f97316' };
  return             { grade: 'F', label: '波乱万丈な人生', color: '#ef4444' };
}

// ─── 誕生レアリティ ───────────────────────────────────────────
export function calcBirthRarity(state) {
  const avgStats = (state.intellect + state.effort + state.luck) / 3;
  if (state.parentIncome === '富裕層' && avgStats >= 65) return 'SSS';
  if (state.parentIncome === '富裕層') return 'SS';
  if (state.parentIncome === '高所得' && avgStats >= 72) return 'S';
  if (state.parentIncome === '高所得') return 'A';
  if (state.parentIncome === '低所得' && avgStats <= 35) return 'C';
  if (state.parentIncome === '低所得') return 'D';
  return 'B';
}

// ─── 性格データ取得 ───────────────────────────────────────────
export function getPersonalityData(id) {
  return _data.statistics?.personalities?.[id] || null;
}

// ─── 都道府県の出生確率取得 ──────────────────────────────────
export function getPrefectureProbability(prefName) {
  if (!_data.prefectures) return null;
  const total = _data.prefectures.reduce((s, p) => s + p.weight, 0);
  const pref = _data.prefectures.find(p => p.prefecture === prefName);
  if (!pref) return null;
  return (pref.weight / total * 100).toFixed(1);
}

// ─── 内部ユーティリティ ───────────────────────────────────────
function rollDeath(age) {
  const rates = _data.statistics.mortalityRates;
  const keys  = Object.keys(rates).map(Number).sort((a, b) => a - b);
  let rate = rates[keys[0]];
  for (const k of keys) { if (age >= k) rate = rates[k]; }

  const state = getState();
  // rate は ‰（千分率）→ /1000 で確率に変換
  // 健康・ストレスは基本確率への「乗率」として反映（若年で絶対値が小さいまま）
  const healthFactor = Math.max(0, (100 - state.health) / 100); // 0（健康100）〜1（健康0）
  const stressFactor = Math.max(0, (state.stress - 60) / 100);  // 0（60以下）〜0.4（100）
  const total = (rate / 1000) * (1 + healthFactor * 0.5 + stressFactor * 0.3);

  if (Math.random() < total) {
    const causes = deathCauses(age, state);
    return { isDead: true, cause: causes[Math.floor(Math.random() * causes.length)] };
  }
  return { isDead: false };
}

function deathCauses(age) {
  if (age < 10) return ['先天性疾患', '不慮の事故'];
  if (age < 30) return ['交通事故', '自殺', '突発的な病気'];
  if (age < 60) return ['悪性新生物（癌）', '心疾患', '過労死', '脳血管疾患'];
  return ['老衰', '悪性新生物（癌）', '心不全', '脳卒中', '肺炎', '誤嚥性肺炎'];
}

function rollKarmaEvents(age) {
  const state = getState();
  const cooldowns = { ...(state.eventCooldowns || {}) };

  // シャッフルしてから抽選（同年に複数イベントが固まらないように）
  const shuffled = [..._data.karmaEvents].sort(() => Math.random() - 0.5);

  const fired = [];
  let dramaticCount = 0; // ストレス大 or お金大幅減のイベント上限
  const newCooldowns = {};

  for (const e of shuffled) {
    if (age < e.minAge || age > e.maxAge) continue;
    if (e.requireMarried && !state.isMarried) continue;
    if (e.requireUnmarried && state.isMarried) continue;

    // クールダウンチェック
    if (e.cooldownYears && cooldowns[e.id] !== undefined) {
      if (age - cooldowns[e.id] < e.cooldownYears) continue;
    }

    if (Math.random() >= e.probability) continue;

    // 年間「重大イベント」は最大2件まで（stress>=25 or money<=-80 の効果を持つもの）
    const isDramatic = (e.effect?.stress >= 25) || (e.effect?.money <= -80);
    if (isDramatic && dramaticCount >= 2) continue;
    if (isDramatic) dramaticCount++;

    fired.push(e);
    if (e.cooldownYears) newCooldowns[e.id] = age;
  }

  // クールダウンをまとめて更新
  if (Object.keys(newCooldowns).length > 0) {
    setState({ eventCooldowns: { ...cooldowns, ...newCooldowns } });
  }

  return fired;
}

function getTurningPoint(age) {
  const state = getState();
  const tp = _data.turningPoints.find(tp => tp.age === age) || null;
  if (!tp) return null;

  // 結婚TP：すでに結婚済みならスキップ
  if ((tp.id === 'tp_marriage' || tp.id === 'tp_marriage_late') && state.isMarried) return null;

  // 就職TP：すでに就職済みならスキップ
  if (tp.type === 'job_select' && state.job !== null) return null;

  // job_select：jobs.jsonから動的に選択肢生成
  if (tp.type === 'job_select') {
    return {
      ...tp,
      choices: _data.jobs
        .filter(job => !job.dreamOnly)
        .map(job => ({
          label: job.name,
          sublabel: `年収 ${job.baseSalary.toLocaleString()}万円`,
          condition: {
            intellect: job.requiredIntellect,
            effort:    job.requiredEffort,
          },
          effect: {},
          setJob: job.id,
          successRate: job.acceptanceRate,
          stat: job.fact || '',
          acceptanceRate: job.acceptanceRate,
        })),
    };
  }

  return tp;
}

function canChoose(state, condition) {
  if (!condition) return true;
  for (const [key, value] of Object.entries(condition)) {
    if ((state[key] || 0) < value) return false;
  }
  return true;
}

function gaussRandom(mean, std) {
  const u1 = Math.random(), u2 = Math.random();
  return Math.round(mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
}

function clampStat(val) { return Math.max(1, Math.min(99, val)); }

function weightedRandom(arr) {
  const entries = Array.isArray(arr)
    ? arr.map(v => [null, v])
    : Object.entries(arr).map(([, v]) => [null, v]);
  const total = entries.reduce((s, [, v]) => s + v.weight, 0);
  let r = Math.random() * total;
  for (const [, v] of entries) { r -= v.weight; if (r <= 0) return v; }
  return entries[entries.length - 1][1];
}

function weightedRandomEntry(obj) {
  const entries = Object.entries(obj);
  const total = entries.reduce((s, [, v]) => s + v.weight, 0);
  let r = Math.random() * total;
  for (const [k, v] of entries) { r -= v.weight; if (r <= 0) return [k, v]; }
  return entries[entries.length - 1];
}
