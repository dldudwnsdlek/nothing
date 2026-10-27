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

  // 벽타기·천장 매달리기: 켜둔 동안에만 허용 (다음에 켜도 기억)
  const climbBtn = document.getElementById('climb');
  let climb = false;
  try { climb = localStorage.getItem('climb') === 'on'; } catch (e) { /* 기본 OFF */ }
  function setClimb(on) {
    climb = on;
    climbBtn.setAttribute('aria-pressed', String(on));
    climbBtn.querySelector('b').textContent = on ? 'ON' : 'OFF';
    try { localStorage.setItem('climb', on ? 'on' : 'off'); } catch (e) { /* 저장 불가 */ }
    api.event(on ? 'climb:on' : 'climb:off');
  }
  climbBtn.addEventListener('click', () => setClimb(!climb));
  setClimb(climb);

  if (api.onDex) {
    api.onDex((d) => {
      document.getElementById('dex').textContent =
        `✨ 도감 · 황금 친구 ${d.golden || 0} · 별똥별 ${d.star || 0} · 왕 친구 ${d.giant || 0} · 사진 ${d.photo || 0}`;
    });
  }
  if (api.onPhotoSaved) {
    api.onPhotoSaved((info) => {
      const el = document.getElementById('photo-saved');
      el.hidden = false;
      el.textContent = `📸 ${info.name} 저장됨`;
      const b = document.createElement('button');
      b.textContent = '폴더 열기';
      b.addEventListener('click', () => api.openPhotos());
      el.appendChild(b);
    });
  }

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
