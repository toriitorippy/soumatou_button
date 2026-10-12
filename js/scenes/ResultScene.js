import { calcLifeScore, lifeScoreGrade } from '../gameEngine.js';
import { getLifeRecords, saveLifeRecords } from '../state.js';

export default class ResultScene extends Phaser.Scene {
  constructor() { super({ key: 'Result' }); }

  init(data) { this._state = data.state; }

  create() {
    const W = 1280, H = 720;
    const state  = this._state;
    const score  = calcLifeScore(state);
    const grade  = lifeScoreGrade(score);
    const records = getLifeRecords();
    saveLifeRecords(score);

    this.cameras.main.setBackgroundColor('#050510');
    this.cameras.main.fadeIn(500, 0, 0, 5);

    // ── 左：評価 ─────────────────────────────────────────────
    const LX = 80;
    let y = 60;

    this.add.text(LX, y, `第${state.lifeCount}の人生`, {
      fontFamily: '"DotGothic16"', fontSize: 16, color: 'rgba(255,255,255,0.4)',
    });
    y += 36;

    this.add.text(LX, y, grade.grade, {
      fontFamily: '"DotGothic16"', fontSize: 96, color: grade.color || '#a78bfa',
    });
    this.add.text(LX + 100, y + 56, grade.label, {
      fontFamily: '"Noto Sans JP"', fontSize: 20, color: grade.color || '#a78bfa',
    });
    y += 130;

    this.add.text(LX, y, `${Math.round(score)}`, {
      fontFamily: '"DotGothic16"', fontSize: 52, color: '#e8e8f4',
    });
    this.add.text(LX + 108, y + 28, '点', {
      fontFamily: '"Noto Sans JP"', fontSize: 22, color: 'rgba(255,255,255,0.5)',
    });
    y += 80;

    this.add.text(LX, y, `${state.age}歳　死因：${state.deathCause}`, {
      fontFamily: '"Noto Sans JP"', fontSize: 17, color: '#ef4444',
    });
    y += 48;

    // ── バー ──────────────────────────────────────────────────
    const bars = [
      ['寿命',    Math.min(100, Math.round(state.age / 82 * 100)),       `${state.age}歳`],
      ['資産',    Math.min(100, Math.round(Math.max(0, state.money) / 2000 * 100)), `${Math.round(state.money).toLocaleString()}万`],
      ['健康',    Math.round(state.health),                              `${Math.round(state.health)}`],
      ['心の余裕', Math.round(100 - Math.min(state.stress, 100)),         `${Math.round(100 - Math.min(state.stress, 100))}`],
    ];
    bars.forEach(([lbl, pct, val]) => {
      this.add.text(LX, y, lbl, { fontFamily: '"Noto Sans JP"', fontSize: 16, color: 'rgba(255,255,255,0.5)' });
      const bx = LX + 80, bw = 260, bh = 12, by2 = y + 10;
      this.add.rectangle(bx + bw / 2, by2, bw, bh, 0x1e1e38);
      const fc = pct < 30 ? 0xef4444 : 0x7c3aed;
      this.add.rectangle(bx, by2, bw * pct / 100, bh, fc).setOrigin(0, 0.5);
      this.add.text(bx + bw + 12, y - 2, val, { fontFamily: '"DotGothic16"', fontSize: 16, color: '#e8e8f4' });
      y += 36;
    });
    y += 16;

    // ── 右：キャリア＆記録 ────────────────────────────────────
    const RX = 700;
    let ry = 60;

    this.add.text(RX, ry, 'CAREER', { fontFamily: '"DotGothic16"', fontSize: 13, color: 'rgba(255,255,255,0.3)' });
    ry += 28;

    const careerRows = [
      ['💼 職業',   state.jobData?.name || '無職'],
      ['🏢 会社',   state.company || '—'],
      ['🎓 出身校', state.school  || '—'],
      ['💰 生涯収入', `${Math.round(state.lifetimeEarnings || 0).toLocaleString()}万円`],
      ['💍 婚姻',   state.isMarried ? `既婚（${state.partnerName || 'パートナー'}）` : '独身'],
      ['👶 子ども', (state.hasChildren || 0) > 0 ? 'あり' : 'なし'],
    ].filter(([, v]) => v && v !== '—');

    careerRows.forEach(([lbl, val]) => {
      this.add.text(RX, ry, lbl, { fontFamily: '"Noto Sans JP"', fontSize: 15, color: 'rgba(255,255,255,0.4)' });
      this.add.text(RX + 130, ry, val, { fontFamily: '"Noto Sans JP"', fontSize: 15, color: '#e8e8f4', fontStyle: 'bold' });
      ry += 32;
    });
    ry += 20;

    // 自己記録
    this.add.text(RX, ry, '🏆 自己記録', { fontFamily: '"DotGothic16"', fontSize: 13, color: 'rgba(255,255,255,0.3)' });
    ry += 28;
    [
      [`最長寿命`,   `${records.bestAge}歳`],
      [`最高資産`,   `${records.bestMoney.toLocaleString()}万円`],
      [`最高スコア`, `${records.bestScore}点`],
      [`通算`,       `${state.lifeCount}回目`],
    ].forEach(([lbl, val]) => {
      this.add.text(RX, ry, lbl, { fontFamily: '"Noto Sans JP"', fontSize: 15, color: 'rgba(255,255,255,0.4)' });
      this.add.text(RX + 130, ry, val, { fontFamily: '"DotGothic16"', fontSize: 18, color: '#fbbf24', fontStyle: 'bold' });
      ry += 34;
    });

    // ── ボタン ────────────────────────────────────────────────
    const btnY = H - 70;

    // Xシェア
    const tweetText = `【走馬灯ボタン】第${state.lifeCount}の人生 / ${grade.grade}評価「${grade.label}」/ ${state.age}歳没 / スコア${Math.round(score)}点 #走馬灯ボタン`;
    const shareUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;

    const shareBg = this.add.rectangle(RX + 150, btnY, 280, 50, 0x111111)
      .setStrokeStyle(1, 0x333333)
      .setInteractive({ useHandCursor: true });
    this.add.text(RX + 150, btnY, '𝕏  Xでシェア', { fontFamily: '"Noto Sans JP"', fontSize: 16, color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    shareBg.on('pointerdown', () => window.open(shareUrl, '_blank'));
    shareBg.on('pointerover',  () => shareBg.setFillStyle(0x222222));
    shareBg.on('pointerout',   () => shareBg.setFillStyle(0x111111));

    // やり直し
    const retryBg = this.add.rectangle(LX + 160, btnY, 320, 54, 0x7c3aed, 0.25)
      .setStrokeStyle(2, 0x7c3aed)
      .setInteractive({ useHandCursor: true });
    this.add.text(LX + 160, btnY, '🔄  走馬灯ボタン（やり直し）', {
      fontFamily: '"DotGothic16"', fontSize: 18, color: '#e2d9f3',
    }).setOrigin(0.5);
    retryBg.on('pointerover', () => retryBg.setFillStyle(0x7c3aed, 0.45));
    retryBg.on('pointerout',  () => retryBg.setFillStyle(0x7c3aed, 0.25));
    retryBg.on('pointerdown', () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game'));
    });

    // パーティクル（死亡演出）
    this._deathParticles();
  }

  _deathParticles() {
    const colors = [0xfda4af, 0xfecdd3, 0xfbbf24, 0xffffff];
    for (let i = 0; i < 20; i++) {
      this.time.delayedCall(i * 100, () => {
        const x = Phaser.Math.Between(0, 1280);
        const c = colors[Phaser.Math.Between(0, 3)];
        const s = Phaser.Math.Between(4, 12);
        const p = this.add.rectangle(x, -20, s, s, c);
        this.tweens.add({
          targets: p, y: 760, alpha: 0,
          duration: Phaser.Math.Between(2000, 4000), ease: 'Power1',
          onComplete: () => p.destroy(),
        });
      });
    }
  }
}
