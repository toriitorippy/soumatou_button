// app.js - UIレンダリング & 自動進行ゲームループ

import {
  loadData, rollBirth, advanceYear, chooseTurningPoint,
  checkChoiceAvailability, calcLifeScore, lifeScoreGrade,
  calcBirthRarity, getNarrative, getRandomMidgameQuote, getPersonalityData,
  generateFirstLoveName,
} from './gameEngine.js';
import { getState, getLifeRecords, setState, saveLifeRecords } from './state.js';
import {
  initOpeningScreen, animateStartToGame,
  animateModalOpen, animateModalClose,
  animateBackdropIn, animateBackdropOut,
  shakeScreen, flashScreen,
  animateTPHeader, animateTPChoices,
  animateNarrativeEntry, animateStatBar,
  animateDeathReveal, animateBirthByRarity,
} from './animations.js';

const $ = id => document.getElementById(id);

// ─── ゲーム状態 ───────────────────────────────────────────────
let isProcessing = false;
let advanceTimer  = null;
let currentSpeed  = 1500; // ms
let _quotes       = [];    // death/life quotes
const QUOTE_AGES  = new Set([20, 30, 40, 50, 60, 70]);
const _closeTimers = {}; // fallback timer refs (unused with GSAP but kept for safety)

// ─── 走馬灯パターン ───────────────────────────────────────────
const SOUMATOU_PATTERNS = {
  young: [
    ['たった{age}年しか、生きられなかった。', true],
    ['{prefecture}で生まれ、{school}に通い、{job}を夢見た。', false],
    ['時間が足りなかった。やりたいことが、山ほどあった。', false],
    ['短くても、確かに輝いた瞬間があった。', false],
    ['さよなら。また、どこかで。', true],
  ],
  success: [
    ['{prefecture}で産声を上げた。{parentIncome}の家に生まれ、{school}に通った。', false],
    ['{job}として歩んだ道のり。想像より長く、想像より短かった。', false],
    ['{partner}と出会い、{age}歳まで共に生きた。', true],
    ['成功と呼べるものがあったとすれば、それは運と努力の奇妙な組み合わせだった。', false],
    ['走馬灯のように浮かぶのは、笑っていた日々の断片だけだ。', true],
  ],
  struggle: [
    ['{prefecture}の{parentIncome}の家に生まれた。それが全ての始まりだった。', false],
    ['お金はいつも足りなかった。それでも、誰かのために働き続けた。', false],
    ['{job}という仕事が、この人生のほとんどを占めた。', false],
    ['報われなかった夜がある。それでも朝は来た。', true],
    ['{age}歳。文句は言えない。精一杯だったから。', true],
  ],
  alone: [
    ['一人で生きた。それがこの人生の形だった。', false],
    ['{school}を出て、{job}になり、{company}で働いた。', false],
    ['誰かと時間を共にすることはなかったが、自分の時間だけは豊かだった。', false],
    ['孤独と自由は、表と裏だ。どちらを選んだかではなく、どちらと生きたかだ。', true],
    ['{age}歳。自分らしい人生だったと思う。', true],
  ],
  elder: [
    ['{age}年間、生きた。', true],
    ['{prefecture}から始まって、{school}を経て、{job}として世の中と向き合った。', false],
    ['時代が変わり、人が変わり、自分も変わった。変わらなかったものもあった。', false],
    ['{partner_text}', false],
    ['十分だ。本当に、十分だ。', true],
  ],
  normal: [
    ['特別な人生ではなかったかもしれない。', false],
    ['{prefecture}生まれの{gender}が、{school}を出て、{job}になった。', false],
    ['{company}での毎日。怒られたり、笑ったり、疲れたり。', false],
    ['誰かに伝えたいことがあったような気もするが、もう忘れた。', false],
    ['{age}歳。走馬灯のように、全てが愛おしく見える。', true],
  ],
};

// ─── 起動 ────────────────────────────────────────────────────
async function init() {
  // ローディング画面アニメーション
  await showLoadingScreen();

  const [, quotes] = await Promise.all([
    loadData(),
    fetch('./data/quotes.json').then(r => r.json()).catch(() => []),
  ]);
  _quotes = Array.isArray(quotes) ? quotes : (quotes.death || quotes.life || []);
  initOpeningScreen();
  $('start-screen').addEventListener('click', startGame, { once: true });
}

function showLoadingScreen() {
  return new Promise(resolve => {
    const bar  = document.getElementById('ls-bar');
    const text = document.getElementById('ls-text');
    if (!bar) { resolve(); return; }

    const messages = ['データ読み込み中...', '人生設定中...', 'カルマ計算中...', 'NOW LOADING...'];
    let progress = 0;
    let msgIdx   = 0;

    const interval = setInterval(() => {
      progress += Math.random() * 18 + 5;
      if (progress >= 100) progress = 100;
      bar.style.width = progress + '%';

      msgIdx = Math.floor(progress / 30) % messages.length;
      if (text) text.textContent = messages[msgIdx];

      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          const ls = document.getElementById('loading-screen');
          if (ls) {
            ls.style.transition = 'opacity .5s ease';
            ls.style.opacity    = '0';
            setTimeout(() => { ls.style.display = 'none'; resolve(); }, 500);
          } else {
            resolve();
          }
        }, 400);
      }
    }, 80);
  });
}

function startGame() {
  animateStartToGame($('start-screen'), $('game-screen'), newLife);
}

async function newLife() {
  stopAutoAdvance();
  isProcessing = false;

  const state = rollBirth();
  $('death-screen').classList.add('hidden');
  const nl = $('narrative-log');
  if (nl) { nl.innerHTML = ''; nl.style.display = ''; }

  renderAll(state);
  appendToLog(0, '人生が始まった。', 'normal');
  await showBirthModal(state);
  startAutoAdvance();
}

// ─── イベントリスナー ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // スピードコントロール
  document.querySelectorAll('.spd-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.spd-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const speed = parseInt(btn.dataset.speed, 10);
      setSpeed(speed);
    });
  });

  // やり直しボタン（リトライ）
  $('btn-retry').addEventListener('click', newLife);

  // 人生やり直しボタン（自殺）
  $('btn-suicide').addEventListener('click', async () => {
    if (!getState().isAlive) return;
    stopAutoAdvance();
    const s = getState();
    const score = calcLifeScore(s);
    saveLifeRecords(score);
    setState({ isAlive: false, deathCause: '自殺' });
    appendToLog(s.age, '💊 自ら人生に幕を下ろした。', 'death');
    await showSoumatouSequence(getState());
    showDeathScreen(getState());
  });

  // 履歴ボタン
  const btnHistory = $('btn-history');
  if (btnHistory) {
    btnHistory.addEventListener('click', () => {
      // ナラティブログの内容をhistory-logにコピー
      const src  = $('narrative-log');
      const dest = $('history-log');
      if (src && dest) {
        dest.innerHTML = src.innerHTML;
        // 最新が下に来るようにスクロール
        setTimeout(() => { dest.scrollTop = dest.scrollHeight; }, 50);
      }
      openBackdrop();
      openModal('history-modal');
    });
  }

  const btnHistoryClose = $('btn-history-close');
  if (btnHistoryClose) {
    btnHistoryClose.addEventListener('click', () => {
      closeModal('history-modal');
    });
  }

  init();
});

// ─── 自動進行 ────────────────────────────────────────────────
function startAutoAdvance() {
  if (currentSpeed === 0) return;
  clearInterval(advanceTimer);
  advanceTimer = setInterval(() => {
    if (!isProcessing) advanceOneYear();
  }, currentSpeed);
}

function stopAutoAdvance() {
  clearInterval(advanceTimer);
  advanceTimer = null;
}

function setSpeed(speed) {
  currentSpeed = speed;
  stopAutoAdvance();
  if (speed > 0 && getState().isAlive) startAutoAdvance();
}

// ─── メインループ ────────────────────────────────────────────
async function advanceOneYear() {
  if (isProcessing) return;
  isProcessing = true;
  stopAutoAdvance();

  try {
    const result = advanceYear();
    const state  = result.state;

    // ナラティブテキスト
    const narrativeText = getNarrative(state.age, state);
    if (narrativeText) appendToLog(state.age, narrativeText, 'normal');

    renderAll(state);

    // 途中の名言（特定の年齢）
    if (QUOTE_AGES.has(state.age)) {
      const quote = getRandomMidgameQuote();
      if (quote) await showQuoteModal(quote);
    }

    // カルマイベント
    if (result.events.length > 0) {
      for (const e of result.events) {
        const type = e.tone === 'good' ? 'karma-good' : 'karma-bad';
        appendToLog(state.age, `【カルマ】${e.description}`, type);
      }
      await showKarmaModal(result.events);
      renderAll(getState());
    }

    // 死亡
    if (result.isDead) {
      appendToLog(state.age, `💀 ${state.deathCause}`, 'death');
      await showSoumatouSequence(state);
      showDeathScreen(state);
      return;
    }

    // ターニングポイント
    if (result.turningPoint) {
      appendToLog(state.age, `⚡ ターニングポイント：${result.turningPoint.title}`, 'tp');
      const tpResult = await showTPModal(result.turningPoint, state);
      renderAll(getState());

      if (tpResult?.hasRoll || result.turningPoint?.firstLoveTP) {
        // 結婚相手情報をリザルトモーダルに追加
        await showResultModal(tpResult);
      }
      if (!getState().isAlive) {
        showDeathScreen(getState());
        return;
      }
    }
  } finally {
    isProcessing = false;
    if (getState().isAlive && currentSpeed > 0) startAutoAdvance();
  }
}

// ══════════════════════════════════════════════════════════════
//  ナラティブログ
// ══════════════════════════════════════════════════════════════

// ─── VNウィンドウ更新 ─────────────────────────────────────────
const VN_TYPE_MAP = {
  'normal':     { prefix: '',         cls: '' },
  'karma-bad':  { prefix: '【カルマ】', cls: 'vn-karma-bad' },
  'karma-good': { prefix: '【KARMA GOOD】', cls: 'vn-karma-good' },
  'tp':         { prefix: '⚡ ',       cls: 'vn-tp' },
  'death':      { prefix: '💀 ',      cls: 'vn-death' },
  'quote':      { prefix: '',         cls: 'vn-quote' },
};

function updateVNWindow(age, text, type = 'normal') {
  const speaker = $('vn-speaker');
  const vnText  = $('vn-text');
  if (!speaker || !vnText) return;

  // スピーカーラベル（年齢＋ライフステージ）
  const stage = getStageLabel(age);
  speaker.textContent = `${String(age).padStart(2,'0')}歳 · ${stage}`;

  // テキスト更新
  const map = VN_TYPE_MAP[type] || VN_TYPE_MAP['normal'];
  vnText.className = `vn-text${map.cls ? ' ' + map.cls : ''}`;
  vnText.textContent = (map.prefix || '') + text;

  // GSAP fade-in
  if (window.gsap) {
    gsap.set(vnText, { opacity: 0, y: 6 });
    gsap.to(vnText, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
  }
}

function getStageLabel(age) {
  if (age < 1)  return '新生児';
  if (age < 6)  return '幼児';
  if (age < 13) return '小学生';
  if (age < 16) return '中学生';
  if (age < 19) return '高校生';
  if (age < 23) return '大学生';
  if (age < 40) return '社会人';
  if (age < 60) return '中堅社会人';
  if (age < 75) return '熟年';
  return '老年';
}

// type: 'normal' | 'karma-bad' | 'karma-good' | 'tp' | 'death' | 'quote'
function appendToLog(age, text, type = 'normal') {
  const log = $('narrative-log');
  if (!log) return;

  const entry = document.createElement('div');
  if (type === 'karma-good') {
    entry.className = 'nl-entry nl-karma nl-karma-good';
  } else if (type === 'karma-bad') {
    entry.className = 'nl-entry nl-karma';
  } else {
    entry.className = `nl-entry nl-${type}`;
  }

  const ageSpan = document.createElement('span');
  ageSpan.className = 'nl-age';
  ageSpan.textContent = `${String(age).padStart(2, '0')}歳`;

  const textSpan = document.createElement('span');
  textSpan.className = 'nl-text';
  textSpan.textContent = text;

  entry.appendChild(ageSpan);
  entry.appendChild(textSpan);
  log.appendChild(entry);

  // フェードインアニメーション
  if (window.gsap) {
    gsap.set(entry, { opacity: 0, y: 8 });
    gsap.to(entry, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
  }

  // 最新エントリにスクロール
  setTimeout(() => entry.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
}

// ══════════════════════════════════════════════════════════════
//  モーダルシステム
// ══════════════════════════════════════════════════════════════

function openBackdrop()  { animateBackdropIn($('modal-backdrop')); }
function closeBackdrop() { animateBackdropOut($('modal-backdrop')); }

function openModal(id, animType) {
  animType = animType || 'normal';
  clearTimeout(_closeTimers[id]);
  openBackdrop();
  const el = $(id);
  el.classList.remove('hidden');
  animateModalOpen(el, animType);
}

function closeModal(id) {
  clearTimeout(_closeTimers[id]);
  const el = $(id);
  animateModalClose(el, () => el.classList.add('hidden'));
  closeBackdrop();
}

// ─── ① 誕生モーダル ──────────────────────────────────────────
function showBirthModal(state) {
  return new Promise(resolve => {
    const rarity    = calcBirthRarity(state);
    const parentPct = { '低所得': 30, '中所得': 50, '高所得': 18, '富裕層': 2 }[state.parentIncome] || 50;
    const genderPct = state.gender === '男性' ? 51.2 : 48.8;
    const personData = getPersonalityData(state.personality);

    const rarityMeta = {
      SSS: { label: '👑 SSS — 資産家の孫', cls: 'rarity-sss', prob: '上位0.5%未満' },
      SS:  { label: '💎 SS — 富裕層',      cls: 'rarity-ss',  prob: '全世帯の約2%' },
      S:   { label: '✨ S — 高所得エリート', cls: 'rarity-s',  prob: '全世帯の約5%' },
      A:   { label: '🌟 A — 高所得',        cls: 'rarity-a',  prob: '全世帯の約18%' },
      B:   { label: '📘 B — 中所得',        cls: 'rarity-b',  prob: '全世帯の約50%' },
      C:   { label: '📉 C — 低所得',        cls: 'rarity-c',  prob: '全世帯の約30%' },
      D:   { label: '💔 D — 極貧',          cls: 'rarity-d',  prob: '下位数%' },
    };
    const rm = rarityMeta[rarity] || rarityMeta['B'];

    const locationName = state.birthPrefecture
      ? `${state.birthPrefecture} ${state.birthCity || ''}`.trim()
      : (state.birthRegion || '不明');

    const facts = [
      `📊 ${state.gender}として生まれる確率：${genderPct}%`,
      '📊 日本人として生まれる確率：世界人口の約1.6%',
      '📊 先進国（G7）に生まれる確率：世界人口の約10%',
    ];

    $('bm-content').innerHTML = `
      <div class="bm-rarity ${rm.cls}">
        <span class="bm-rarity-label">${rm.label}</span>
        <span class="bm-rarity-prob">${rm.prob}</span>
      </div>
      ${personData ? `
      <div class="bm-personality">
        <span class="bm-pers-emoji">${personData.emoji}</span>
        <span class="bm-pers-label">${personData.label}</span>
        <span class="bm-pers-desc">${personData.desc}</span>
      </div>` : ''}
      <div class="bm-stats">
        ${[
          ['🧠 知性', state.intellect],
          ['💪 努力値', state.effort],
          ['✨ 容姿', state.appearance],
        ].map(([label, val]) => `
          <div class="bm-stat-row">
            <span class="bm-stat-label">${label}</span>
            <div class="bm-bar-wrap">
              <div class="bm-bar" style="width:${val}%;background:${val >= 70 ? '#22c55e' : val >= 40 ? '#3b82f6' : '#ef4444'}"></div>
            </div>
            <span class="bm-stat-val">${val}</span>
          </div>`).join('')}
      </div>
      <div class="bm-gacha-grid">
        <div class="bm-gacha-item ${parentPct <= 5 ? 'gacha-rare' : ''}">
          <span class="bm-gacha-icon">👨‍👩‍👦</span>
          <span class="bm-gacha-name">${state.parentIncome}家庭</span>
          <span class="bm-gacha-prob">${state.parentJob || '職業不明'}</span>
        </div>
        <div class="bm-gacha-item">
          <span class="bm-gacha-icon">📍</span>
          <span class="bm-gacha-name">${locationName}</span>
          <span class="bm-gacha-prob">全世帯の${parentPct}%</span>
        </div>
      </div>
      <div class="bm-facts">
        ${facts.map(f => `<div class="bm-fact">${f}</div>`).join('')}
      </div>
    `;

    if (rarity === 'SSS') {
      $('birth-modal').classList.add('birth-modal-sss');
      flashScreen('#fff700', 0.6);
      launchParticles('sss');
    } else if (rarity === 'SS') {
      flashScreen('#ffd700', 0.35);
      launchParticles('gold');
    } else if (rarity === 'S') {
      launchParticles('silver');
    }

    openBackdrop();
    $('birth-modal').classList.remove('hidden');
    animateBirthByRarity(rarity, $('birth-modal'));
    $('bm-ok').addEventListener('click', () => {
      $('birth-modal').classList.remove('birth-modal-sss');
      closeModal('birth-modal');
      resolve();
    }, { once: true });
  });
}

// ─── ② カルマ（モーダル表示） ────────────────────────────────
function showKarmaModal(events) {
  return new Promise(resolve => {
    let idx = 0;

    function showEvent(e) {
      const isGood = e.tone === 'good';
      const emoji  = e.label.split(' ')[0];
      const title  = e.label.replace(/^[^\s]+ /, '');

      $('km-header').className  = `km-header${isGood ? ' km-good-header' : ''}`;
      $('km-badge').textContent = isGood ? '✨ KARMA GOOD' : '⚡ KARMA BAD';
      $('km-badge').className   = `km-badge${isGood ? ' km-good-badge' : ''}`;
      $('km-icon-big').textContent = emoji;

      $('km-content').innerHTML = `
        <div class="km-title">${title}</div>
        <div class="km-desc">${e.description}</div>
        <div class="km-effects">${formatEffect(e.effect)}</div>
        ${events.length > 1 ? `<div class="km-multi-count">${idx + 1} / ${events.length}</div>` : ''}
      `;

      if (idx === 0) {
        openModal('karma-modal', isGood ? 'karma-good' : 'karma-bad');
      } else {
        animateModalOpen($('karma-modal'), isGood ? 'karma-good' : 'karma-bad');
      }

      if (!isGood) { shakeScreen(); flashScreen('#ef4444', 0.18); }
      else         { launchParticles('success'); }

      const btn = $('km-ok');
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      newBtn.className = `modal-ok-btn km-ok${isGood ? ' km-ok-good' : ''}`;
      newBtn.textContent = (idx < events.length - 1) ? '次へ →' : '続ける';
      newBtn.addEventListener('click', () => {
        idx++;
        if (idx < events.length) {
          showEvent(events[idx]);
        } else {
          closeModal('karma-modal');
          resolve();
        }
      }, { once: true });
    }

    showEvent(events[0]);
  });
}

// ─── ③ ターニングポイント（モーダル表示） ────────────────────
function showTPModal(tp, state) {
  return new Promise(resolve => {
    const choices     = checkChoiceAvailability(state, tp);
    const isJobSelect = tp.type === 'job_select';

    let firstLoveNameForTP = null;
    if (tp.firstLoveTP) firstLoveNameForTP = generateFirstLoveName(state);
    const loveNameDisplay = firstLoveNameForTP
      ? ` クラスメートの「${firstLoveNameForTP}」のことが頭から離れない。`
      : '';

    const choicesHTML = isJobSelect
      ? `<div class="tm-job-grid">${choices.map((c, i) => {
          const avail = c.available;
          const pct   = Math.round((c.acceptanceRate || c.successRate || 1) * 100);
          const rCls  = pct < 10 ? 'rate-red' : pct < 30 ? 'rate-orange' : 'rate-green';
          return `<button class="tm-choice-btn tm-job-card" data-index="${i}" ${avail ? 'class="tm-job-card"' : 'class="tm-job-card vn-unavail" disabled'}>
            <div class="vjc-name">${c.label}</div>
            <div class="vjc-salary">${c.sublabel || ''}</div>
            <div class="vjc-req">🧠≥${c.condition?.intellect??0} 💪≥${c.condition?.effort??0}
              <span class="vjc-rate ${rCls}">採用率${pct}%</span>
            </div>
            ${c.stat ? `<div class="vjc-fact">${c.stat}</div>` : ''}
            ${!avail ? `<div class="vjc-unavail">スキル不足</div>` : ''}
          </button>`;
        }).join('')}</div>`
      : `<div class="tm-choices">${choices.map((c, i) => {
          const avail = c.available;
          const hasRate = c.successRate !== undefined && c.successRate < 1;
          const persBonus = c.personalityBonus?.[state.personality];
          const adjustedRate = hasRate ? Math.min(1, c.successRate + (persBonus || 0)) : c.successRate;
          const pct  = hasRate ? Math.round(adjustedRate * 100) : null;
          const rCls = pct !== null ? (pct < 10 ? 'rate-low' : pct < 50 ? 'rate-mid' : 'rate-high') : '';
          return `<button class="tm-choice-btn${avail ? '' : ' vn-unavail'}" data-index="${i}" ${avail ? '' : 'disabled'}>
            <span class="tm-choice-text">${c.label}</span>
            ${hasRate ? `<span class="tm-choice-rate ${rCls}">成功率 ${pct}%${persBonus ? ` (+${Math.round(persBonus*100)}%)` : ''}</span>` : ''}
            ${c.stat ? `<span class="tm-choice-sub">${c.stat}</span>` : ''}
            ${!avail ? `<span class="tm-unavail-tag">⚠ 条件不足</span>` : ''}
          </button>`;
        }).join('')}</div>`;

    $('tm-content').innerHTML = `
      <div class="${isJobSelect ? 'tm-badge job-badge' : 'tm-badge'}">⚡ TURNING POINT</div>
      <div class="tm-title">${tp.title}</div>
      ${tp.description ? `<div class="tm-desc">${tp.description}${loveNameDisplay}</div>` : ''}
      ${tp.stat ? `<div class="tm-stat">${tp.stat}</div>` : ''}
      ${choicesHTML}
    `;

    openModal('tp-modal', 'tp');
    animateTPHeader($('tp-modal'));
    animateTPChoices($('tp-modal'));

    $('tm-content').querySelectorAll('[data-index]:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx    = parseInt(btn.dataset.index, 10);
        const result = chooseTurningPoint(tp, idx);
        closeModal('tp-modal');
        resolve(result);
      }, { once: true });
    });
  });
}

// ─── ④ リザルトモーダル（サイコロ演出） ──────────────────────
function showResultModal(result) {
  return new Promise(resolve => {
    const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    let diceIdx = 0;

    $('rm-icon').textContent    = diceEmojis[0];
    $('rm-icon').className      = 'rm-icon spinning';
    $('rm-verdict').textContent = '運命の審判...';
    $('rm-verdict').className   = 'rm-verdict';
    $('rm-msg').textContent     = '';
    $('rm-stat').textContent    = '';
    $('rm-effect').innerHTML    = '';
    $('rm-ok').classList.add('hidden');

    openModal('result-modal', 'result');

    const spinInterval = setInterval(() => {
      diceIdx = (diceIdx + 1) % diceEmojis.length;
      $('rm-icon').textContent = diceEmojis[diceIdx];
    }, 80);

    setTimeout(() => {
      clearInterval(spinInterval);
      $('rm-icon').classList.remove('spinning');

      if (result.succeeded) {
        $('rm-icon').textContent    = '✨';
        $('rm-icon').className      = 'rm-icon result-success';
        $('rm-verdict').textContent = '成功！';
        $('rm-verdict').className   = 'rm-verdict verdict-success';
        $('rm-ok').textContent      = '🎉 素晴らしい！';
        launchParticles('success');
      } else {
        $('rm-icon').textContent    = '💔';
        $('rm-icon').className      = 'rm-icon result-failure';
        $('rm-verdict').textContent = '失敗...';
        $('rm-verdict').className   = 'rm-verdict verdict-failure';
        $('rm-ok').textContent      = '現実を受け入れる';
        launchParticles('failure');
      }

      if (result.hasRoll && result.successRate !== undefined) {
        const pct = (result.successRate * 100).toFixed(1);
        $('rm-verdict').innerHTML += `<span class="verdict-pct">${pct}%の確率</span>`;
      }

      $('rm-msg').textContent  = result.message || '';
      $('rm-stat').textContent = result.stat    || '';
      $('rm-effect').innerHTML = formatEffect(result.effect || {});

      // 結婚相手情報
      if (result.partner && result.succeeded) {
        $('rm-effect').innerHTML += `
          <div class="rm-partner">
            <div class="rm-partner-title">💍 結婚相手</div>
            <div class="rm-partner-name">${result.partner.name}</div>
            <div class="rm-partner-detail">
              <span class="rm-partner-grade grade-${result.partner.gradeKey}">${result.partner.gradeLabel}</span>
              <span class="rm-partner-pers">${result.partner.personality}</span>
            </div>
            <div class="rm-partner-desc">${result.partner.gradeDesc || ''}</div>
          </div>`;
      }

      $('rm-ok').classList.remove('hidden');
    }, 1400);

    $('rm-ok').addEventListener('click', () => {
      closeModal('result-modal');
      resolve();
    }, { once: true });
  });
}

// ─── ⑤ 名言モーダル ──────────────────────────────────────────
function showQuoteModal(quote) {
  return new Promise(resolve => {
    $('qm-text').textContent   = `「${quote.text}」`;
    $('qm-author').textContent = `— ${quote.author}`;
    openModal('quote-modal');
    $('qm-ok').addEventListener('click', () => {
      closeModal('quote-modal');
      resolve();
    }, { once: true });
  });
}

// ─── 走馬灯シーケンス ─────────────────────────────────────────
function selectSoumatouPattern(state) {
  if (state.age < 40) return SOUMATOU_PATTERNS.young;
  if (state.age > 75) return SOUMATOU_PATTERNS.elder;
  if (!state.isMarried && state.age > 50) return SOUMATOU_PATTERNS.alone;
  if (state.money > 400 && state.isMarried) return SOUMATOU_PATTERNS.success;
  if (state.money < 0 || state.stress > 80) return SOUMATOU_PATTERNS.struggle;
  return SOUMATOU_PATTERNS.normal;
}

function fillSoumatouTemplate(text, state) {
  const incomeDescs = { '低所得': '低所得', '中所得': '中所得', '高所得': '高所得', '富裕層': '裕福な' };
  const partnerText = state.isMarried
    ? `${state.partnerName || 'パートナー'}と歩んだ長い道のり。それが何より大切だった。`
    : '一人で歩んだ長い道のり。孤独の中にも、確かな充実感があった。';
  return text
    .replace(/{age}/g, String(state.age))
    .replace(/{prefecture}/g, state.birthPrefecture || '日本')
    .replace(/{gender}/g, state.gender || 'ひとり')
    .replace(/{parentIncome}/g, incomeDescs[state.parentIncome] || '普通')
    .replace(/{school}/g, state.school || '学校')
    .replace(/{job}/g, state.jobData?.name || '無職')
    .replace(/{company}/g, state.company || state.jobData?.name || '職場')
    .replace(/{partner}/g, state.partnerName || 'あの人')
    .replace(/{partner_text}/g, partnerText);
}

function showSoumatouSequence(state) {
  return new Promise(resolve => {
    const pattern = selectSoumatouPattern(state);
    const overlay = document.createElement('div');
    overlay.className = 'soumatou-overlay';
    document.body.appendChild(overlay);

    // タイトル行
    const titleEl = document.createElement('div');
    titleEl.className = 'soumatou-line s-age';
    titleEl.textContent = `— 第${state.lifeCount}の人生　${state.age}歳 —`;
    overlay.appendChild(titleEl);

    const divEl = document.createElement('div');
    divEl.className = 'soumatou-divider';
    overlay.appendChild(divEl);

    // 各行を作成
    const lineEls = pattern.map(([text, highlight]) => {
      const el = document.createElement('p');
      el.className = `soumatou-line${highlight ? ' s-highlight' : ''}`;
      el.textContent = fillSoumatouTemplate(text, state);
      overlay.appendChild(el);
      return el;
    });

    const gsap = window.gsap;
    const tl = gsap.timeline({
      onComplete: () => {
        // 全行表示後、2秒待ってフェードアウト
        setTimeout(() => {
          gsap.to(overlay, {
            opacity: 0, duration: 1.2, ease: 'power2.in',
            onComplete: () => { overlay.remove(); resolve(); }
          });
        }, 2000);
      }
    });

    tl.from(titleEl, { opacity: 0, duration: 0.8, ease: 'power2.out' })
      .from(divEl, { opacity: 0, scaleX: 0, duration: 0.5 }, '-=0.3');

    lineEls.forEach((el, i) => {
      tl.from(el, { opacity: 0, y: 18, duration: 0.7, ease: 'power2.out' }, `+=${i === 0 ? 0.3 : 0.6}`);
    });
  });
}

// ══════════════════════════════════════════════════════════════
//  レンダリング
// ══════════════════════════════════════════════════════════════

function numToGrade(val) {
  if (!val) return '—';
  if (val >= 85) return 'S';
  if (val >= 70) return 'A';
  if (val >= 50) return 'B';
  if (val >= 35) return 'C';
  return 'D';
}
function gradeColor(g) {
  return { S: '#f59e0b', A: '#22c55e', B: '#3b82f6', C: '#f97316', D: '#ef4444', '—': '#8888bb' }[g] || '#8888bb';
}
function setGrade(id, val, show = true) {
  const el = $(id); if (!el) return;
  const g = show ? numToGrade(val) : '—';
  el.textContent = g;
  el.style.color = gradeColor(g);
}

function renderAll(state) {
  $('stat-age').textContent    = state.age;
  $('stat-health').textContent = Math.round(state.health);
  $('stat-stress').textContent = Math.round(state.stress);
  $('stat-intellect').textContent = state.intellect;
  $('stat-effort').textContent    = state.effort;
  $('stat-money').textContent     = Math.round(state.money).toLocaleString();
  $('life-count').textContent     = state.lifeCount;

  setGrade('stat-appearance', state.appearance, true);
  setGrade('stat-academic',   state.academic,   state.age >= 10);
  setGrade('stat-athletic',   state.athletic,   state.age >= 8);

  // 出生地（具体的な地名のみ）
  const region = $('stat-region');
  if (region) {
    region.textContent = state.birthPrefecture
      ? `${state.birthPrefecture} ${state.birthCity || ''}`.trim()
      : '—';
  }

  // 現在地（出生地と異なる場合のみ表示）
  const currentRow = $('stat-current-row');
  const currentRegion = $('stat-current-region');
  if (currentRow && currentRegion) {
    if (state.currentPrefecture && state.currentPrefecture !== state.birthPrefecture) {
      currentRegion.textContent = `${state.currentPrefecture} ${state.currentCity || ''}`.trim();
      currentRow.style.display = '';
    } else {
      currentRow.style.display = 'none';
    }
  }

  if ($('stat-parent'))      $('stat-parent').textContent      = state.parentIncome || '—';
  if ($('stat-parentjob'))   $('stat-parentjob').textContent   = state.parentJob    || '—';
  if ($('stat-gender'))      $('stat-gender').textContent      = state.gender        || '—';
  if ($('stat-job'))         $('stat-job').textContent         = state.jobData ? state.jobData.name : '—';
  if ($('stat-company'))     $('stat-company').textContent     = state.company       || '—';
  if ($('stat-school'))      $('stat-school').textContent      = state.school        || '—';
  if ($('stat-married'))     $('stat-married').textContent     = state.isMarried ? `💍 ${state.partnerName || '既婚'}` : '独身';

  // 性格
  if ($('stat-personality')) {
    const pd = getPersonalityData(state.personality);
    $('stat-personality').textContent = pd ? `${pd.emoji} ${pd.label}` : '—';
  }

  const h = Math.round(state.health);
  const s = Math.min(Math.round(state.stress), 100);
  animateStatBar($('bar-health'), h);
  animateStatBar($('bar-stress'), s);

  updateVisuals(state.age);
  renderTimeline(state.history);
  updateSceneHeader(state);
}

const STAGES = [
  { maxAge: 5,   emoji: '👶', bgClass: 'stage-infant'  },
  { maxAge: 12,  emoji: '🧒', bgClass: 'stage-child'   },
  { maxAge: 18,  emoji: '🧑', bgClass: 'stage-teen'    },
  { maxAge: 40,  emoji: '🧑‍💼', bgClass: 'stage-adult' },
  { maxAge: 65,  emoji: '🧓', bgClass: 'stage-middle'  },
  { maxAge: 200, emoji: '👴', bgClass: 'stage-elder'   },
];

function updateVisuals(age) {
  const stage = STAGES.find(s => age <= s.maxAge) || STAGES[STAGES.length - 1];
  $('scene-bg').className = `scene-visual ${stage.bgClass}`;
}

const SCENE_NAMES = [
  { maxAge: 0,   name: '産声をあげた場所' },
  { maxAge: 5,   name: '子供部屋' },
  { maxAge: 12,  name: '小学校の廊下' },
  { maxAge: 15,  name: '中学校の教室' },
  { maxAge: 18,  name: '高校の窓際' },
  { maxAge: 22,  name: '大学のキャンパス' },
  { maxAge: 40,  name: 'オフィス' },
  { maxAge: 55,  name: '職場の会議室' },
  { maxAge: 65,  name: '自宅のリビング' },
  { maxAge: 200, name: '縁側のある部屋' },
];

function updateSceneHeader(state) {
  const sh = $('scene-header');
  if (!sh) return;
  const { age, jobData, company } = state;
  if (jobData && age >= 23 && age <= 60) {
    sh.textContent = company ? `${company} — ${jobData.name}` : `職場 — ${jobData.name}`;
  } else {
    const scn = SCENE_NAMES.find(s => age <= s.maxAge) || SCENE_NAMES[SCENE_NAMES.length - 1];
    sh.textContent = scn.name;
  }
}

function renderTimeline(history) {
  $('timeline').innerHTML = [...history].reverse().map(e => `
    <div class="timeline-entry">
      <span class="tl-icon">${e.icon || '📌'}</span>
      <span class="tl-age">${String(e.age).padStart(2, '0')}</span>
      <span class="tl-text">${e.text}</span>
    </div>`).join('');
}

// ─── 死亡・人生スコア画面 ─────────────────────────────────────
function showDeathScreen(state) {
  const score   = calcLifeScore(state);
  const grade   = lifeScoreGrade(score);
  const records = getLifeRecords();

  const quotePool = Array.isArray(_quotes) ? _quotes : [];
  const quote = quotePool.length ? quotePool[Math.floor(Math.random() * quotePool.length)] : null;

  const agePct    = Math.min(100, Math.round(state.age / 82 * 100));
  const moneyPct  = Math.min(100, Math.round(Math.max(0, state.money) / 2000 * 100));
  const mentalPct = Math.round(100 - Math.min(state.stress, 100));
  const healthPct = Math.round(state.health);

  const tweetText = `【走馬灯ボタン】第${state.lifeCount}の人生 / ${grade.grade}評価「${grade.label}」/ ${state.age}歳没 / 死因:${state.deathCause} / スコア${Math.round(score)}点 #走馬灯ボタン`;
  const shareUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

  $('death-message').innerHTML = `
    <div class="ds-header">
      <div class="ds-grade" style="color:${grade.color}">${grade.grade}</div>
      <div class="ds-grade-label">${grade.label}</div>
      <div class="ds-score">${Math.round(score)}<span>点</span></div>
      <div class="ds-death-info">${state.age}歳 ／ 死因：${state.deathCause}</div>
      ${quote ? `
      <div class="ds-quote">
        <div class="ds-quote-text">「${quote.text}」</div>
        <div class="ds-quote-author">— ${quote.author}</div>
      </div>` : ''}
    </div>
    <div class="ds-bars">
      ${dsBar('寿命', agePct,    `${state.age}歳`)}
      ${dsBar('資産', moneyPct,  `${Math.round(state.money).toLocaleString()}万`)}
      ${dsBar('健康', healthPct, `${Math.round(state.health)}`)}
      ${dsBar('心の余裕', mentalPct, `${mentalPct}`, mentalPct < 30)}
    </div>
    <div class="ds-career">
      <div class="ds-career-row"><span>💼 職業</span><strong>${state.jobData ? state.jobData.name : '無職'}</strong></div>
      ${state.company ? `<div class="ds-career-row"><span>🏢 会社</span><strong>${state.company}</strong></div>` : ''}
      ${state.school  ? `<div class="ds-career-row"><span>🎓 出身校</span><strong>${state.school}</strong></div>` : ''}
      <div class="ds-career-row"><span>💰 生涯収入</span><strong>${Math.round(state.lifetimeEarnings).toLocaleString()}万円</strong></div>
      <div class="ds-career-row"><span>💍 婚姻</span><strong>${state.isMarried ? `既婚（${state.partnerName || 'パートナー'}）` : '独身'}</strong></div>
      <div class="ds-career-row"><span>💕 恋愛</span><strong>${state.datingCount || 0}人と交際</strong></div>
      <div class="ds-career-row"><span>👶 子ども</span><strong>${(state.hasChildren || 0) > 0 ? 'あり' : 'なし'}</strong></div>
    </div>
    <div class="ds-records">
      <div class="ds-records-title">🏆 自己記録</div>
      <div class="ds-records-grid">
        <div><span>最長寿命</span><strong>${records.bestAge}歳</strong></div>
        <div><span>最高資産</span><strong>${records.bestMoney.toLocaleString()}万円</strong></div>
        <div><span>最高スコア</span><strong>${records.bestScore}点</strong></div>
        <div><span>通算</span><strong>${state.lifeCount}回目</strong></div>
      </div>
    </div>
    <a class="ds-share-btn" href="${shareUrl}" target="_blank" rel="noopener">𝕏 Xでシェア</a>
  `;

  const nl = $('narrative-log');
  if (nl) nl.style.display = 'none';
  $('death-screen').classList.remove('hidden');
  launchParticles('death');
  animateDeathReveal();
}

function dsBar(label, pct, val, isLow = false) {
  return `
    <div class="ds-bar-row">
      <span class="ds-bar-label">${label}</span>
      <div class="ds-bar-track">
        <div class="ds-bar-fill ${isLow ? 'bar-low' : ''}" style="width:${pct}%"></div>
      </div>
      <span class="ds-bar-val">${val}</span>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
//  パーティクル & 演出
// ══════════════════════════════════════════════════════════════

const PARTICLE_CONFIGS = {
  sss:     { count: 60, colors: ['#ffd700','#ff6b6b','#a855f7','#22c55e','#3b82f6','#f59e0b'], size: [8, 18], life: 2400 },
  gold:    { count: 35, colors: ['#ffd700','#fbbf24','#f59e0b','#fffbeb'], size: [6, 14], life: 1800 },
  silver:  { count: 20, colors: ['#94a3b8','#cbd5e1','#e2e8f0','#fff'], size: [5, 11], life: 1600 },
  success: { count: 25, colors: ['#22c55e','#86efac','#ffd700','#fff'], size: [5, 12], life: 1600 },
  failure: { count: 15, colors: ['#64748b','#94a3b8','#cbd5e1'], size: [4, 10], life: 1200 },
  death:   { count: 18, colors: ['#fda4af','#fecdd3','#fbbf24','#fff'], size: [6, 14], life: 3000, fall: true },
};

function launchParticles(type) {
  const cfg = PARTICLE_CONFIGS[type]; if (!cfg) return;
  const container = $('particles'); if (!container) return;
  for (let i = 0; i < cfg.count; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.className = 'particle';
      const color = cfg.colors[Math.floor(Math.random() * cfg.colors.length)];
      const size  = cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0]);
      const x     = 10 + Math.random() * 80;
      const vx    = (Math.random() - 0.5) * 140;
      const vy    = cfg.fall ? -(80 + Math.random() * 60) : -(120 + Math.random() * 200);
      const rot   = Math.random() * 720 - 360;
      const shape = Math.random() > 0.5 ? '50%' : '3px';
      p.style.cssText = `
        left:${x}vw; top:${cfg.fall ? '-20px' : '60vh'};
        width:${size}px; height:${size}px;
        background:${color}; border-radius:${shape};
        --vx:${vx}px; --vy:${vy}px; --rot:${rot}deg;
        animation:particleFly ${cfg.life}ms ease-out forwards;
      `;
      container.appendChild(p);
      setTimeout(() => p.remove(), cfg.life + 100);
    }, i * (type === 'sss' ? 25 : 40));
  }
}

// ─── エフェクト表示 ───────────────────────────────────────────
function formatEffect(effect) {
  const map = {
    health:        { label: '健康度',   positive: true  },
    stress:        { label: 'ストレス', positive: false },
    money:         { label: '所持金',   positive: true,  suffix: '万' },
    intellect:     { label: '知性',     positive: true  },
    effort:        { label: '努力',     positive: true  },
    appearance:    { label: '容姿',     positive: true  },
    academic:      { label: '学力',     positive: true  },
    athletic:      { label: '運動',     positive: true  },
    datingCount:   { label: '交際数',   positive: true  },
    lifetimeEarnings: null,
    hasChildren: null,
    luck: null,
    isMarried: null,
  };
  return Object.entries(effect)
    .filter(([k]) => map[k])
    .map(([k, v]) => {
      const m = map[k]; if (!m) return '';
      const good = m.positive ? v > 0 : v < 0;
      return `<span class="ef-vn ${good ? 'ef-good' : 'ef-bad'}">【${m.label}】${v > 0 ? '+' : ''}${v}${m.suffix || ''}</span>`;
    }).join(' ');
}
