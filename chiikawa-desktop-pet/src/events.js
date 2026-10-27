// 축제 모드, 희귀 이벤트(황금 친구·별똥별·왕 친구), 기념사진 (pets.js 다음에 실행)
(function () {
  const { world, pets, Pet, W } = window.__pets;
  const { rand, pick, groundY, stageW } = world;
  const api = Object.assign({ reportDex() {}, takePhoto: null }, window.petAPI || {});
  const now = () => performance.now();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const NAMES = { chiikawa: '치이카와', hachiware: '하치와레', usagi: '우사기' };

  // ---- 효과용 캔버스 (색종이, 불꽃, 별똥별, 반짝이) ----
  const canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  function resize() {
    const d = window.devicePixelRatio || 1;
    canvas.width = Math.round(innerWidth * d);
    canvas.height = Math.round(innerHeight * d);
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const COLORS = ['#ff9ec4', '#ffd56b', '#9ad7ff', '#b8f2a1', '#d7b6ff', '#ffb38a'];
  let parts = [];
  let dirty = false;

  function confetti(n) {
    for (let i = 0; i < n; i++) {
      parts.push({
        kind: 'confetti', x: rand(0, stageW()), y: rand(-60, -5), vx: rand(-30, 30), vy: rand(60, 140),
        life: 0, max: rand(5, 8), color: pick(COLORS), size: rand(6, 11), rot: rand(0, 6), vr: rand(-6, 6),
      });
    }
  }

  function burst(x, y, n, colors, speed = 220, gravity = 260) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.1, 0.1);
      const v = rand(speed * 0.5, speed);
      parts.push({
        kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: gravity,
        life: 0, max: rand(0.8, 1.3), color: pick(colors), size: rand(2, 3.5),
      });
    }
  }

  function firework() {
    burst(rand(stageW() * 0.1, stageW() * 0.9), rand(groundY() * 0.12, groundY() * 0.5), 46, [pick(COLORS), pick(COLORS), '#fff']);
  }

  function shootingStarFx() {
    const fromLeft = Math.random() < 0.5;
    parts.push({
      kind: 'star', x: fromLeft ? -40 : stageW() + 40, y: rand(30, groundY() * 0.3),
      vx: (fromLeft ? 1 : -1) * rand(700, 900), vy: rand(180, 260), life: 0, max: 2.2, trail: [],
    });
    return fromLeft ? 1 : -1;
  }

  function stepFx(dt) {
    if (!parts.length && !dirty) return;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    dirty = parts.length > 0;
    const keep = [];
    for (const p of parts) {
      p.life += dt;
      if (p.life > p.max) continue;
      const fade = Math.min(1, (p.max - p.life) / 0.5);
      if (p.kind === 'confetti') {
        p.x += (p.vx + Math.sin(p.life * 3 + p.rot) * 25) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.y > groundY() + 20) continue;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2 * (0.4 + Math.abs(Math.cos(p.life * 6))));
        ctx.restore();
      } else if (p.kind === 'spark') {
        p.vy += p.g * dt;
        p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'star') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.trail.push([p.x, p.y]);
        if (p.trail.length > 18) p.trail.shift();
        ctx.globalAlpha = fade;
        ctx.strokeStyle = '#fff3b0';
        ctx.lineCap = 'round';
        for (let i = 1; i < p.trail.length; i++) {
          ctx.lineWidth = (i / p.trail.length) * 5;
          ctx.globalAlpha = fade * (i / p.trail.length);
          ctx.beginPath();
          ctx.moveTo(p.trail[i - 1][0], p.trail[i - 1][1]);
          ctx.lineTo(p.trail[i][0], p.trail[i][1]);
          ctx.stroke();
        }
        ctx.globalAlpha = fade;
        ctx.fillStyle = '#ffe766';
        ctx.font = '26px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', p.x, p.y);
        if (Math.random() < 0.5) {
          parts.push({ kind: 'spark', x: p.x, y: p.y, vx: rand(-40, 40), vy: rand(-20, 40), g: 60, life: 0, max: 0.7, color: '#fff3b0', size: 1.8 });
        }
      }
      keep.push(p);
    }
    ctx.globalAlpha = 1;
    parts = keep;
  }

  // ---- 화면 글자 (배너, 카운트다운, 알림) ----
  function banner(text, ms) {
    const d = document.createElement('div');
    d.className = 'banner';
    d.textContent = text;
    document.body.appendChild(d);
    requestAnimationFrame(() => d.classList.add('show'));
    setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 400); }, ms);
  }

  function toast(text) {
    const d = document.createElement('div');
    d.className = 'toast';
    d.textContent = text;
    document.body.appendChild(d);
    requestAnimationFrame(() => d.classList.add('show'));
    setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 400); }, 2600);
  }

  const friends = () => pets.filter((p) => p.available());

  // ---- 축제 모드 ----
  let festivalUntil = 0, nextFirework = 0, confettiAcc = 0;

  function festival() {
    if (world.photo) return;
    const already = world.festival;
    world.festival = true;
    festivalUntil = now() + 12000;
    if (already) return;
    if (world.monster) world.monster.leave('…즐거워 보이네');
    banner('🎉 축제다! 🎉', 2600);
    confetti(140);
    for (const p of friends()) {
      p.say(pick(['축제다~!', '야하!', '와아…!', '둥실둥실~', '우라!']), 1.6);
      p.next();
    }
  }

  function stepFestival(dt) {
    if (!world.festival) return;
    const t = now();
    confettiAcc += dt * 35;
    if (confettiAcc >= 1) { confetti(Math.floor(confettiAcc)); confettiAcc %= 1; }
    if (t > nextFirework) { firework(); nextFirework = t + rand(450, 900); }
    if (t > festivalUntil) {
      world.festival = false;
      for (const p of friends()) {
        if (['celebrate', 'dance'].includes(p.state)) p.say(pick(['재밌었다~', '헤헤…', '또 하자!']), 1.4);
        p.next();
      }
    }
  }

  // ---- 희귀 이벤트 ----
  const DEX_KEY = 'chiikawa-pet-dex';
  let dex = { golden: 0, star: 0, giant: 0, photo: 0 };
  try { Object.assign(dex, JSON.parse(localStorage.getItem(DEX_KEY) || '{}')); } catch (e) { /* 기록 없음 */ }
  function saveDex() {
    try { localStorage.setItem(DEX_KEY, JSON.stringify(dex)); } catch (e) { /* 저장 불가 */ }
    api.reportDex(dex);
  }
  setTimeout(() => api.reportDex(dex), 500);

  function specialFriend(kind) {
    const type = pick(['chiikawa', 'hachiware', 'usagi']);
    const p = new Pet(type);
    p.special = kind;
    if (kind === 'giant') {
      p.scale = 2.2;
      p.x = p.facing > 0 ? -W * 1.2 : stageW() + W * 1.2;
    } else {
      p.img.style.filter = 'sepia(1) saturate(3.2) hue-rotate(-12deg) brightness(1.08) drop-shadow(0 0 6px #ffd84a)';
    }
    p.setState(kind, 99);
    pets.push(p);
    return p;
  }

  function goldenFriend() {
    const p = specialFriend('golden');
    p.say('✨', 1.5);
    for (const f of friends()) {
      f.facing = Math.sign(p.x - f.x) || 1;
      f.say(pick(['반짝반짝…!', '황금이다…!', '저거 봐!']), 1.6);
    }
    toast(`✨ 황금 ${NAMES[p.type]}가 나타났다! 클릭해서 잡아보세요`);
  }

  function giantFriend() {
    const p = specialFriend('giant');
    dex.giant++;
    saveDex();
    toast(`👑 왕 ${NAMES[p.type]} 등장!`);
    setTimeout(() => { if (pets.includes(p)) p.say('…', 1.5); }, 1500);
    for (const f of friends()) f.say(pick(['커…!', '우와아…', '하아?!']), 1.6);
  }

  function shootingStar() {
    const dir = shootingStarFx();
    dex.star++;
    saveDex();
    for (const f of friends()) {
      f.facing = dir;
      f.setState('idle', 2.5);
      f.say(pick(['별똥별…!', '소원 빌자…!', '와아…', '반짝!']), 1.8);
    }
  }

  const RARE = [goldenFriend, giantFriend, shootingStar];

  // 희귀 친구를 클릭했을 때
  function touchSpecial(p) {
    const r = p.body.getBoundingClientRect();
    if (p.special === 'golden') {
      p.special = 'caught';
      p.img.style.filter = 'sepia(1) saturate(3.2) hue-rotate(-12deg) brightness(1.15) drop-shadow(0 0 10px #ffd84a)';
      p.setState('celebrate', 99);
      p.say('찾았다! ✨', 1.4);
      dex.golden++;
      saveDex();
      toast(`✨ 황금 ${NAMES[p.type]} 발견! (지금까지 ${dex.golden}번)`);
      burst(r.left + r.width / 2, r.top + r.height / 2, 40, ['#ffd84a', '#fff3b0', '#ffb84a'], 260, 120);
      setTimeout(() => {
        const q = p.body.getBoundingClientRect();
        burst(q.left + q.width / 2, q.top + q.height / 2, 60, ['#ffd84a', '#fff3b0', '#ffffff'], 300, 80);
        p.remove();
      }, 1400);
    } else if (p.special === 'giant') {
      p.say(pick(['…?', '쿵…', '…헤헤']), 1.2);
    }
  }

  // 행운 뽑기: 가끔 희귀 이벤트가 터짐
  function lucky() {
    if (Math.random() < 0.15) return pick(RARE)();
    const f = pick(friends());
    if (f) f.say(pick(['꽝…', '다음 기회에…', '흐응…', 'ㅠㅠ']), 1.4);
    else toast('꽝… 다음 기회에!');
  }

  // 왕 친구가 지나가면 작은 친구들이 튕겨남
  function stepGiants() {
    for (const g of pets) {
      if (g.special !== 'giant') continue;
      for (const p of pets) {
        if (p === g || p.special || p.y > 2 || p.surf !== 'floor' || p.state === 'held') continue;
        if (Math.abs(p.x - g.x) < 55) p.knock(Math.sign(p.x - g.x) || g.facing);
      }
    }
  }

  // ---- 기념사진 ----
  let photoBusy = false;

  function countdown(text) {
    const d = document.createElement('div');
    d.className = 'countdown';
    d.textContent = text;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 650);
  }

  function flash() {
    const d = document.createElement('div');
    d.className = 'flash';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 700);
  }

  function preview(dataURL) {
    const d = document.createElement('div');
    d.className = 'photo-preview';
    const img = document.createElement('img');
    img.src = dataURL;
    d.appendChild(img);
    document.body.appendChild(d);
    requestAnimationFrame(() => d.classList.add('show'));
    setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 500); }, 3600);
  }

  // 사진 배경(액자). 캐릭터들 뒤에 깔고 그 영역만 찍음
  function makeFrame(members) {
    let lo = Infinity, hi = -Infinity, top = 0;
    for (const p of members) {
      lo = Math.min(lo, p.x);
      hi = Math.max(hi, p.x);
      let h = p.topY() + 20;
      for (let r = p.rider; r; r = r.rider) h = r.topY() + 20;
      top = Math.max(top, h);
    }
    const x = Math.round(clamp(lo - 90, 0, stageW()));
    const right = Math.round(clamp(hi + 90, 0, stageW()));
    const height = Math.round(Math.min(groundY(), top + 70));
    const rect = { x, y: groundY() - height, width: right - x, height };
    const d = new Date();
    const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    const el = document.createElement('div');
    el.className = 'photo-frame';
    Object.assign(el.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    el.innerHTML = `<div class="title">🌸 치이카와 친구들 🌸</div><div class="date">${date}</div>`;
    return { el, rect };
  }

  async function takePhoto() {
    if (photoBusy || world.away) return;
    const members = friends().filter((p) => !['eat', 'gofood', 'boing'].includes(p.state)).sort((a, b) => a.x - b.x).slice(0, 8);
    if (!members.length) return toast('사진 찍을 친구가 없어요');
    photoBusy = true;
    const gap = 96;
    const cx = clamp(members.reduce((s, p) => s + p.x, 0) / members.length, gap * members.length / 2 + 60, stageW() - gap * members.length / 2 - 60);
    world.photo = { cx };
    members.forEach((p, i) => {
      p.photoX = cx + (i - (members.length - 1) / 2) * gap;
      p.setState('photo_go', 1e9, p.photoX);
    });
    members[0].say('사진 찍자~!', 1.6);

    // 모일 때까지 기다림 (최대 6초)
    const t0 = now();
    const alive = () => members.filter((p) => pets.includes(p) && p.state.startsWith('photo'));
    while (now() - t0 < 6000 && alive().some((p) => !p.reached)) await sleep(100);
    const ready = alive();
    if (ready.length) {
      for (const p of ready) {
        p.facing = Math.sign(cx - p.x) || 1;
        p.setState('photo_pose', 1e9);
      }
      pick(ready).say(pick(['치즈~!', '김치~!', '하나 둘 셋!']), 1.5);
      await sleep(900);
      for (const n of ['3', '2', '1']) { countdown(n); await sleep(700); }

      const { el, rect } = makeFrame(ready);
      world.stage.appendChild(el);
      document.body.classList.add('photo-mode'); // 말풍선 숨김
      await sleep(80);
      let result = null;
      try {
        result = api.takePhoto ? await api.takePhoto(rect) : null;
      } catch (e) {
        result = null;
      }
      document.body.classList.remove('photo-mode');
      el.remove();
      flash();
      countdown('찰칵!');
      await sleep(500);
      if (result && result.dataURL) {
        dex.photo++;
        saveDex();
        preview(result.dataURL);
        pick(ready).say(pick(['잘 나왔다~!', '헤헤…', '야하!']), 2);
      } else {
        pick(ready).say('앗, 사진이 안 찍혔어…', 2);
      }
      await sleep(1200);
    }
    world.photo = null;
    for (const p of members) {
      p.photoX = null;
      if (pets.includes(p) && p.state.startsWith('photo')) p.next();
    }
    photoBusy = false;
  }

  // ---- pets.js 에 연결 ----
  Object.assign(world.handlers, {
    festival,
    lucky,
    photo: takePhoto,
    touchSpecial,
    rare: () => pick(RARE)(),
    // 1초마다: 아주 가끔 희귀 이벤트 (평균 10분에 한 번쯤)
    tick(n) {
      if (world.away || world.photo || world.festival) return;
      if (Math.random() < 1 / 600) pick(n > 0 ? RARE : [goldenFriend, shootingStar])();
    },
    frame(dt) {
      stepFestival(dt);
      stepGiants();
      stepFx(dt);
    },
  });

  window.__events = { festival, goldenFriend, giantFriend, shootingStar, lucky, takePhoto, dex: () => dex };
})();
