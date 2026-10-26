// 화면 위를 돌아다니는 캐릭터들의 행동 로직 (overlay.html 에서 실행)
(function () {
  const { CHARS, render } = window.ChiiDraw;
  const api = window.petAPI || {
    setIgnore() {}, reportCounts() {}, onSpawn() {}, onClear() {},
  };

  const W = 96, H = 108;
  const GRAVITY = 1900;
  const MAX_PETS = 15;

  const LINES = {
    chiikawa: { talk: ['와…', '…!', '헤헤', '냠냠', '좋아…!'], cry: ['으앙ㅠㅠ', 'ㅠㅠ'], click: ['와…!', '…!?', '헤헤'] },
    hachiware: { talk: ['어떻게든 되겠지~!', '치이카와~', '좋아!', '헤헤~'], cry: ['힝…'], click: ['앗!', '헤헤~', '간지러워~'] },
    usagi: { talk: ['흐응?', '푸루루루루', '하아?'], shout: ['우라!', '야하!', '우라라!', '하아?!'], click: ['야하!', '우라!', '하아?'] },
  };

  // 캐릭터별 행동 가중치 [상태, 가중치, 최소초, 최대초]
  const BEHAVIOR = {
    chiikawa: [['walk', 30, 2, 6], ['run', 5, 1.2, 2.5], ['idle', 14, 1.5, 4], ['sit', 14, 3, 7], ['lie', 13, 4, 9], ['sleep', 7, 6, 14], ['dance', 5, 2.5, 5], ['cry', 7, 2, 3.5], ['talk', 5, 2.2, 2.8], ['jump', 4]],
    hachiware: [['walk', 30, 2, 6], ['run', 8, 1.2, 2.5], ['idle', 12, 1.5, 4], ['sit', 10, 3, 7], ['lie', 10, 4, 9], ['sleep', 5, 6, 14], ['dance', 12, 3, 6], ['cry', 2, 2, 3], ['talk', 9, 2.5, 3], ['jump', 6]],
    usagi: [['walk', 20, 1.5, 4], ['run', 18, 1.5, 3], ['idle', 6, 1, 2.5], ['sit', 4, 2, 4], ['lie', 6, 3, 7], ['sleep', 3, 5, 10], ['dance', 8, 2.5, 5], ['shout', 14, 1.4, 1.8], ['talk', 4, 2, 2.6], ['jump', 15]],
  };

  const stage = document.getElementById('stage');
  const pets = [];
  let seq = 0;
  let drag = null;
  let ignoring = true;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const groundY = () => window.innerHeight;
  const stageW = () => window.innerWidth;

  class Pet {
    constructor(type) {
      this.type = type;
      this.uid = 'p' + (++seq);
      this.facing = Math.random() < 0.5 ? 1 : -1;
      // 화면 가장자리에서 걸어 들어옴
      this.x = this.facing > 0 ? -W / 2 : stageW() + W / 2;
      this.y = 0; // 바닥으로부터의 높이(px)
      this.vx = 0; this.vy = 0;
      this.t = Math.random() * 10;
      this.leaving = false;

      this.el = document.createElement('div');
      this.el.className = 'pet';
      this.el.style.width = W + 'px';
      this.el.style.height = H + 'px';
      this.body = document.createElement('div');
      this.body.className = 'pet-body';
      this.bubble = document.createElement('div');
      this.bubble.className = 'bubble';
      this.el.append(this.bubble, this.body);
      this.el._pet = this;
      stage.appendChild(this.el);

      this.setState('enter', 99, rand(W, stageW() - W));
    }

    setState(state, dur = 3, target) {
      this.state = state;
      this.timer = dur;
      this.target = target;
      if (state === 'jump') {
        this.vy = rand(420, 620);
        this.vx = this.facing * rand(40, 140);
        this.y = Math.max(this.y, 1);
      }
      if (state === 'talk') this.say(pick(LINES[this.type].talk));
      if (state === 'cry') this.say(pick(LINES[this.type].cry || ['ㅠㅠ']));
      if (state === 'shout') this.say(pick(LINES[this.type].shout));
    }

    say(text, sec = 1.8) {
      this.bubble.textContent = text;
      this.bubble.classList.add('show');
      clearTimeout(this.bubbleTimer);
      this.bubbleTimer = setTimeout(() => this.bubble.classList.remove('show'), sec * 1000);
    }

    next() {
      const list = BEHAVIOR[this.type];
      const total = list.reduce((s, b) => s + b[1], 0);
      let r = Math.random() * total;
      for (const [state, w, a = 1, b = 2] of list) {
        r -= w;
        if (r <= 0) {
          if (state === 'walk' || state === 'run') {
            if (Math.random() < 0.4) this.facing *= -1;
          }
          this.setState(state, rand(a, b));
          return;
        }
      }
      this.setState('idle', 2);
    }

    leave() {
      this.leaving = true;
      this.facing = this.x < stageW() / 2 ? -1 : 1;
      this.setState('exit', 99);
    }

    get airborne() { return this.y > 0 || this.vy > 0; }

    update(dt) {
      this.t += dt;
      const speed = CHARS[this.type].speed;
      const maxX = stageW() - W / 2, minX = W / 2;

      if (this.state === 'held') {
        // 드래그 중에는 마우스가 위치를 정함
      } else if (this.airborne) {
        this.vy -= GRAVITY * dt;
        this.y += this.vy * dt;
        this.x += this.vx * dt;
        if (this.x < minX) { this.x = minX; this.vx = Math.abs(this.vx) * 0.6; this.facing = 1; }
        if (this.x > maxX) { this.x = maxX; this.vx = -Math.abs(this.vx) * 0.6; this.facing = -1; }
        if (this.y <= 0) {
          this.y = 0; this.vy = 0; this.vx = 0;
          this.setState('land', 0.18);
        }
      } else {
        this.timer -= dt;
        switch (this.state) {
          case 'enter':
            this.x += this.facing * speed * dt;
            if ((this.facing > 0 && this.x >= this.target) || (this.facing < 0 && this.x <= this.target)) this.next();
            break;
          case 'exit':
            this.x += this.facing * speed * 2 * dt;
            if (this.x < -W || this.x > stageW() + W) this.remove();
            break;
          case 'walk':
          case 'run': {
            const v = speed * (this.state === 'run' ? 2.6 : 1);
            this.x += this.facing * v * dt;
            if (this.x < minX) { this.x = minX; this.facing = 1; }
            if (this.x > maxX) { this.x = maxX; this.facing = -1; }
            break;
          }
        }
        if (this.timer <= 0 && this.state !== 'enter' && this.state !== 'exit') this.next();
      }
    }

    draw() {
      let pose = this.state;
      if (pose === 'enter' || pose === 'exit') pose = 'walk';
      if (this.airborne && this.state !== 'held') pose = this.vy > 0 ? 'jump' : 'fall';
      if (this.state === 'exit') pose = 'run';
      this.body.innerHTML = render(this.type, {
        pose, t: this.t, facing: this.facing, uid: this.uid,
        air: this.y,
      });
      const left = this.x - W / 2;
      const top = groundY() - H - this.y;
      this.el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
      this.el.style.zIndex = String(Math.round(1000 - this.y)); // 낮게 있는 캐릭터가 앞쪽
    }

    remove() {
      const i = pets.indexOf(this);
      if (i >= 0) pets.splice(i, 1);
      this.el.remove();
      reportCounts();
    }
  }

  function reportCounts() {
    const counts = { chiikawa: 0, hachiware: 0, usagi: 0 };
    for (const p of pets) if (!p.leaving) counts[p.type]++;
    api.reportCounts(counts);
  }

  function spawn(type) {
    if (!CHARS[type]) return;
    if (pets.filter((p) => !p.leaving).length >= MAX_PETS) return;
    pets.push(new Pet(type));
    reportCounts();
  }

  function clearAll() {
    for (const p of pets) if (!p.leaving) p.leave();
    reportCounts();
  }

  api.onSpawn(spawn);
  api.onClear(clearAll);

  // ---- 마우스: 캐릭터 위에서만 클릭을 받고, 나머지는 아래 창으로 통과 ----
  function setIgnore(v) {
    if (v === ignoring) return;
    ignoring = v;
    api.setIgnore(v);
  }

  function petFromEvent(e) {
    const el = e.target && e.target.closest ? e.target.closest('.pet') : null;
    return el ? el._pet : null;
  }

  window.addEventListener('mousemove', (e) => {
    if (drag) {
      const p = drag.pet;
      const now = performance.now();
      const dtm = Math.max(1, now - drag.lt) / 1000;
      drag.vx = (e.clientX - drag.lx) / dtm;
      drag.vy = -(e.clientY - drag.ly) / dtm;
      drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) drag.moved = true;
      if (drag.moved) {
        p.state = 'held';
        p.x = e.clientX - drag.ox;
        p.y = Math.max(0, groundY() - (e.clientY - drag.oy) - H);
        if (Math.abs(drag.vx) > 30) p.facing = drag.vx > 0 ? 1 : -1;
      }
      return;
    }
    setIgnore(!petFromEvent(e));
  });

  window.addEventListener('mousedown', (e) => {
    const p = petFromEvent(e);
    if (!p || p.leaving) return;
    if (e.button === 2) { p.say('안녕~', 1); p.leave(); reportCounts(); return; }
    if (e.button !== 0) return;
    const rect = p.el.getBoundingClientRect();
    drag = {
      pet: p, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, lt: performance.now(),
      ox: e.clientX - (rect.left + W / 2), oy: e.clientY - rect.top, vx: 0, vy: 0, moved: false,
    };
  });

  window.addEventListener('mouseup', () => {
    if (!drag) return;
    const { pet: p, moved } = drag;
    if (!moved) {
      // 클릭: 깡충 뛰며 한마디
      p.say(pick(LINES[p.type].click), 1.2);
      if (!p.airborne) p.setState('jump');
    } else {
      // 던지기
      p.vx = Math.max(-900, Math.min(900, drag.vx * 0.6));
      p.vy = Math.max(-200, Math.min(900, drag.vy * 0.6));
      p.state = 'fall';
      if (p.y <= 0 && p.vy <= 0) { p.y = 0; p.vy = 0; p.vx = 0; p.setState('land', 0.18); }
    }
    drag = null;
  });

  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- 메인 루프 ----
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const p of pets.slice()) p.update(dt);
    for (const p of pets) p.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener('resize', () => {
    for (const p of pets) p.x = Math.min(Math.max(p.x, W / 2), stageW() - W / 2);
  });

  // 브라우저 미리보기/테스트용
  window.__pets = { spawn, clearAll, pets };
})();
