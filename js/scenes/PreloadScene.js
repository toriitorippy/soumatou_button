export default class PreloadScene extends Phaser.Scene {
  constructor() { super({ key: 'Preload' }); }

  preload() {
    const W = 1280, H = 720;

    // ── ローディングUI ──────────────────────────────────────
    this.add.rectangle(W / 2, H / 2 - 10, 480, 10, 0x1e1e38);
    const bar = this.add.rectangle(W / 2 - 240, H / 2 - 10, 0, 10, 0x7c3aed).setOrigin(0, 0.5);

    this.add.text(W / 2, H / 2 - 80, '走馬灯ボタン', {
      fontFamily: '"DotGothic16", sans-serif',
      fontSize: 52,
      color: '#a78bfa',
    }).setOrigin(0.5);

    const statusText = this.add.text(W / 2, H / 2 + 20, 'NOW LOADING...', {
      fontFamily: '"DotGothic16", sans-serif',
      fontSize: 14,
      color: '#444470',
    }).setOrigin(0.5);

    this.load.on('progress', v => {
      bar.width = 480 * v;
    });
    this.load.on('fileprogress', f => {
      statusText.setText(f.key + '...');
    });

    // ── 画像 ────────────────────────────────────────────────
    this.load.image('bg-opening',   'img/bg-opening.webp.jpeg');
    this.load.image('scene-infant', 'img/scene-infant.webp.jpeg');
    this.load.image('scene-child',  'img/scene-child.webp.jpeg');
    this.load.image('scene-teen',   'img/scene-teen.webp.jpeg');
    this.load.image('scene-adult',  'img/scene-adult.webp.jpeg');
    this.load.image('scene-middle', 'img/scene-middle.webp.jpeg');
    this.load.image('scene-elder',  'img/scene-elder.webp.jpeg');
  }

  create() {
    this.time.delayedCall(300, () => this.scene.start('Title'));
  }
}
