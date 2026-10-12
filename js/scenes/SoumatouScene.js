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

export default class SoumatouScene extends Phaser.Scene {
  constructor() { super({ key: 'Soumatou' }); }

  init(data) { this._state = data.state; }

  create() {
    const W = 1280, H = 720;
    const state = this._state;

    this.cameras.main.setBackgroundColor('#000000');

    const PATTERNS = {
      young:   [`たった${state.age}年しか、生きられなかった。`, '時間が足りなかった。やりたいことが、山ほどあった。', '短くても、確かに輝いた瞬間があった。', 'さよなら。また、どこかで。'],
      elder:   [`${state.age}年間、生きた。`, `${state.birthPrefecture || '日本'}から始まって、世の中と向き合った。`, '時代が変わり、人が変わり、自分も変わった。', '十分だ。本当に、十分だ。'],
      success: [`${state.birthPrefecture || '日本'}で産声を上げた。`, `${state.jobData?.name || '仕事'}として歩んだ道のり。`, `${state.partnerName || '誰か'}と出会い、${state.age}歳まで共に生きた。`, '走馬灯のように浮かぶのは、笑っていた日々の断片だけだ。'],
      alone:   ['一人で生きた。それがこの人生の形だった。', `${state.jobData?.name || '仕事'}に、自分を注ぎ込んだ。`, '孤独と自由は、表と裏だ。', `${state.age}歳。自分らしい人生だったと思う。`],
      normal:  ['特別な人生ではなかったかもしれない。', `${state.birthPrefecture || '日本'}生まれの${state.gender || 'ひとり'}。`, '怒られたり、笑ったり、疲れたり。', `${state.age}歳。走馬灯のように、全てが愛おしく見える。`],
    };

    let key = 'normal';
    if (state.age < 40)  key = 'young';
    else if (state.age > 75) key = 'elder';
    else if (!state.isMarried && state.age > 50) key = 'alone';
    else if (state.money > 400 && state.isMarried) key = 'success';

    const lines = PATTERNS[key];

    // 第N回の人生
    const headerT = this.add.text(W / 2, 80, `— 第${state.lifeCount}の人生　${state.age}歳 —`, {
      fontFamily: '"DotGothic16"', fontSize: 22, color: 'rgba(255,255,255,0.4)',
    }).setOrigin(0.5).setAlpha(0);

    const divider = this.add.rectangle(W / 2, 120, 0, 1, 0x444470).setAlpha(0);

    const lineObjs = lines.map((text, i) => {
      const wrapped = wrapJP(text, 680, 22);
      return this.add.text(W / 2, 180 + i * 100, wrapped, {
        fontFamily: '"Noto Sans JP"', fontSize: 22,
        color: i === 0 || i === lines.length - 1 ? '#e8e8f4' : 'rgba(255,255,255,0.65)',
        fontStyle: i === 0 || i === lines.length - 1 ? 'bold' : 'normal',
        align: 'center',
      }).setOrigin(0.5, 0).setAlpha(0);
    });

    // タイムライン
    const tl = this.tweens.createTimeline();
    tl.add({ targets: headerT, alpha: 1, duration: 800 });
    tl.add({ targets: divider, alpha: 1, width: 400, duration: 500 }, '-=300');
    lineObjs.forEach((obj, i) => {
      tl.add({ targets: obj, alpha: 1, y: `+=${10}`, duration: 700, ease: 'Power2' }, `+=${i === 0 ? 300 : 600}`);
    });
    tl.play();

    // 一定時間後に結果画面へ
    const totalDelay = 800 + 500 + lines.length * 700 + 2200;
    this.time.delayedCall(totalDelay, () => {
      this.cameras.main.fadeOut(800, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('Result', { state });
      });
    });
  }
}
