export default class TitleScene extends Phaser.Scene {
  constructor() { super({ key: 'Title' }); }

  create() {
    const W = 1280, H = 720;

    // ── 背景画像 ─────────────────────────────────────────────
    const bg = this.add.image(W / 2, H / 2, 'bg-opening').setDisplaySize(W, H);
    // 暗めのオーバーレイ
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.62);

    // ── タイトル ─────────────────────────────────────────────
    const title = this.add.text(W / 2, H / 2 - 100, '走馬灯ボタン', {
      fontFamily: '"DotGothic16", sans-serif',
      fontSize: 72,
      color: '#ffffff',
      stroke: '#7c3aed',
      strokeThickness: 3,
    }).setOrigin(0.5).setAlpha(0);

    const tagline = this.add.text(W / 2, H / 2 - 20, 'あなたの人生、何点でしたか？', {
      fontFamily: '"Noto Sans JP", sans-serif',
      fontSize: 22,
      color: 'rgba(255,255,255,0.6)',
    }).setOrigin(0.5).setAlpha(0);

    // ── タグ ─────────────────────────────────────────────────
    const tags = ['🎲 完全ランダム', '💀 死亡あり', '♾️ 無限周回'];
    tags.forEach((tag, i) => {
      this.add.text(W / 2 - 180 + i * 180, H / 2 + 30, tag, {
        fontFamily: '"Noto Sans JP", sans-serif',
        fontSize: 15,
        color: 'rgba(255,255,255,0.45)',
      }).setOrigin(0.5).setAlpha(0)
        .setName(`tag${i}`);
    });

    // ── スタートボタン ────────────────────────────────────────
    const btnBg = this.add.rectangle(W / 2, H / 2 + 120, 300, 56, 0x7c3aed, 0)
      .setStrokeStyle(2, 0xa78bfa)
      .setAlpha(0);
    const btnText = this.add.text(W / 2, H / 2 + 120, '▶  クリックでスタート', {
      fontFamily: '"DotGothic16", sans-serif',
      fontSize: 20,
      color: '#e2d9f3',
    }).setOrigin(0.5).setAlpha(0);

    // ── フェードイン ──────────────────────────────────────────
    this.tweens.add({ targets: title,   alpha: 1, duration: 800, ease: 'Power2', delay: 200 });
    this.tweens.add({ targets: tagline, alpha: 1, duration: 600, ease: 'Power2', delay: 600 });
    [0, 1, 2].forEach(i => {
      const obj = this.children.getByName(`tag${i}`);
      if (obj) this.tweens.add({ targets: obj, alpha: 1, duration: 500, delay: 800 + i * 100 });
    });
    this.tweens.add({ targets: [btnBg, btnText], alpha: 1, duration: 600, delay: 1100 });

    // ── ボタンパルス ──────────────────────────────────────────
    this.time.delayedCall(1100, () => {
      this.tweens.add({
        targets: btnBg,
        strokeAlpha: { from: 0.6, to: 1 },
        scaleX: { from: 1, to: 1.03 },
        scaleY: { from: 1, to: 1.03 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    // ── スタート入力 ──────────────────────────────────────────
    this.input.once('pointerdown', () => this.startGame());
    this.input.keyboard.once('keydown', () => this.startGame());
  }

  startGame() {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Game');
    });
  }
}
