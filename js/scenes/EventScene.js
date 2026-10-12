import {
  calcBirthRarity, getPersonalityData, checkChoiceAvailability,
  chooseTurningPoint, generateFirstLoveName, getPrefectureProbability,
} from '../gameEngine.js';

const C = {
  bg:      0x0c0c18,
  surface: 0x14142a,
  surface2:0x1e1e38,
  border:  0x2a2a50,
  border2: 0x3a3a6a,
  primary: 0x7c3aed,
  danger:  0xef4444,
  safe:    0x22c55e,
  warning: 0xf59e0b,
  text:    '#e8e8f4',
  muted:   '#8888bb',
  primaryL:'#a78bfa',
};

function done(scene, result = null) {
  scene.tweens.add({
    targets: scene.cameras.main,
    alpha: 0,
    duration: 220,
    onComplete: () => {
      scene.scene.stop();
      scene.game.events.emit('eventDone', result);
    },
  });
}

export default class EventScene extends Phaser.Scene {
  constructor() { super({ key: 'Event', active: false }); }

  init(data) { this._data = data; }

  create() {
    const W = 1280, H = 720;
    this.cameras.main.setAlpha(0);
    this.cameras.main.setZoom(0.97);
    this.tweens.add({
      targets: this.cameras.main,
      alpha: 1,
      zoom: 1.0,
      duration: 280,
      ease: 'Power2',
    });

    // オーバーレイ
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72);

    switch (this._data.type) {
      case 'birth':  this._showBirth(this._data.state);  break;
      case 'karma':  this._showKarma(this._data.events); break;
      case 'tp':     this._showTP(this._data.tp, this._data.state); break;
      case 'result': this._showResult(this._data.result); break;
      case 'quote':  this._showQuote(this._data.quote);  break;
    }
  }

  // ─────────────────────── 共通パネル ───────────────────────────
  _panel(w, h, color = C.surface, borderColor = C.primary) {
    const W = 1280, H = 720;
    const g = this.add.graphics();
    g.fillStyle(color);
    g.fillRoundedRect(W / 2 - w / 2, H / 2 - h / 2, w, h, 12);
    g.lineStyle(2, borderColor);
    g.strokeRoundedRect(W / 2 - w / 2, H / 2 - h / 2, w, h, 12);
    return { x: W / 2 - w / 2, y: H / 2 - h / 2, w, h, cx: W / 2, cy: H / 2 };
  }

  // 文字幅推定による日本語テキスト事前折り返し（Canvas 2D フォント不要）
  _wrapJP(str, maxPx, sizePx = 16) {
    if (!str) return '';
    const lines = [];
    let line = '';
    let lineW = 0;
    for (const ch of str) {
      if (ch === '\n') { lines.push(line); line = ''; lineW = 0; continue; }
      const cp = ch.codePointAt(0);
      // ひらがな・カタカナ・CJK・全角記号 ≈ 1em、その他 ≈ 0.58em
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

  _text(x, y, str, opts = {}) {
    return this.add.text(x, y, str, {
      fontFamily: opts.font === 'game' ? '"DotGothic16"' : '"Noto Sans JP"',
      fontSize: opts.size || 18,
      color: opts.color || C.text,
      fontStyle: opts.bold ? 'bold' : 'normal',
      lineSpacing: 4,
      ...opts.extra,
    }).setOrigin(opts.origin || 0, 0);
  }

  _okBtn(cx, y, label, color = C.primary, callback) {
    const W = 320, H = 48;
    const bg = this.add.rectangle(cx, y, W, H, color, 0.25)
      .setStrokeStyle(1, color)
      .setInteractive({ useHandCursor: true });
    const t = this._text(cx, y, label, { size: 17, font: 'game', origin: 0.5, color: C.text });
    t.setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(color, 0.45));
    bg.on('pointerout',  () => bg.setFillStyle(color, 0.25));
    bg.on('pointerdown', callback);
    return bg;
  }

  // ─────────────────────── ① 誕生 ───────────────────────────────
  _showBirth(state) {
    const rarity = calcBirthRarity(state);
    const p = this._panel(560, 540, C.surface, C.primary);

    const rarityMeta = {
      SSS: { label: '👑 SSS — 資産家の孫', color: '#ffd700' },
      SS:  { label: '💎 SS — 富裕層',      color: '#ffd700' },
      S:   { label: '✨ S — 高所得エリート', color: '#60a5fa' },
      A:   { label: '🌟 A — 高所得',        color: '#22c55e' },
      B:   { label: '📘 B — 中所得',        color: C.muted   },
      C:   { label: '📉 C — 低所得',        color: '#f59e0b' },
      D:   { label: '💔 D — 極貧',          color: '#ef4444' },
    };
    const rm = rarityMeta[rarity] || rarityMeta['B'];

    // ヘッダー
    const hg = this.add.graphics();
    hg.fillStyle(0x1a0a3a);
    hg.fillRoundedRect(p.x, p.y, p.w, 64, { tl: 12, tr: 12, bl: 0, br: 0 });
    this._text(p.cx, p.y + 16, '🎲 あなたの人生ガチャ', { font: 'game', size: 20, origin: 0.5 }).setOrigin(0.5);

    let y = p.y + 76;

    // レアリティ
    this._text(p.cx, y, rm.label, { size: 22, bold: true, color: rm.color, origin: 0.5 }).setOrigin(0.5);
    y += 40;

    // 性格は途中から判明するので誕生時は非表示

    // ステータスバー
    [['🧠 知性', state.intellect], ['💪 努力値', state.effort], ['✨ 容姿', state.appearance]].forEach(([lbl, val]) => {
      this._text(p.x + 24, y, lbl, { size: 15, color: C.muted });
      const bw = 260, bh = 10, bx = p.x + 130, by = y + 8;
      this.add.rectangle(bx + bw / 2, by, bw, bh, 0x1e1e38);
      const fc = val >= 70 ? 0x22c55e : val >= 40 ? 0x3b82f6 : 0xef4444;
      this.add.rectangle(bx, by, bw * val / 100, bh, fc).setOrigin(0, 0.5);
      this._text(bx + bw + 10, y, `${val}`, { size: 15, bold: true });
      y += 30;
    });
    y += 8;

    // 出生情報
    const loc = state.birthPrefecture ? `${state.birthPrefecture} ${state.birthCity || ''}`.trim() : '不明';
    const prefProb = getPrefectureProbability(state.birthPrefecture);
    const birthRaw = `📍 ${loc}  ／  👨‍👩‍👦 ${state.parentIncome}家庭  ／  ${state.gender}`;
    const bt = this._text(p.x + 24, y, this._wrapJP(birthRaw, p.w - 48, 15), { size: 15, color: C.muted });
    y += bt.height + 6;
    if (prefProb) {
      this._text(p.x + 24, y,
        `🗾 ${state.birthPrefecture}に生まれる確率：${prefProb}%`,
        { size: 13, color: '#6366f1' });
      y += 24;
    }
    y += 12;

    // OK
    this._okBtn(p.cx, p.y + p.h - 36, '▶  人生をスタート！', C.primary, () => done(this));

    // 演出
    if (rarity === 'SSS' || rarity === 'SS') this._burst(rarity);
  }

  // ─────────────────────── ② カルマ ──────────────────────────────
  _showKarma(events) {
    let idx = 0;
    const render = () => {
      this.children.removeAll(true);
      this.add.rectangle(640, 360, 1280, 720, 0x000000, 0.72);

      const e = events[idx];
      const isGood = e.tone === 'good';
      const borderC = isGood ? C.safe : C.danger;
      const p = this._panel(540, 460, C.surface, borderC);

      // ヘッダー
      const hg = this.add.graphics();
      hg.fillStyle(isGood ? 0x0a1a0a : 0x1a0a0a);
      hg.fillRoundedRect(p.x, p.y, p.w, 64, { tl: 12, tr: 12, bl: 0, br: 0 });

      // 説明（動的高さ）
      const PAD = 24;
      const innerW = p.w - PAD * 2;

      const badge = isGood ? '✨ KARMA GOOD' : '⚡ KARMA BAD';
      this._text(p.cx, p.y + 10, badge, { font: 'game', size: 14, color: isGood ? '#86efac' : '#fca5a5', origin: 0.5 }).setOrigin(0.5);
      this._text(p.x + PAD, p.y + 30,
        this._wrapJP(e.label, innerW, 20),
        { size: 20, bold: true });
      let y = p.y + 78;
      const dt = this._text(p.x + PAD, y,
        this._wrapJP(e.description, innerW, 16),
        { size: 16, color: C.muted });
      y += dt.height + 18;

      // 効果チップ（行折り返し）
      const chipGap = 12;
      const maxRight = p.x + p.w - PAD;
      let chipX = p.x + PAD, chipY = y;
      Object.entries(e.effect || {}).forEach(([k, v]) => {
        if (v === 0 || v == null) return;
        const lbl = { health: '健康', stress: 'ストレス', money: '資産', intellect: '知性', effort: '努力', appearance: '容姿' }[k];
        if (!lbl) return;
        const isPos = k === 'stress' ? v < 0 : v > 0;
        const chip = `${lbl} ${v > 0 ? '+' : ''}${v}`;
        const ct = this._text(chipX, chipY, chip, { size: 15, bold: true, color: isPos ? '#86efac' : '#fca5a5' });
        if (chipX !== p.x + PAD && chipX + ct.width > maxRight) {
          chipY += 26;
          chipX = p.x + PAD;
          ct.setPosition(chipX, chipY);
        }
        chipX += ct.width + chipGap;
      });

      // カウンター
      if (events.length > 1) {
        this._text(p.cx, p.y + p.h - 72, `${idx + 1} / ${events.length}`, { size: 13, color: C.muted, origin: 0.5 }).setOrigin(0.5);
      }

      const nextLabel = idx < events.length - 1 ? '次へ →' : '続ける';
      this._okBtn(p.cx, p.y + p.h - 38, nextLabel, borderC, () => {
        idx++;
        if (idx < events.length) render();
        else done(this);
      });

      // カメラのフェードイン
      this.cameras.main.setAlpha(0);
      this.tweens.add({ targets: this.cameras.main, alpha: 1, duration: 180 });
    };
    render();
  }

  // ─────────────────────── ③ ターニングポイント ─────────────────
  // _wrapJP で改行済み文字列をテキスト仮生成して高さを実測
  _measureTextH(str, size, maxW) {
    const wrapped = this._wrapJP(str || '', maxW, size);
    const t = this.add.text(-9999, -9999, wrapped, {
      fontFamily: '"Noto Sans JP"', fontSize: size,
      lineSpacing: 3,
    });
    const h = t.height;
    t.destroy();
    return h;
  }

  _showTP(tp, state) {
    const W = 1280, H = 720;
    const isJob = tp.type === 'job_select';
    const PANEL_W = 580;
    const PAD = 20;
    const CPAD = 7;        // 選択肢内パディング
    const GAP  = 5;        // 選択肢間マージン
    const BOTTOM_PAD = 20; // 最終選択肢とパネル下端の余白
    const innerW = PANEL_W - PAD * 2;
    const MAX_H = Math.floor(H * 0.90);

    let loveText = '';
    if (tp.firstLoveTP) {
      const name = generateFirstLoveName(state);
      loveText = `\nクラスメートの「${name}」のことが頭から離れない。`;
    }

    // ── 選択肢フィルタリング（originalIdx を保持してインデックスズレを防ぐ）──
    const allChoices = checkChoiceAvailability(state, tp)
      .map((c, idx) => ({ ...c, originalIdx: idx }))
      .filter(c => c && c.label);
    const availChoices   = allChoices.filter(c =>  c.available);
    const unavailChoices = allChoices.filter(c => !c.available);
    const choices = availChoices.length === 0
      ? allChoices.slice(0, 5)
      : [...availChoices, ...unavailChoices.slice(0, 1)].slice(0, 5);

    // ── Pass 1: 全コンテンツの高さを _measureTextH で事前計算 ──────
    const HEADER_H = 52;
    let contentH = HEADER_H + 10;

    contentH += this._measureTextH(tp.title, 19, innerW) + 8;
    if (tp.description || loveText)
      contentH += this._measureTextH((tp.description || '') + loveText, 14, innerW) + 10;
    if (tp.stat)
      contentH += (this._measureTextH(tp.stat, 13, innerW) + 12) + 8;
    contentH += 4; // 選択肢直前の余白

    // 各選択肢の高さを事前計算（Pass 2 で同じ値を使い誤差をゼロにする）
    const choiceHeights = [];
    if (isJob) {
      const rows = Math.ceil(choices.length / 2);
      choiceHeights.push(rows * 88 - 6); // グリッド全体を1エントリで管理
    } else {
      choices.forEach(c => {
        const bonus = c.personalityBonus?.[state.personality] || 0;
        const pct = (c.successRate != null && c.successRate < 1)
          ? Math.round(Math.min(1, c.successRate + bonus) * 100) : null;
        const meta = [
          pct != null ? `成功率 ${pct}%` : '',
          c.stat || '',
          !c.available ? '⚠ 条件不足' : '',
        ].filter(Boolean).join('  ');
        const lh = this._measureTextH(c.label, 14, innerW);
        const mh = meta ? this._measureTextH(meta, 12, innerW) : 0;
        choiceHeights.push(Math.max(40, CPAD + lh + (mh > 0 ? mh + 3 : 0) + CPAD));
      });
      choiceHeights.forEach(h => { contentH += h + GAP; });
    }
    if (isJob) contentH += choiceHeights[0] + 12;
    contentH += BOTTOM_PAD;

    // ── パネルサイズ・位置確定 ─────────────────────────────────────
    const panelH = Math.min(MAX_H, Math.max(220, contentH));
    const panelX = W / 2 - PANEL_W / 2;
    const panelY = Math.max(8, Math.min(H - panelH - 8, H / 2 - panelH / 2));

    // ── Pass 2: 描画（背景 → テキストの順に add するため空枠は絶対に出ない）──
    // パネル背景
    const pg = this.add.graphics();
    pg.fillStyle(C.surface);
    pg.fillRoundedRect(panelX, panelY, PANEL_W, panelH, 12);
    pg.lineStyle(2, C.primary);
    pg.strokeRoundedRect(panelX, panelY, PANEL_W, panelH, 12);

    const p = { x: panelX, y: panelY, w: PANEL_W, cx: W / 2 };

    // ヘッダー背景
    const hg = this.add.graphics();
    hg.fillStyle(0x1a0a3a);
    hg.fillRoundedRect(p.x, p.y, p.w, HEADER_H, { tl: 12, tr: 12, bl: 0, br: 0 });
    this._text(p.cx, p.y + 10, '⚡ TURNING POINT', { font: 'game', size: 13, color: C.primaryL }).setOrigin(0.5);

    let y = p.y + HEADER_H + 10;

    // タイトル
    const titleT = this._text(p.x + PAD, y, this._wrapJP(tp.title, innerW, 19), { size: 19, bold: true });
    y += titleT.height + 8;

    // 説明文
    if (tp.description || loveText) {
      const dt = this._text(p.x + PAD, y,
        this._wrapJP((tp.description || '') + loveText, innerW, 14), { size: 14, color: C.muted });
      y += dt.height + 10;
    }

    // stat（背景 → テキストの順）
    if (tp.stat) {
      const statBgH = this._measureTextH(tp.stat, 13, innerW) + 12;
      const sg = this.add.graphics();
      sg.fillStyle(C.primary, 0.1);
      sg.fillRect(p.x + 16, y, p.w - 32, statBgH);
      this._text(p.x + PAD, y + 5, this._wrapJP(tp.stat, innerW, 13), { size: 13, color: C.primaryL });
      y += statBgH + 8;
    }
    y += 4;

    // 選択肢（jobグリッド／通常リスト）
    if (isJob) {
      const cols = 2, cardW = (p.w - 48) / cols, cardH = 82;
      choices.forEach((c, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const cx = p.x + 16 + col * (cardW + 8);
        const cy2 = y + row * (cardH + 6);
        const avail = c.available;
        // 背景先
        const bg = this.add.graphics();
        bg.fillStyle(avail ? C.surface2 : 0x0a0a18, avail ? 1 : 0.5);
        bg.lineStyle(1, avail ? C.border2 : C.border);
        bg.fillRoundedRect(cx, cy2, cardW, cardH, 8);
        bg.strokeRoundedRect(cx, cy2, cardW, cardH, 8);
        // テキスト後
        this._text(cx + 8, cy2 + 7, this._wrapJP(c.label, cardW - 16, 13),
          { size: 13, bold: true, color: avail ? C.text : C.muted });
        if (c.sublabel)
          this._text(cx + 8, cy2 + 28, this._wrapJP(c.sublabel, cardW - 16, 11), { size: 11, color: '#4ade80' });
        const pct = Math.round((c.acceptanceRate || c.successRate || 1) * 100);
        const rc = pct < 10 ? '#fca5a5' : pct < 30 ? '#fcd34d' : '#86efac';
        this._text(cx + 8, cy2 + 52, `採用率 ${pct}%`, { size: 12, color: rc });
        if (avail) {
          const drawCard = (lineColor, lineW) => {
            bg.clear();
            bg.fillStyle(C.surface2);
            bg.lineStyle(lineW, lineColor);
            bg.fillRoundedRect(cx, cy2, cardW, cardH, 8);
            bg.strokeRoundedRect(cx, cy2, cardW, cardH, 8);
          };
          bg.setInteractive(new Phaser.Geom.Rectangle(cx, cy2, cardW, cardH), Phaser.Geom.Rectangle.Contains)
            .on('pointerover', () => drawCard(C.primary, 2))
            .on('pointerout',  () => drawCard(C.border2, 1))
            .on('pointerdown', () => { chooseTurningPoint(tp, c.originalIdx); done(this, null); });
        }
      });
    } else {
      choices.forEach((c, i) => {
        const bh    = choiceHeights[i];
        const rowY  = y; // ← y をイテレーション時点の値として const に固定（クロージャバグ回避）
        const avail = c.available;
        const bonus = c.personalityBonus?.[state.personality] || 0;
        const pct = (c.successRate != null && c.successRate < 1)
          ? Math.round(Math.min(1, c.successRate + bonus) * 100) : null;
        const rc = pct != null ? (pct < 10 ? '#fca5a5' : pct < 50 ? '#fcd34d' : '#86efac') : C.muted;
        const meta = [
          pct != null ? `成功率 ${pct}%` : '',
          c.stat || '',
          !avail ? '⚠ 条件不足' : '',
        ].filter(Boolean).join('  　');

        const fillC  = avail ? C.surface2 : 0x080816;
        const fillA  = avail ? 1 : 0.4;
        const lineC  = avail ? C.border2 : C.border;
        const bx = p.x + 12, bw = p.w - 24;

        // ① 背景を先に add
        const bg = this.add.graphics();
        const drawBg = (lineColor, lineW) => {
          bg.clear();
          bg.fillStyle(fillC, fillA);
          bg.lineStyle(lineW, lineColor);
          bg.fillRoundedRect(bx, rowY, bw, bh, 6);
          bg.strokeRoundedRect(bx, rowY, bw, bh, 6);
        };
        drawBg(lineC, 1);

        // ② テキストを後に add（前面）
        this._text(p.x + PAD, rowY + CPAD, this._wrapJP(c.label, innerW, 14),
          { size: 14, bold: true, color: avail ? C.text : C.muted });
        if (meta)
          this._text(p.x + PAD, rowY + CPAD + this._measureTextH(c.label, 14, innerW) + 3,
            this._wrapJP(meta, innerW, 12), { size: 12, color: rc });

        if (avail) {
          bg.setInteractive(new Phaser.Geom.Rectangle(bx, rowY, bw, bh), Phaser.Geom.Rectangle.Contains)
            .on('pointerover', () => drawBg(C.primary, 2))
            .on('pointerout',  () => drawBg(lineC, 1))
            .on('pointerdown', () => { done(this, chooseTurningPoint(tp, c.originalIdx)); });
        }
        y += bh + GAP;
      });
    }
  }

  // ─────────────────────── ④ リザルト（サイコロ） ───────────────
  _showResult(result) {
    if (!result) { done(this); return; }
    const p = this._panel(420, 340, C.surface, result.succeeded ? C.safe : C.danger);

    const diceFrames = ['⚀','⚁','⚂','⚃','⚄','⚅'];
    let df = 0;
    const diceT = this._text(p.cx, p.y + 60, diceFrames[0], { size: 72, origin: 0.5 });
    diceT.setOrigin(0.5);

    const spinTimer = this.time.addEvent({
      delay: 80, repeat: 16,
      callback: () => { diceT.setText(diceFrames[(df++) % 6]); },
    });

    this.time.delayedCall(1400, () => {
      spinTimer.remove();
      diceT.setText(result.succeeded ? '✨' : '💔');

      this._text(p.cx, p.y + 140, result.succeeded ? '成功！' : '失敗...', {
        font: 'game', size: 32, bold: true,
        color: result.succeeded ? '#86efac' : '#fca5a5', origin: 0.5,
      }).setOrigin(0.5);

      if (result.message) {
        this._text(p.x + 30, p.y + 194,
          this._wrapJP(result.message, p.w - 60, 15),
          { size: 15, color: C.muted });
      }

      this._okBtn(p.cx, p.y + p.h - 34, result.succeeded ? '🎉 素晴らしい！' : '現実を受け入れる',
        result.succeeded ? C.safe : C.danger, () => done(this));

      if (result.succeeded) this._burst('success');
    });
  }

  // ─────────────────────── ⑤ 名言 ───────────────────────────────
  _showQuote(quote) {
    const p = this._panel(480, 280, C.surface, C.warning);
    this._text(p.cx, p.y + 36, '📖', { size: 36, origin: 0.5 }).setOrigin(0.5);
    const qInnerW = p.w - 48;
    const qt = this._text(p.x + 24, p.y + 88,
      this._wrapJP(`「${quote.text}」`, qInnerW, 16),
      { size: 16, color: C.text, extra: { fontStyle: 'italic' } });
    this._text(p.x + 24, p.y + 94 + qt.height,
      `— ${quote.author}`, { size: 14, color: '#f59e0b' });
    this._okBtn(p.cx, p.y + p.h - 34, '続ける', C.warning, () => done(this));
  }

  // ─────────────────────── パーティクル演出 ─────────────────────
  _burst(type) {
    const colors = type === 'success' || type === 'SS'
      ? [0xffd700, 0x86efac, 0xa78bfa, 0xffffff]
      : [0xffd700, 0xff6b6b, 0xa855f7, 0x22c55e];
    for (let i = 0; i < 30; i++) {
      this.time.delayedCall(i * 30, () => {
        const x = Phaser.Math.Between(200, 1080);
        const y = Phaser.Math.Between(100, 400);
        const c = colors[Phaser.Math.Between(0, colors.length - 1)];
        const p = this.add.rectangle(x, y, Phaser.Math.Between(6, 14), Phaser.Math.Between(6, 14), c);
        this.tweens.add({
          targets: p, y: y + Phaser.Math.Between(80, 200),
          alpha: 0, duration: Phaser.Math.Between(600, 1400), ease: 'Power2',
          onComplete: () => p.destroy(),
        });
      });
    }
  }
}
