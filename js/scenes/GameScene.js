import {
  rollBirth, advanceYear, chooseTurningPoint,
  checkChoiceAvailability, calcLifeScore, calcBirthRarity,
  getNarrative, getRandomMidgameQuote,
  getPersonalityData, generateFirstLoveName,
} from '../gameEngine.js';
import { getState, setState, saveLifeRecords } from '../state.js';

// 文字幅推定による日本語テキスト事前折り返し
function wrapJP(str, maxPx, sizePx = 16) {
  if (!str) return '';
  const lines = [];
  let line = '';
  let lineW = 0;
  for (const ch of str) {
    if (ch === '\n') { lines.push(line); line = ''; lineW = 0; continue; }
    const cp = ch.codePointAt(0);
    const isWide = (cp >= 0x3000 && cp <= 0x9FFF) ||
                   (cp >= 0xF900 && cp <= 0xFAFF) ||
                   (cp >= 0xFF00 && cp <= 0xFFEF);
    const cw = isWide ? sizePx * 1.1 : sizePx * 0.58;
    if (lineW + cw > maxPx && line.length > 0) {
      lines.push(line);
      line = ch;
      lineW = cw;
    } else {
      line += ch;
      lineW += cw;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

// ── レイアウト定数 ──────────────────────────────────────────────
const LW = 300;          // 左カラム幅
const RW = 280;          // 右カラム幅
const CX = LW;           // 中央カラム開始X
const CW = 1280 - LW - RW; // 中央カラム幅 = 700
const RX = 1280 - RW;    // 右カラム開始X
const BANNER_H = 180;    // シーンバナー高さ
const BOT_H = 52;        // ボトムバー高さ
const LOG_Y = BANNER_H;
const LOG_H = 720 - BANNER_H - BOT_H; // = 488

// ── カラーパレット ──────────────────────────────────────────────
const C = {
  bg:       0x0c0c18,
  surface:  0x14142a,
  surface2: 0x1e1e38,
  border:   0x2a2a50,
  border2:  0x3a3a6a,
  text:     '#e8e8f4',
  muted:    '#8888bb',
  primary:  0x7c3aed,
  primaryL: '#a78bfa',
  accent:   '#f472b6',
  safe:     0x22c55e,
  warning:  0xf59e0b,
  danger:   0xef4444,
};

// ── ステージ設定 ────────────────────────────────────────────────
const STAGES = [
  { maxAge: 5,   key: 'scene-infant' },
  { maxAge: 12,  key: 'scene-child'  },
  { maxAge: 18,  key: 'scene-teen'   },
  { maxAge: 40,  key: 'scene-adult'  },
  { maxAge: 65,  key: 'scene-middle' },
  { maxAge: 200, key: 'scene-elder'  },
];

function stageFor(age) {
  return STAGES.find(s => age <= s.maxAge) || STAGES[STAGES.length - 1];
}

const SCENE_NAMES = [
  { maxAge: 0,   name: '産声をあげた場所'  },
  { maxAge: 5,   name: '子供部屋'          },
  { maxAge: 12,  name: '小学校の廊下'      },
  { maxAge: 15,  name: '中学校の教室'      },
  { maxAge: 18,  name: '高校の窓際'        },
  { maxAge: 22,  name: '大学のキャンパス'  },
  { maxAge: 40,  name: 'オフィス'          },
  { maxAge: 55,  name: '職場の会議室'      },
  { maxAge: 65,  name: '自宅のリビング'    },
  { maxAge: 200, name: '縁側のある部屋'    },
];

function sceneNameFor(state) {
  if (state.jobData && state.age >= 23 && state.age <= 60) {
    return state.company ? `${state.company} — ${state.jobData.name}` : `職場 — ${state.jobData.name}`;
  }
  return (SCENE_NAMES.find(s => state.age <= s.maxAge) || SCENE_NAMES[SCENE_NAMES.length - 1]).name;
}

const QUOTE_AGES = new Set([20, 30, 40, 50, 60, 70]);

export default class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'Game' }); }

  // ───────────────────────────────── create ──────────────────────
  create() {
    this._timer     = null;
    this._speed     = 1800;
    this._busy      = false;
    this._logHeight = 0; // ログ内容の累計高さ

    this._buildLayout();
    this._buildStatusPanel();
    this._buildCenterPanel();
    this._buildRightPanel();
    this._buildBottomBar();

    // EventScene から完了通知を受け取るグローバルイベント
    this.game.events.on('eventDone', this._onEventDone, this);

    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.time.delayedCall(450, () => this._newLife());
  }

  shutdown() {
    this.game.events.off('eventDone', this._onEventDone, this);
    this._stopTimer();
  }

  // ───────────────────────────────── レイアウト構築 ───────────────
  _buildLayout() {
    // ── 背景 ──
    this.add.rectangle(LW / 2,          360, LW,   720, C.surface);
    this.add.rectangle(CX + CW / 2,     360, CW,   720, C.bg);
    this.add.rectangle(RX + RW / 2,     360, RW,   720, C.surface);

    // ── 縦ボーダー ──
    this._drawLine(LW,  0, LW,  720, C.border);
    this._drawLine(RX,  0, RX,  720, C.border);
  }

  _drawLine(x1, y1, x2, y2, color) {
    const g = this.add.graphics();
    g.lineStyle(1, color, 1);
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.strokePath();
  }

  // ───────────────────────────────── 左カラム ────────────────────
  _buildStatusPanel() {
    const pad = 14;
    let y = 0;

    // ヘッダー
    this.add.rectangle(LW / 2, 18, LW, 36, C.surface2);
    this._drawLine(0, 36, LW, 36, C.border);
    this.add.text(pad, 10, '人生カルテ', { fontFamily: '"DotGothic16"', fontSize: 15, color: C.muted });
    this._lifeCountBadge = this._badge(LW - pad, 10, '1回目', C.primary, 'right');
    y = 36;

    // アバター枠 ＋ 基本情報
    const avatarX = pad + 44, avatarY = y + 14 + 44;
    this.add.rectangle(avatarX, avatarY, 88, 88, C.surface2).setStrokeStyle(2, C.border2);
    // シルエット
    this.add.text(avatarX, avatarY - 8, '人', {
      fontFamily: 'sans-serif', fontSize: 40, color: 'rgba(255,255,255,0.12)',
    }).setOrigin(0.5);

    // 年齢
    this._ageNum = this.add.text(pad + 100, y + 20, '0', {
      fontFamily: '"DotGothic16"', fontSize: 42, color: C.text, fontStyle: 'bold',
    });
    this.add.text(pad + 148, y + 42, '歳', { fontFamily: '"DotGothic16"', fontSize: 18, color: C.muted });
    this._genderText = this.add.text(pad + 100, y + 72, '—', { fontFamily: '"Noto Sans JP"', fontSize: 16, color: C.primaryL, fontStyle: 'bold' });
    this._persText   = this.add.text(pad + 100, y + 96, '—', { fontFamily: '"Noto Sans JP"', fontSize: 14, color: '#f59e0b' });
    y += 110;

    // 所持金
    this._drawLine(0, y, LW, y, C.border);
    this.add.rectangle(LW / 2, y + 20, LW, 40, C.surface2);
    this._drawLine(0, y + 40, LW, y + 40, C.border);
    this.add.text(pad, y + 8, '💰 所持金', { fontFamily: '"Noto Sans JP"', fontSize: 14, color: C.muted });
    this._moneyText = this.add.text(LW - pad, y + 8, '— 万', {
      fontFamily: '"DotGothic16"', fontSize: 20, color: '#fbbf24', fontStyle: 'bold',
    }).setOrigin(1, 0);
    y += 40;

    // ヘルスバー / ストレスバー
    y = this._buildBar(y, '❤️ 健康',    C.safe,    '_healthBar',  '_healthNum');
    y = this._buildBar(y, '😓 ストレス', C.warning, '_stressBar', '_stressNum');

    // ── 情報行 ──
    this._drawLine(0, y + 4, LW, y + 4, C.border);
    y += 8;
    const rows = [
      ['出生地',  '_siRegion'],
      ['現在地',  '_siCurrent'],
      ['職業',    '_siJob'],
      ['会社',    '_siCompany'],
      ['学歴',    '_siSchool'],
      ['婚姻',    '_siMarried'],
      ['性格',    '_siPersonality'],
      ['親の収入','_siParent'],
    ];
    rows.forEach(([label, ref]) => {
      y = this._buildInfoRow(y, label, ref);
    });

    // ── 能力グレード ──
    this._drawLine(0, y + 4, LW, y + 4, C.border);
    y += 10;
    this.add.text(pad, y, 'STATS', { fontFamily: '"DotGothic16"', fontSize: 12, color: C.primaryL });
    y += 20;
    const grades = [['容姿', '_gAppear'], ['学力', '_gAcad'], ['運動', '_gAthl']];
    grades.forEach(([label, ref], i) => {
      const gx = pad + i * 88;
      this.add.text(gx, y, label, { fontFamily: '"Noto Sans JP"', fontSize: 13, color: C.muted });
      this[ref] = this.add.text(gx + 28, y, '—', { fontFamily: '"DotGothic16"', fontSize: 18, color: C.muted, fontStyle: 'bold' });
    });
    y += 30;

    // ── やり直しボタン ── （下端固定）
    const suiBtn = this._buildButton(LW / 2, 696, LW - pad * 2, 40, '人生やり直し', 0xef4444, 0.15, '#fca5a5');
    suiBtn.on('pointerdown', () => this._commitSuicide());
  }

  _buildBar(y, label, color, barRef, numRef) {
    const pad = 14, barX = pad, barY = y + 28, barW = LW - pad * 2, barH = 10;
    this.add.text(pad, y + 8, label, { fontFamily: '"Noto Sans JP"', fontSize: 14, color: C.muted });
    this[numRef] = this.add.text(LW - pad, y + 8, '100', { fontFamily: '"DotGothic16"', fontSize: 14, color: C.muted }).setOrigin(1, 0);
    this.add.rectangle(barX + barW / 2, barY, barW, barH, C.border2);
    this[barRef] = this.add.rectangle(barX, barY, barW, barH, color).setOrigin(0, 0.5);
    return y + 42;
  }

  _buildInfoRow(y, label, ref) {
    const pad = 14;
    this.add.text(pad, y + 5, label, { fontFamily: '"Noto Sans JP"', fontSize: 14, color: C.muted });
    this[ref] = this.add.text(LW - pad, y + 5, '—', {
      fontFamily: '"Noto Sans JP"', fontSize: 14, color: C.text, fontStyle: 'bold',
    }).setOrigin(1, 0);
    this._drawLine(0, y + 30, LW, y + 30, 0x1e1e38);
    return y + 30;
  }

  _badge(x, y, text, bgColor, align = 'left') {
    const t = this.add.text(x, y, text, {
      fontFamily: '"DotGothic16"', fontSize: 13, color: '#fff',
      backgroundColor: '#' + bgColor.toString(16).padStart(6, '0'),
      padding: { x: 8, y: 4 },
    }).setOrigin(align === 'right' ? 1 : 0, 0);
    return t;
  }

  _buildButton(cx, cy, w, h, label, color, alpha, textColor) {
    const btn = this.add.rectangle(cx, cy, w, h, color, alpha)
      .setStrokeStyle(1, color)
      .setInteractive({ useHandCursor: true });
    this.add.text(cx, cy, label, {
      fontFamily: '"DotGothic16"', fontSize: 15, color: textColor,
    }).setOrigin(0.5);
    btn.on('pointerover',  () => btn.setFillStyle(color, alpha * 2));
    btn.on('pointerout',   () => btn.setFillStyle(color, alpha));
    return btn;
  }

  // ───────────────────────────────── 中央カラム ──────────────────
  _buildCenterPanel() {
    // バナー部分
    this._bannerImg = this.add.image(CX + CW / 2, BANNER_H / 2, 'scene-infant')
      .setDisplaySize(CW, BANNER_H);
    // グラデーションオーバーレイ（下端ぼかし）
    const grad = this.add.graphics();
    grad.fillGradientStyle(0x000000, 0x000000, C.bg, C.bg, 0, 0, 0.8, 0.8);
    grad.fillRect(CX, BANNER_H - 60, CW, 60);
    // シーン名バッジ
    this._sceneBadgeBg = this.add.rectangle(CX + 10, 10, 200, 32, 0x0c0c18, 0.82).setOrigin(0, 0);
    this._sceneBadgeText = this.add.text(CX + 20, 15, '—', {
      fontFamily: '"DotGothic16"', fontSize: 16, color: C.muted,
    });

    // ── ログエリア ──────────────────────────────────────────
    this.add.rectangle(CX + CW / 2, LOG_Y + LOG_H / 2, CW, LOG_H, C.bg);
    this._drawLine(CX, LOG_Y, CX + CW, LOG_Y, C.border);

    // スクロール可能なコンテナ
    this._logContainer = this.add.container(CX + 16, LOG_Y + 8);
    this._logHeight = 0;

    // マスク（ログ領域でクリッピング）
    const maskGfx = this.make.graphics();
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(CX, LOG_Y, CW, LOG_H);
    this._logContainer.setMask(maskGfx.createGeometryMask());

    // スクロールホイール
    this.input.on('wheel', (_p, _o, _dx, dy) => {
      const newY = this._logContainer.y - dy * 0.6;
      const minY = LOG_Y + 8 - Math.max(0, this._logHeight - LOG_H + 20);
      const maxY = LOG_Y + 8;
      this._logContainer.y = Phaser.Math.Clamp(newY, minY, maxY);
    });
  }

  // ───────────────────────────────── 右カラム ────────────────────
  _buildRightPanel() {
    // ヘッダー
    this.add.rectangle(RX + RW / 2, 18, RW, 36, C.surface2);
    this._drawLine(RX, 36, RX + RW, 36, C.border);
    this.add.text(RX + 14, 10, '人生の歩み', { fontFamily: '"DotGothic16"', fontSize: 15, color: C.muted });

    // タイムラインコンテナ
    this._tlContainer = this.add.container(RX + 8, 44);
    this._tlHeight    = 0;

    const maskGfx2 = this.make.graphics();
    maskGfx2.fillStyle(0xffffff);
    maskGfx2.fillRect(RX, 36, RW, 684);
    this._tlContainer.setMask(maskGfx2.createGeometryMask());

    // スクロールホイール（右カラム）
    this.input.on('wheel', (_p, _o, _dx, dy, event) => {
      const ptr = this.input.activePointer;
      if (ptr.x < RX) return;
      const newY = this._tlContainer.y - dy * 0.6;
      const minY = 44 - Math.max(0, this._tlHeight - 684 + 10);
      this._tlContainer.y = Phaser.Math.Clamp(newY, minY, 44);
    });
  }

  // ───────────────────────────────── ボトムバー ──────────────────
  _buildBottomBar() {
    const botY = 720 - BOT_H;
    this.add.rectangle(CX + CW / 2, botY + BOT_H / 2, CW, BOT_H, C.surface);
    this._drawLine(CX, botY, CX + CW, botY, C.border);

    // スピードラベル
    this.add.text(CX + 14, botY + 14, 'SPEED', {
      fontFamily: '"DotGothic16"', fontSize: 13, color: C.muted,
    });

    // スピードボタン
    const speeds = [{ label: '▶▶▶', v: 600 }, { label: '▶▶', v: 1200 }, { label: '▶', v: 2000 }, { label: '⏸', v: 0 }];
    this._speedBtns = speeds.map((s, i) => {
      const bx = CX + 100 + i * 72, by = botY + 26;
      const bg = this.add.rectangle(bx, by, 62, 30, C.surface2)
        .setStrokeStyle(1, C.border2)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(bx, by, s.label, { fontFamily: '"DotGothic16"', fontSize: 14, color: C.muted }).setOrigin(0.5);
      bg.on('pointerdown', () => this._setSpeed(s.v));
      bg.on('pointerover',  () => { if (this._speed !== s.v) { bg.setStrokeStyle(1, C.primary); txt.setColor(C.primaryL); } });
      bg.on('pointerout',   () => { if (this._speed !== s.v) { bg.setStrokeStyle(1, C.border2); txt.setColor(C.muted); } });
      return { bg, txt, v: s.v };
    });
    this._setSpeedUI(1500);

    // 履歴ボタン（今は無効化、ログが中央に見えているため）
    // 将来拡張用
  }

  // ───────────────────────────────── ゲームロジック ──────────────
  async _newLife() {
    this._stopTimer();
    this._busy = false;
    this._logHeight = 0;
    this._logContainer.removeAll(true);
    this._logContainer.y = LOG_Y + 8;
    this._tlHeight = 0;
    this._tlContainer.removeAll(true);
    this._tlContainer.y = 44;

    const state = rollBirth();
    this._renderStatus(state);
    this._appendLog(0, '人生が始まった。', 'normal');

    await this._showEvent('birth', { state });
    this._startTimer();
  }

  _startTimer() {
    this._stopTimer();
    if (this._speed === 0) return;
    this._timer = this.time.addEvent({
      delay: this._speed,
      callback: () => { if (!this._busy) this._tick(); },
      loop: true,
    });
  }

  _stopTimer() {
    if (this._timer) { this._timer.remove(); this._timer = null; }
  }

  _setSpeed(v) {
    this._speed = v;
    this._setSpeedUI(v);
    this._stopTimer();
    if (getState().isAlive) this._startTimer();
  }

  _setSpeedUI(v) {
    this._speedBtns?.forEach(b => {
      const active = b.v === v;
      b.bg.setFillStyle(active ? C.primary : C.surface2, active ? 0.35 : 1);
      b.bg.setStrokeStyle(1, active ? C.primary : C.border2);
      b.txt.setColor(active ? C.primaryL : C.muted);
    });
  }

  async _tick() {
    if (this._busy || !getState().isAlive) return;
    this._busy = true;
    this._stopTimer();

    try {
      const result = advanceYear();
      const state  = result.state;

      const narrative = getNarrative(state.age, state);
      if (narrative) this._appendLog(state.age, narrative, 'normal');

      this._renderStatus(state);

      // 名言
      if (QUOTE_AGES.has(state.age)) {
        const q = getRandomMidgameQuote();
        if (q) await this._showEvent('quote', { quote: q });
      }

      // 性格開示ログ
      if (result.personalityRevealed) {
        const ps = getState();
        const pd3 = getPersonalityData(ps.personality);
        this._appendLog(state.age,
          `✨ あなたの性格が確立した：${pd3 ? `${pd3.emoji} ${pd3.label}` : '不明'}`,
          'tp');
        this._renderStatus(ps);
      }

      // カルマ
      if (result.events.length > 0) {
        result.events.forEach(e => {
          this._appendLog(state.age, `【カルマ】${e.description}`, e.tone === 'good' ? 'karma-good' : 'karma-bad');
        });
        await this._showEvent('karma', { events: result.events });
        this._renderStatus(getState());
      }

      // 死亡
      if (result.isDead) {
        this._appendLog(state.age, `💀 ${state.deathCause}`, 'death');
        this._stopTimer();
        saveLifeRecords(calcLifeScore(state));
        this.time.delayedCall(600, () => {
          this.scene.start('Soumatou', { state });
        });
        return;
      }

      // ターニングポイント
      if (result.turningPoint) {
        this._appendLog(state.age, `⚡ ターニングポイント：${result.turningPoint.title}`, 'tp');
        const tpResult = await this._showEvent('tp', { tp: result.turningPoint, state });
        this._renderStatus(getState());
        if (tpResult?.hasRoll || result.turningPoint?.firstLoveTP) {
          await this._showEvent('result', { result: tpResult });
        }
        if (!getState().isAlive) {
          this.scene.start('Soumatou', { state: getState() });
          return;
        }
      }
    } finally {
      this._busy = false;
      if (getState().isAlive) this._startTimer();
    }
  }

  _commitSuicide() {
    if (!getState().isAlive) return;
    this._stopTimer();
    const s = getState();
    const score = calcLifeScore(s);
    saveLifeRecords(score);
    setState({ isAlive: false, deathCause: '自殺' });
    this._appendLog(s.age, '💊 自ら人生に幕を下ろした。', 'death');
    this.time.delayedCall(600, () => this.scene.start('Soumatou', { state: getState() }));
  }

  // ───────────────────────────────── ログ追加 ────────────────────
  _appendLog(age, text, type) {
    const ageStr = String(age).padStart(2, '0') + '歳';
    const colors = {
      normal:       '#c8c8e8',
      'karma-bad':  '#fca5a5',
      'karma-good': '#86efac',
      tp:           '#c4b5fd',
      death:        '#fca5a5',
      quote:        'rgba(255,255,255,0.7)',
    };

    // ── レイアウト定数（コンテナ内相対座標） ─────────────────────
    // _logContainer は (CX+16, LOG_Y+8) に置かれている
    // コンテナ内の利用可能幅 = CW - 16(左オフセット) - 16(右マージン) = CW - 32
    const CONT_W = CW - 32;   // コンテナ内利用可能幅
    const AGE_W  = 52;        // 年齢テキスト固定幅（枠の外）
    const PAD_X  = 10;        // 枠内左右余白
    const PAD_Y  = 7;         // 枠内上下余白
    const BOX_X  = AGE_W;                    // 枠の左端（コンテナ相対）
    const BOX_W  = CONT_W - AGE_W;          // 枠幅
    const MSG_X  = PAD_X;                    // テキスト左端（BOXコンテナ内相対）
    const MSG_W  = BOX_W - PAD_X * 2;       // テキスト最大幅（枠内寸）

    // ── 年齢テキスト（枠の外） ────────────────────────────────────
    const ageT = this.add.text(4, PAD_Y, ageStr, {
      fontFamily: '"DotGothic16"', fontSize: 14, color: C.primaryL,
    });

    // ── 本文テキスト（_wrapJP で事前折り返し＋枠内に配置） ────────
    // Phaser wordWrap は日本語スペースなし文字列に機能しないため使わない
    const wrapped = wrapJP(text, MSG_W, 15);
    const mainT = this.add.text(BOX_X + MSG_X, PAD_Y, wrapped, {
      fontFamily: '"Noto Sans JP"', fontSize: 15, color: colors[type] || colors.normal,
      lineSpacing: 3,
    });

    const rowH = mainT.height + PAD_Y * 2;

    // ── カルマ/TP 用枠（Graphics 先に add → テキストが前面） ──────
    if (type === 'karma-bad' || type === 'karma-good' || type === 'tp') {
      const borderColor = type === 'karma-bad' ? 0xef4444 : type === 'karma-good' ? 0x22c55e : 0x7c3aed;
      const g = this.add.graphics();
      // 枠は BOX_X=0 から BOX_W 幅で描画（BOXコンテナ内相対）
      g.fillStyle(borderColor, 0.07);
      g.fillRoundedRect(BOX_X, 0, BOX_W, rowH, 4);
      g.lineStyle(1.5, borderColor, 0.85);
      g.strokeRoundedRect(BOX_X, 0, BOX_W, rowH, 4);
      // 行コンテナに追加（Graphics 背面、テキスト 前面）
      const rowContainer = this.add.container(0, this._logHeight, [g, ageT, mainT]);
      rowContainer.setAlpha(0);
      this._logContainer.add(rowContainer);
      this._logHeight += rowH + 6;
      this.tweens.add({ targets: rowContainer, alpha: 1, duration: 280, ease: 'Power2' });
      return;
    }

    // 通常行（枠なし）
    const rowContainer = this.add.container(0, this._logHeight, [ageT, mainT]);
    rowContainer.setAlpha(0);
    this._logContainer.add(rowContainer);
    this._logHeight += rowH + 6;

    // フェードイン
    this.tweens.add({ targets: rowContainer, alpha: 1, duration: 280, ease: 'Power2' });

    // スクロール
    const overflow = this._logHeight - LOG_H + 20;
    if (overflow > 0) {
      this.tweens.add({
        targets: this._logContainer,
        y: LOG_Y + 8 - overflow,
        duration: 200,
        ease: 'Power2',
      });
    }
  }

  // ───────────────────────────────── ステータス描画 ──────────────
  _renderStatus(state) {
    this._ageNum.setText(`${state.age}`);
    this._genderText.setText(state.gender || '—');
    const pd = state.personalityRevealed ? getPersonalityData(state.personality) : null;
    this._persText.setText(state.personalityRevealed
      ? (pd ? `${pd.emoji} ${pd.label}` : '—')
      : '🔒 ？？？');

    this._moneyText.setText(`${Math.round(state.money).toLocaleString()} 万`);
    this._lifeCountBadge.setText(`${state.lifeCount}回目`);

    // バー
    const maxW = LW - 28;
    this._healthBar.width = Math.max(0, maxW * state.health / 100);
    this._stressBar.width = Math.max(0, maxW * Math.min(state.stress, 100) / 100);
    this._healthNum.setText(`${Math.round(state.health)}`);
    this._stressNum.setText(`${Math.round(state.stress)}`);

    this._siRegion.setText(state.birthPrefecture ? `${state.birthPrefecture} ${state.birthCity || ''}`.trim() : '—');
    const cur = state.currentPrefecture && state.currentPrefecture !== state.birthPrefecture
      ? `${state.currentPrefecture} ${state.currentCity || ''}`.trim() : '—';
    this._siCurrent.setText(cur);
    this._siJob.setText(state.jobData?.name || '—');
    this._siCompany.setText(state.company || '—');
    this._siSchool.setText(state.school || '—');
    this._siMarried.setText(state.isMarried ? `💍 ${state.partnerName || '既婚'}` : '独身');
    const pd2 = state.personalityRevealed ? getPersonalityData(state.personality) : null;
    this._siPersonality.setText(state.personalityRevealed
      ? (pd2 ? `${pd2.emoji} ${pd2.label}` : '—')
      : '？？？（未確立）');
    this._siParent.setText(`${state.parentIncome || '—'}`);

    // グレード
    const g = (v, show) => { if (!show) return '—'; if (v >= 85) return 'S'; if (v >= 70) return 'A'; if (v >= 50) return 'B'; if (v >= 35) return 'C'; return 'D'; };
    const gc = { S: '#f59e0b', A: '#22c55e', B: '#3b82f6', C: '#f97316', D: '#ef4444', '—': C.muted };
    const ga = g(state.appearance, true);    this._gAppear.setText(ga).setColor(gc[ga] || C.muted);
    const gb = g(state.academic, state.age >= 10); this._gAcad.setText(gb).setColor(gc[gb] || C.muted);
    const gg = g(state.athletic, state.age >= 8);  this._gAthl.setText(gg).setColor(gc[gg] || C.muted);

    // シーン画像
    const stageKey = stageFor(state.age).key;
    if (this.textures.exists(stageKey)) {
      this._bannerImg.setTexture(stageKey);
    }
    this._sceneBadgeText.setText(sceneNameFor(state));
    this._sceneBadgeBg.width = this._sceneBadgeText.width + 20;

    // タイムライン
    this._renderTimeline(state.history);
  }

  _renderTimeline(history) {
    this._tlContainer.removeAll(true);
    this._tlHeight = 0;
    const entries = [...history].reverse();
    entries.forEach((e, _i) => {
      const y = this._tlHeight;
      // 背景
      const bg = this.add.rectangle(RW / 2 - 8, y + 20, RW - 20, 40, C.surface2).setOrigin(0.5);
      const icon = this.add.text(4, y + 8, e.icon || '📌', { fontFamily: 'sans-serif', fontSize: 16 });
      const age  = this.add.text(28, y + 9, String(e.age).padStart(2, '0'), {
        fontFamily: '"DotGothic16"', fontSize: 15, color: C.primaryL, fontStyle: 'bold',
      });
      const txt  = this.add.text(58, y + 9, wrapJP(e.text, RW - 80, 13), {
        fontFamily: '"Noto Sans JP"', fontSize: 13, color: C.muted,
      });
      this._tlContainer.add([bg, icon, age, txt]);
      this._tlHeight += Math.max(40, txt.height + 14);
    });
  }

  // ───────────────────────────────── EventScene 連携 ─────────────
  _showEvent(type, data) {
    // birth 以外は少し遅らせてからモーダルを表示（演出のため）
    const delay = type === 'birth' ? 0 : type === 'result' ? 200 : 500;
    return new Promise(resolve => {
      this._eventResolve = resolve;
      this.time.delayedCall(delay, () => {
        this.scene.launch('Event', { type, ...data });
      });
    });
  }

  _onEventDone(result) {
    if (this._eventResolve) {
      const fn = this._eventResolve;
      this._eventResolve = null;
      fn(result);
    }
  }
}
