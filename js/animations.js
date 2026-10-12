// animations.js - GSAP アニメーション定義

const gsap = window.gsap;

// ─── オープニング画面 ─────────────────────────────────────────
export function initOpeningScreen() {
  gsap.timeline()
    .from('.start-logo',    { opacity: 0, scale: 0.7, duration: 1.2, ease: 'power4.out' })
    .from('.start-tagline', { opacity: 0, y: 20, duration: 0.7, ease: 'power3.out' }, '-=0.5')
    .from('.start-tags span', { opacity: 0, y: 10, stagger: 0.1, duration: 0.4, ease: 'power2.out' }, '-=0.3')
    .from('.start-hint',    { opacity: 0, y: 8, duration: 0.5 }, '-=0.1');
}

// ─── 画面遷移（スタート→ゲーム） ────────────────────────────
export function animateStartToGame(startEl, gameEl, callback) {
  gsap.timeline()
    .to(startEl, { opacity: 0, scale: 1.06, duration: 0.5, ease: 'power2.in',
      onComplete: () => {
        startEl.classList.add('hidden');
        gameEl.classList.remove('hidden');
        gsap.from(gameEl, { opacity: 0, duration: 0.45, ease: 'power2.out' });
        callback();
      }
    });
}

// ─── モーダル：オープン ───────────────────────────────────────
export function animateModalOpen(el, type = 'normal') {
  gsap.killTweensOf(el);
  switch (type) {
    case 'birth':
      gsap.fromTo(el,
        { scale: 0.75, opacity: 0, y: 40 },
        { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'back.out(2)' }
      );
      break;
    case 'karma-bad':
      gsap.timeline()
        .fromTo(el,
          { scale: 1.15, opacity: 0, x: -30, rotation: -2 },
          { scale: 1, opacity: 1, x: 0, rotation: 0, duration: 0.4, ease: 'power3.out' }
        )
        .to(el, { x: -5, duration: 0.06 }, '+=0.05')
        .to(el, { x: 5, duration: 0.06 })
        .to(el, { x: 0, duration: 0.05 });
      break;
    case 'karma-good':
      gsap.timeline()
        .fromTo(el,
          { scale: 0.7, opacity: 0, y: -35 },
          { scale: 1.08, opacity: 1, y: 0, duration: 0.35, ease: 'back.out(3)' }
        )
        .to(el, { scale: 1, duration: 0.2, ease: 'power2.out' });
      break;
    case 'tp':
      gsap.fromTo(el,
        { scale: 0.82, opacity: 0, y: 45 },
        { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: 'back.out(2)' }
      );
      break;
    case 'quote':
      gsap.fromTo(el,
        { scale: 0.9, opacity: 0, y: -30 },
        { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: 'back.out(1.5)' }
      );
      break;
    case 'result':
      gsap.fromTo(el,
        { scale: 0.8, opacity: 0, rotationY: -20 },
        { scale: 1, opacity: 1, rotationY: 0, duration: 0.45, ease: 'back.out(1.7)' }
      );
      break;
    default:
      gsap.fromTo(el,
        { scale: 0.85, opacity: 0, y: 28 },
        { scale: 1, opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.6)' }
      );
  }
}

// ─── モーダル：クローズ ───────────────────────────────────────
export function animateModalClose(el, callback) {
  gsap.killTweensOf(el);
  gsap.to(el, {
    scale: 0.9, opacity: 0, y: -12, duration: 0.2, ease: 'power2.in',
    onComplete: () => {
      gsap.set(el, { clearProps: 'all' });
      callback?.();
    }
  });
}

// ─── バックドロップ ───────────────────────────────────────────
export function animateBackdropIn(el) {
  el.classList.remove('hidden');
  gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.25 });
}

export function animateBackdropOut(el, callback) {
  gsap.to(el, {
    opacity: 0, duration: 0.2,
    onComplete: () => { el.classList.add('hidden'); callback?.(); }
  });
}

// ─── 画面シェイク（悪カルマ） ────────────────────────────────
export function shakeScreen() {
  const el = document.querySelector('#game-screen');
  if (!el) return;
  gsap.killTweensOf(el);
  gsap.timeline()
    .to(el, { x: -11, duration: 0.055 })
    .to(el, { x: 11,  duration: 0.055 })
    .to(el, { x: -9,  duration: 0.055 })
    .to(el, { x: 9,   duration: 0.055 })
    .to(el, { x: -6,  duration: 0.05  })
    .to(el, { x: 6,   duration: 0.05  })
    .to(el, { x: 0,   duration: 0.04  });
}

// ─── カラーフラッシュ ─────────────────────────────────────────
export function flashScreen(color = '#ef4444', intensity = 0.28) {
  const flash = document.createElement('div');
  flash.style.cssText = `
    position:fixed;inset:0;z-index:9998;pointer-events:none;
    background:${color};opacity:0;
  `;
  document.body.appendChild(flash);
  gsap.timeline()
    .to(flash, { opacity: intensity, duration: 0.08 })
    .to(flash, { opacity: 0, duration: 0.45, ease: 'power2.out',
        onComplete: () => flash.remove() });
}

// ─── TP：バッジ・タイトル演出 ────────────────────────────────
export function animateTPHeader(container) {
  const badge = container.querySelector('.tm-badge');
  const title = container.querySelector('.tm-title');
  const desc  = container.querySelector('.tm-desc');
  const tl = gsap.timeline({ delay: 0.05 });
  if (badge) { gsap.set(badge, { x: -30, opacity: 0 }); tl.to(badge, { x: 0, opacity: 1, duration: 0.4, ease: 'power3.out' }); }
  if (title) { gsap.set(title, { opacity: 0, y: 10 }); tl.to(title, { opacity: 1, y: 0, duration: 0.35 }, '-=0.2'); }
  if (desc)  { gsap.set(desc,  { opacity: 0 }); tl.to(desc,  { opacity: 1, duration: 0.3 }, '-=0.15'); }
}

// ─── TP：選択肢スタッガー ────────────────────────────────────
export function animateTPChoices(container) {
  const items = container.querySelectorAll('.tm-choice-btn, .tm-job-card');
  if (!items.length) return;
  gsap.set(items, { opacity: 0, y: 16 });
  gsap.to(items, {
    opacity: 1, y: 0, stagger: 0.06,
    duration: 0.32, ease: 'power2.out', delay: 0.18,
  });
}

// ─── ナラティブエントリ ───────────────────────────────────────
export function animateNarrativeEntry(el) {
  gsap.set(el, { opacity: 0, x: -14 });
  gsap.to(el, { opacity: 1, x: 0, duration: 0.32, ease: 'power2.out' });
}

// ─── ステータスバー ───────────────────────────────────────────
export function animateStatBar(el, pct) {
  if (!el) return;
  gsap.to(el, { width: `${Math.max(0, Math.min(100, pct))}%`, duration: 0.45, ease: 'power2.out' });
}

// ─── 死亡画面：段階的登場 ────────────────────────────────────
export function animateDeathReveal() {
  const tl = gsap.timeline({ delay: 0.15 });
  tl.from('.ds-grade',       { scale: 0.3, opacity: 0, duration: 0.65, ease: 'back.out(2.8)' })
    .from('.ds-grade-label', { opacity: 0, y: 8, duration: 0.35 }, '-=0.1')
    .from('.ds-score',       { opacity: 0, scale: 0.8, duration: 0.4, ease: 'back.out(1.5)' }, '-=0.05')
    .from('.ds-death-info',  { opacity: 0, y: 5, duration: 0.3 }, '-=0.05')
    .from('.ds-quote',       { opacity: 0, duration: 0.5 }, '+=0.1')
    .from('.ds-bar-row',     { opacity: 0, x: -22, stagger: 0.11, duration: 0.35, ease: 'power2.out' }, '-=0.1')
    .from('.ds-career-row',  { opacity: 0, y: 6, stagger: 0.07, duration: 0.25 }, '-=0.1')
    .from('.ds-records',     { opacity: 0, y: 8, duration: 0.3 }, '-=0.05')
    .from('.ds-share-btn',   { opacity: 0, scale: 0.88, duration: 0.3, ease: 'back.out(1.5)' }, '-=0.05');
}

// ─── 誕生レアリティ特殊演出 ──────────────────────────────────
export function animateBirthByRarity(rarity, modalEl) {
  gsap.killTweensOf(modalEl);
  if (rarity === 'SSS') {
    gsap.timeline()
      .from(modalEl, { rotationY: 180, scale: 0.5, opacity: 0, duration: 0.75, ease: 'back.out(2)' })
      .from('.bm-rarity', { scale: 0, opacity: 0, duration: 0.5, ease: 'elastic.out(1.2, 0.5)' }, '-=0.2');
  } else if (rarity === 'SS') {
    gsap.timeline()
      .from(modalEl, { scale: 0.65, opacity: 0, duration: 0.55, ease: 'back.out(2.2)' })
      .from('.bm-rarity', { scale: 0, opacity: 0, duration: 0.45, ease: 'back.out(1.8)' }, '-=0.15');
  } else if (rarity === 'S') {
    gsap.timeline()
      .from(modalEl, { scale: 0.78, opacity: 0, duration: 0.45, ease: 'back.out(1.9)' })
      .from('.bm-rarity', { scale: 0, opacity: 0, duration: 0.38, ease: 'back.out(1.6)' }, '-=0.1');
  } else {
    animateModalOpen(modalEl, 'birth');
  }
}
