import { loadData } from './gameEngine.js';
import PreloadScene  from './scenes/PreloadScene.js';
import TitleScene    from './scenes/TitleScene.js';
import GameScene     from './scenes/GameScene.js';
import EventScene    from './scenes/EventScene.js';
import SoumatouScene from './scenes/SoumatouScene.js';
import ResultScene   from './scenes/ResultScene.js';

// フォントと gameEngine データが揃ってから Phaser を起動
document.fonts.ready.then(async () => {
  await loadData();

  const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#0c0c18',
    scene: [PreloadScene, TitleScene, GameScene, EventScene, SoumatouScene, ResultScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      pixelArt: false,
    },
  };

  new Phaser.Game(config);
});
