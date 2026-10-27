(function () {
  const api = window.petAPI;
  const { spriteFor, motion } = window.ChiiDraw;
  const cards = [...document.querySelectorAll('.card')];
  const poseOf = {};

  cards.forEach((card) => {
    const type = card.dataset.type;
    const img = document.createElement('img');
    img.draggable = false;
    card.querySelector('.face').appendChild(img);
    poseOf[type] = 'idle';
    card.addEventListener('click', () => api.spawn(type));
    card.addEventListener('mouseenter', () => { poseOf[type] = 'dance'; });
    card.addEventListener('mouseleave', () => { poseOf[type] = 'idle'; });
  });

  document.getElementById('all').addEventListener('click', () => {
    ['chiikawa', 'hachiware', 'usagi'].forEach((t, i) => setTimeout(() => api.spawn(t), i * 350));
  });
  document.getElementById('clear').addEventListener('click', () => api.clearAll());
  document.querySelectorAll('[data-event]').forEach((b) => {
    b.addEventListener('click', () => api.event(b.dataset.event));
  });

  api.onCounts((counts) => {
    cards.forEach((card) => {
      card.querySelector('.count').textContent = `${counts[card.dataset.type] || 0}마리 놀러 나옴`;
    });
  });

  const start = performance.now();
  function frame(now) {
    const t = (now - start) / 1000;
    cards.forEach((card, i) => {
      const type = card.dataset.type;
      const img = card.querySelector('.face img');
      const sp = spriteFor(type, poseOf[type]);
      if (!img.src.endsWith(sp.src)) img.src = sp.src;
      const m = motion(poseOf[type], t + i);
      img.style.transform = `translateY(${-m.y}px) rotate(${m.rot}deg) scale(${m.sx}, ${m.sy})`;
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
