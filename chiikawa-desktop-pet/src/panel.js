(function () {
  const api = window.petAPI;
  const cards = [...document.querySelectorAll('.card')];
  const poses = ['idle', 'talk', 'dance', 'lie'];
  const poseOf = {};

  cards.forEach((card) => {
    const type = card.dataset.type;
    poseOf[type] = 'idle';
    card.addEventListener('click', () => api.spawn(type));
    card.addEventListener('mouseenter', () => { poseOf[type] = 'dance'; });
    card.addEventListener('mouseleave', () => { poseOf[type] = pick(poses); });
  });

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  document.getElementById('all').addEventListener('click', () => {
    ['chiikawa', 'hachiware', 'usagi'].forEach((t, i) => setTimeout(() => api.spawn(t), i * 350));
  });
  document.getElementById('clear').addEventListener('click', () => api.clearAll());

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
      card.querySelector('.face').innerHTML = window.ChiiDraw.render(type, { pose: poseOf[type], t: t + i, uid: 'panel-' + type });
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
