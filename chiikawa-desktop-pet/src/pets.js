// 화면 위를 돌아다니는 캐릭터들의 행동 로직 (overlay.html 에서 실행)
(function () {
  const { CHARS, spriteFor, motion, effects } = window.ChiiDraw;
  const api = Object.assign({
    setIgnore() {}, reportCounts() {}, onSpawn() {}, onClear() {},
    onEvent() {}, onCursor() {}, onAway() {}, onBack() {},
  }, window.petAPI || {});

  const W = 110, H = 130; // 캐릭터 한 마리가 차지하는 영역
  const GRAVITY = 1900;
  const MAX_PETS = 15;
  const STRETCH_HOLD_MS = 350; // 이만큼 꾹 누르고 있으면 말랑 늘이기
  const FOODS = ['🍙', '🍮', '🍜', '🍡', '🍰', '🍩'];

  const LINES = {
    chiikawa: {
      talk: ['와…', '…!', '헤헤', '냠냠', '좋아…!'], cry: ['으앙ㅠㅠ', 'ㅠㅠ'], click: ['와…!', '…!?', '헤헤'],
      pet: ['헤헤…', '흐흐…', '좋아…♡'], miss: ['앗…', 'ㅠㅠ'], hit: ['에잇…!', '얍…!'],
      scared: ['히익…!', 'ㅠㅠ', '무서워…'], ride: ['와…!', '높다…!'], carry: ['무거워…', '…!'],
    },
    hachiware: {
      talk: ['어떻게든 되겠지~!', '치이카와~', '좋아!', '헤헤~'], cry: ['힝…'], click: ['앗!', '헤헤~', '간지러워~'],
      pet: ['헤헤~ 좋아!', '더 해줘~', '기분 좋다~'], miss: ['다음엔 내가!', '아앗~'], hit: ['얍!', '에잇!'],
      cheer: ['힘내~!', '할 수 있어!', '우사기 힘내!'], ride: ['영차!', '높다~!'], carry: ['영차영차~', '괜찮아~!'],
    },
    usagi: {
      talk: ['흐응?', '푸루루루루', '하아?'], shout: ['우라!', '야하!', '우라라!', '하아?!'], click: ['야하!', '우라!', '하아?'],
      pet: ['흐응♡', '푸루루…', '야하…♡'], miss: ['하아?!', '우라?!'], hit: ['우라!', '우라라!', '야하!'],
      ride: ['야하!', '우라~!'], carry: ['하아?', '흐응…'], flee: ['하아?!', '야하!'],
    },
  };
  const WELCOME = ['어서 와!', '왔다…!', '기다렸어~', '야하!'];

  // 캐릭터별 행동 가중치 [상태, 가중치, 최소초, 최대초]
  const BEHAVIOR = {
    chiikawa: [['walk', 30, 2, 6], ['run', 5, 1.2, 2.5], ['idle', 12, 1.5, 4], ['eat', 10, 3, 6], ['picnic', 6, 4, 8], ['lie', 13, 4, 9], ['sleep', 7, 6, 14], ['dance', 5, 2.5, 5], ['cry', 7, 2, 3.5], ['talk', 5, 2.2, 2.8], ['jump', 4], ['chase', 5, 3, 6]],
    hachiware: [['walk', 30, 2, 6], ['run', 8, 1.2, 2.5], ['idle', 12, 1.5, 4], ['picnic', 7, 4, 8], ['lie', 10, 4, 9], ['sleep', 5, 6, 14], ['dance', 14, 3, 6], ['cry', 2, 2, 3], ['talk', 9, 2.5, 3], ['jump', 6], ['chase', 7, 3, 6]],
    usagi: [['walk', 20, 1.5, 4], ['run', 18, 1.5, 3], ['idle', 6, 1, 2.5], ['sweep', 8, 3, 6], ['picnic', 4, 3, 6], ['lie', 6, 3, 7], ['sleep', 3, 5, 10], ['dance', 8, 2.5, 5], ['shout', 14, 1.4, 1.8], ['talk', 4, 2, 2.6], ['jump', 15], ['chase', 6, 2, 4]],
  };
  // 토벌 괴물이 있을 때의 역할
  const MONSTER_ROLE = {
    chiikawa: [['scared', 6, 2, 3.5], ['attack', 3], ['cheer', 1, 2, 3]],
    hachiware: [['cheer', 5, 2, 4], ['attack', 4]],
    usagi: [['attack', 8], ['shout', 2, 1.2, 1.6]],
  };
  // 머리 위에 친구를 태운 채로 할 수 있는 상태
  const CARRY_OK = new Set(['walk', 'idle', 'dance', 'talk', 'land', 'chase', 'train', 'train_lead', 'cheer', 'petted', 'eat', 'boing', 'ride', 'celebrate']);
  // 커서 쪽을 쳐다보는 상태
  const LOOK_STATES = new Set(['idle', 'talk', 'picnic', 'land', 'petted']);
  // 자세 이름 바꾸기 (상태 → 그림/움직임)
  const POSE_OF = {
    enter: 'walk', exit: 'run', chase: 'walk', train: 'walk', train_lead: 'walk', gofood: 'run', flee: 'run',
    attack: 'run', ride: 'idle', stretch: 'idle', boing: 'idle', celebrate: 'dance', cheer: 'dance',
  };

  const stage = document.getElementById('stage');
  const pets = [];
  const world = {
    stage, pets, foods: [], monsters: [], monster: null, away: false,
    cursor: { x: -1e4, y: -1e4, moved: -1e9 },
    GRAVITY,
    groundY: () => window.innerHeight,
    stageW: () => window.innerWidth,
    rand: (a, b) => a + Math.random() * (b - a),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  };
  const { rand, pick, groundY, stageW } = world;
  const now = () => performance.now();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let drag = null;
  let ignoring = true;

  function pickWeighted(list) {
    const total = list.reduce((s, b) => s + b[1], 0);
    let r = Math.random() * total;
    for (const [state, w, a = 1, b = 2] of list) {
      r -= w;
      if (r <= 0) return [state, a, b];
    }
    return ['idle', 1, 2];
  }

  const cursorActive = (ms) => now() - world.cursor.moved < ms;

  class Pet {
    constructor(type) {
      this.type = type;
      this.facing = Math.random() < 0.5 ? 1 : -1;
      // 화면 가장자리에서 걸어 들어옴
      this.x = this.facing > 0 ? -W / 2 : stageW() + W / 2;
      this.y = 0; // 바닥으로부터의 높이(px)
      this.vx = 0; this.vy = 0;
      this.t = Math.random() * 10;
      this.leaving = false;
      this.stretch = 1; // 말랑 늘이기 배율
      this.spring = null;
      this.mount = null; // 내가 올라탄 친구
      this.rider = null; // 내 머리 위의 친구
      this.food = null;
      this.fleeCd = 0;

      this.el = document.createElement('div');
      this.el.className = 'pet';
      this.el.style.width = W + 'px';
      this.el.style.height = H + 'px';
      this.shadow = document.createElement('div');
      this.shadow.className = 'shadow';
      this.body = document.createElement('div');
      this.body.className = 'pet-body';
      this.img = document.createElement('img');
      this.img.draggable = false;
      this.fx = document.createElement('div');
      this.fx.className = 'fx';
      this.body.append(this.img, this.fx);
      this.bubble = document.createElement('div');
      this.bubble.className = 'bubble';
      this.el.append(this.shadow, this.body, this.bubble);
      this.sprite = null;
      this.fxKind = null;
      this.el._pet = this;
      stage.appendChild(this.el);

      this.setState('enter', 99, rand(W, stageW() - W));
    }

    setState(state, dur = 3, target) {
      // 음식을 먹으러 가던 중이 아니면 찜해둔 음식은 놓아줌
      if (this.food && state !== 'eat' && state !== 'gofood') {
        if (this.food.claimedBy === this) this.food.claimedBy = null;
        this.food = null;
      }
      if (this.mount && state !== 'ride') {
        this.mount.rider = null;
        this.mount = null;
      }
      this.state = state;
      this.timer = dur;
      this.target = target;
      this.reached = false;
      const L = LINES[this.type];
      if (state === 'jump') {
        this.vy = rand(420, 620);
        this.vx = this.facing * rand(40, 140);
        this.y = Math.max(this.y, 1);
      }
      if (state === 'talk') this.say(pick(L.talk));
      if (state === 'cry') this.say(pick(L.cry || ['ㅠㅠ']));
      if (state === 'shout') this.say(pick(L.shout));
      if (state === 'cheer') this.say(pick(L.cheer || ['힘내!']));
      if (state === 'scared' && Math.random() < 0.6) this.say(pick(L.scared || ['히익!']));
      if (state === 'dizzy') this.say('어질어질…', 1.4);
    }

    say(text, sec = 1.8) {
      this.bubble.textContent = text;
      this.bubble.classList.add('show');
      clearTimeout(this.bubbleTimer);
      this.bubbleTimer = setTimeout(() => this.bubble.classList.remove('show'), sec * 1000);
    }

    next() {
      if (this.leaving) return this.setState('exit', 99); // 공중에서 퇴장 명령을 받았어도 착지 후 퇴장
      if (world.away) return this.setState('sleep', 1e9);
      const food = nearestFood(this);
      if (food) return this.goFood(food);
      let list = BEHAVIOR[this.type];
      if (world.monster) list = MONSTER_ROLE[this.type];
      else if (this.rider) list = list.filter(([s]) => CARRY_OK.has(s));
      let [state, a, b] = pickWeighted(list);
      if (state === 'chase' && !cursorActive(4000)) state = 'walk';
      if ((state === 'walk' || state === 'run') && Math.random() < 0.4) this.facing *= -1;
      this.setState(state, rand(a, b));
    }

    leave() {
      this.leaving = true;
      if (this.rider) this.rider.dismount(false);
      this.facing = this.x < stageW() / 2 ? -1 : 1;
      this.setState('exit', 99);
    }

    get airborne() {
      if (this.state === 'held' || this.state === 'stretch' || this.state === 'ride' || this.state === 'splat') return false;
      return this.y > 0 || this.vy > 0;
    }

    // 다른 캐릭터가 올라설 내 머리 높이
    topY() {
      return this.y + spriteFor(this.type, 'idle').height * 0.82 * this.stretch;
    }

    available() {
      return !this.leaving && !this.airborne && !world.away &&
        !['held', 'stretch', 'splat', 'ride', 'exit', 'enter'].includes(this.state);
    }

    // ---- 상호작용 ----
    petted() {
      if (this.leaving || this.airborne || ['held', 'stretch', 'splat', 'ride', 'exit', 'gofood', 'eat'].includes(this.state)) return;
      if (world.away) return;
      if (this.state !== 'petted') this.say(pick(LINES[this.type].pet), 1.5);
      this.setState('petted', 1.8);
    }

    knock(dir) {
      if (this.leaving || this.state === 'held' || this.state === 'stretch') return;
      if (this.rider) this.rider.dismount(false);
      this.setState('fall');
      this.vx = dir * rand(220, 340);
      this.vy = rand(380, 520);
      this.y = Math.max(this.y, 1);
      this.dizzyOnLand = true;
      this.say(pick(['으앗!', '꺄악!', '히익!']), 1);
    }

    mountOn(base) {
      this.vx = 0; this.vy = 0;
      this.setState('ride', rand(7, 14));
      this.mount = base;
      base.rider = this;
      this.y = base.topY();
      this.say(pick(LINES[this.type].ride), 1.4);
      if (Math.random() < 0.6) setTimeout(() => base.say(pick(LINES[base.type].carry), 1.4), 500);
      if (!CARRY_OK.has(base.state)) base.setState('idle', rand(1, 2));
    }

    dismount(jump) {
      this.setState('fall');
      this.y = Math.max(this.y, 1);
      if (jump) {
        this.vy = 380;
        this.vx = this.facing * rand(80, 160);
      } else {
        this.vy = 0; this.vx = 0;
      }
    }

    findHead(prevY) {
      if (world.away) return null; // 다들 자는 중에는 탑 쌓기 없음
      for (const q of pets) {
        if (q === this || q.rider || q.leaving || q.airborne) continue;
        if (['held', 'stretch', 'splat', 'exit'].includes(q.state)) continue;
        let c = q, cycle = false; // 내가 아래에 깔린 탑 위로는 못 올라감
        while (c) { if (c === this) { cycle = true; break; } c = c.mount; }
        if (cycle) continue;
        const top = q.topY();
        if (Math.abs(this.x - q.x) < 34 && prevY >= top - 2 && this.y <= top) return q;
      }
      return null;
    }

    splat(side) {
      this.setState('splat', 0.7);
      this.splatSide = side;
      this.facing = side;
      this.vx = 0; this.vy = 0;
      this.say('철퍽!', 1);
    }

    goFood(food) {
      this.setState('gofood', 99);
      this.food = food;
      this.facing = Math.sign(food.x - this.x) || this.facing;
    }

    finishEat() {
      const f = this.food;
      this.food = null;
      if (f) f.remove();
      this.setState('petted', 1.4);
      this.say(pick(['배부르다~', '맛있어…!', '냠!']), 1.4);
    }

    // ---- 매 프레임 ----
    update(dt) {
      this.t += dt;
      if (this.fleeCd > 0) this.fleeCd -= dt;
      if (this.spring) { // 말랑 늘이기를 놓으면 띠용~ 하고 원래대로
        const a = -320 * (this.stretch - 1) - 9 * this.spring.v;
        this.spring.v += a * dt;
        this.stretch += this.spring.v * dt;
        if (Math.abs(this.stretch - 1) < 0.005 && Math.abs(this.spring.v) < 0.05) {
          this.stretch = 1; this.spring = null;
        }
      }
      switch (this.state) {
        case 'held': case 'stretch': return;
        case 'ride': return this.updateRide(dt);
        case 'splat': return this.updateSplat(dt);
      }
      if (this.airborne) return this.updateAir(dt);
      this.updateGround(dt);
    }

    updateRide(dt) {
      const b = this.mount;
      if (!b || !pets.includes(b) || b.leaving || world.away || !CARRY_OK.has(b.state)) return this.dismount(false);
      this.x = b.x;
      this.y = b.topY();
      this.facing = b.facing;
      this.timer -= dt;
      if (this.timer <= 0 || world.monster) this.dismount(true);
    }

    updateSplat(dt) {
      this.timer -= dt;
      if (this.timer > 0) return;
      this.y -= 70 * dt; // 주르륵 미끄러짐
      if (this.y <= 0) {
        this.y = 0;
        this.setState('dizzy', 2.5);
      }
    }

    updateAir(dt) {
      const prevY = this.y;
      const minX = W / 2, maxX = stageW() - W / 2;
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      this.x += this.vx * dt;
      if (this.x < minX || this.x > maxX) {
        const side = this.x < minX ? -1 : 1;
        this.x = side < 0 ? minX : maxX;
        if (Math.abs(this.vx) > 550 && this.y > 20) return this.splat(side);
        this.vx = -side * Math.abs(this.vx) * 0.6;
        this.facing = -side;
      }
      const m = world.monster;
      if (this.attacking && m && m.hits(this)) {
        m.hit(this);
        const dir = Math.sign(this.x - m.x) || 1;
        this.vx = dir * 240;
        this.vy = Math.max(this.vy, 320);
        this.attacking = false;
        this.say(pick(LINES[this.type].hit), 0.9);
      }
      if (this.vy < 0 && !this.rider) {
        const base = this.findHead(prevY);
        if (base) return this.mountOn(base);
      }
      if (this.y <= 0) {
        this.y = 0; this.vy = 0; this.vx = 0;
        this.attacking = false;
        if (this.dizzyOnLand) {
          this.dizzyOnLand = false;
          this.setState('dizzy', 2.6);
        } else if (this.welcomeChase) {
          this.welcomeChase = false;
          this.setState('chase', 4);
        } else {
          this.setState('land', 0.18);
        }
      }
    }

    updateGround(dt) {
      this.timer -= dt;
      const speed = CHARS[this.type].speed;
      const minX = W / 2, maxX = stageW() - W / 2;
      const c = world.cursor;
      const m = world.monster;
      const walk = (dir, v) => {
        this.x += dir * v * dt;
        if (this.x < minX) { this.x = minX; this.facing = 1; return true; }
        if (this.x > maxX) { this.x = maxX; this.facing = -1; return true; }
        return false;
      };

      switch (this.state) {
        case 'enter':
          this.x += this.facing * speed * dt;
          if ((this.facing > 0 && this.x >= this.target) || (this.facing < 0 && this.x <= this.target)) this.next();
          return;
        case 'exit':
          this.x += this.facing * speed * 2 * dt;
          if (this.x < -W || this.x > stageW() + W) this.remove();
          return;
        case 'walk':
        case 'train_lead':
          walk(this.facing, this.state === 'train_lead' ? 55 : speed);
          break;
        case 'run':
          walk(this.facing, speed * 2.6);
          break;
        case 'flee':
          walk(this.facing, speed * 2.8);
          break;
        case 'dizzy':
          walk(1, Math.sin(this.t * 2.5) * 25);
          break;
        case 'boing':
          if (!this.spring) return this.next();
          break;
        case 'chase': { // 커서 따라가기
          if (!cursorActive(6000)) return this.next();
          const dx = clamp(c.x, minX, maxX) - this.x;
          if (Math.abs(dx) > 22) {
            this.reached = false;
            this.facing = Math.sign(dx);
            walk(this.facing, speed * (this.type === 'usagi' ? 2.2 : 1.4));
          } else {
            if (!this.reached) { this.reached = true; if (Math.random() < 0.5) this.say('?', 0.8); }
            // 커서가 바닥 가까이 있으면 잡으려고 폴짝
            if (groundY() - c.y < 190 && Math.random() < dt * 1.5) {
              this.setState('jump');
              this.vx = 0;
              this.vy = rand(450, 600);
              return;
            }
          }
          break;
        }
        case 'gofood': {
          const f = this.food;
          if (!f || !world.foods.includes(f)) return this.next();
          const dx = f.x - this.x;
          if (Math.abs(dx) > 16) {
            this.facing = Math.sign(dx);
            walk(this.facing, speed * 2.2);
          } else if (!f.claimedBy) {
            f.claimedBy = this;
            this.setState('eat', 3);
            this.food = f;
            this.say('냠냠!', 1.2);
          } else {
            // 한발 늦음
            this.food = null;
            this.say(pick(LINES[this.type].miss), 1.4);
            if (this.type === 'chiikawa') this.setState('cry', 2);
            else this.setState('idle', 1.5);
          }
          return;
        }
        case 'train': { // 기차놀이: 앞 친구를 졸졸
          const prev = this.trainPrev;
          if (!prev || !pets.includes(prev) || !['train', 'train_lead'].includes(prev.state)) return this.next();
          const dx = prev.x - prev.facing * 62 - this.x;
          if (Math.abs(dx) > 3) {
            this.facing = Math.sign(dx);
            this.x += Math.sign(dx) * Math.min(Math.abs(dx), 140 * dt);
          } else {
            this.facing = prev.facing;
          }
          return;
        }
        case 'attack': { // 괴물에게 돌격
          if (!m) return this.next();
          const dx = m.x - this.x;
          this.facing = Math.sign(dx) || this.facing;
          if (Math.abs(dx) < m.halfW() + 30) {
            this.vy = rand(480, 560);
            this.vx = this.facing * rand(220, 300);
            this.y = 1;
            this.attacking = true;
          } else {
            walk(this.facing, speed * 2.2);
          }
          return;
        }
        case 'scared': { // 괴물 반대쪽으로 도망
          if (!m) return this.next();
          const dir = Math.sign(this.x - m.x) || 1;
          this.facing = dir;
          if (Math.abs(this.x - m.x) < 400) walk(dir, speed * 1.8);
          break;
        }
        case 'cheer':
          if (!m) return this.next();
          this.facing = Math.sign(m.x - this.x) || this.facing;
          break;
      }

      // 커서 쳐다보기
      if (LOOK_STATES.has(this.state) && cursorActive(3000) && Math.abs(c.x - this.x) < 400 && Math.abs(c.x - this.x) > 12) {
        this.facing = Math.sign(c.x - this.x);
      }
      // 우사기는 커서가 가까이 오면 도망
      if (this.type === 'usagi' && this.fleeCd <= 0 && ['walk', 'idle', 'talk', 'sweep'].includes(this.state) && cursorActive(400)) {
        const cy = groundY() - this.y - 50;
        if (Math.hypot(c.x - this.x, c.y - cy) < 110) {
          this.facing = Math.sign(this.x - c.x) || 1;
          this.setState('flee', 1.2);
          this.fleeCd = 5;
          if (Math.random() < 0.6) this.say(pick(LINES.usagi.flee), 0.9);
          return;
        }
      }

      if (this.timer <= 0) {
        if (this.state === 'eat' && this.food) this.finishEat();
        else this.next();
      }
    }

    pose() {
      if (this.state === 'held') return 'held';
      if (this.airborne) return this.vy > 0 ? 'jump' : 'fall';
      if (this.state === 'chase' && this.reached) return 'idle';
      return POSE_OF[this.state] || this.state;
    }

    draw() {
      const pose = this.pose();
      const sp = spriteFor(this.type, pose);
      if (this.sprite !== sp.name) {
        this.sprite = sp.name;
        this.img.src = sp.src;
        this.img.style.height = sp.height + 'px';
      }
      const m = motion(pose, this.t, this.type);
      let sx = m.sx, sy = m.sy;
      if (this.stretch !== 1) {
        sy *= this.stretch;
        sx /= Math.sqrt(Math.max(0.3, this.stretch));
      }
      const extra = this.dizzyOnLand && this.state === 'held' ? 'stars' : m.extra;
      this.body.style.transform =
        `translate(-50%, ${(-m.y).toFixed(1)}px) scaleX(${this.facing}) rotate(${m.rot.toFixed(1)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      if (extra || this.fxKind) {
        this.fx.innerHTML = effects(extra, this.t);
        this.fx.style.transform = `scaleX(${this.facing})`; // 효과 글자는 뒤집히지 않게
        this.fxKind = extra;
      }
      const ground = this.mount ? 0 : this.y; // 올라타 있으면 그림자 없음
      const s = Math.max(0.3, 1 - ground / 300);
      this.shadow.style.opacity = this.mount ? '0' : '1';
      this.shadow.style.transform = `translate(-50%, ${ground.toFixed(1)}px) scale(${s.toFixed(2)})`;
      const left = this.x - W / 2;
      const top = groundY() - H - this.y;
      this.el.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
      let level = 0;
      for (let c = this.mount; c; c = c.mount) level++;
      // 낮게 있는 캐릭터가 앞쪽, 탑 위에 올라탄 캐릭터는 아래 친구보다 앞쪽
      this.el.style.zIndex = String(level ? 1100 + level : Math.round(1000 - this.y));
    }

    remove() {
      const i = pets.indexOf(this);
      if (i >= 0) pets.splice(i, 1);
      if (this.rider) this.rider.dismount(false);
      if (this.mount) this.mount.rider = null;
      if (this.food && this.food.claimedBy === this) this.food.claimedBy = null;
      this.el.remove();
      reportCounts();
    }
  }

  // ---- 간식 ----
  class Food {
    constructor(x, emoji) {
      this.emoji = emoji || pick(FOODS);
      this.x = x;
      this.y = groundY() - 40;
      this.vy = 0;
      this.landed = false;
      this.claimedBy = null;
      this.el = document.createElement('div');
      this.el.className = 'food';
      this.el.textContent = this.emoji;
      stage.appendChild(this.el);
    }

    update(dt) {
      if (this.landed) return;
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        if (this.vy < -400) {
          this.vy = -this.vy * 0.3; // 통 튀고
        } else {
          this.vy = 0;
          this.landed = true;
          onFoodLanded(this);
        }
      }
    }

    draw() {
      const eater = this.claimedBy;
      const s = eater && eater.state === 'eat' ? Math.max(0.2, eater.timer / 3) : 1;
      this.el.style.transform = `translate(${(this.x - 18).toFixed(1)}px, ${(groundY() - this.y - 36).toFixed(1)}px) scale(${s.toFixed(2)})`;
    }

    remove() {
      const i = world.foods.indexOf(this);
      if (i >= 0) world.foods.splice(i, 1);
      this.el.remove();
    }
  }

  function nearestFood(p) {
    let best = null, bd = Infinity;
    for (const f of world.foods) {
      if (!f.landed || f.claimedBy) continue;
      const d = Math.abs(f.x - p.x);
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }

  function dropFood(x, emoji) {
    if (world.foods.length >= 6) return;
    const fx = x == null ? rand(80, stageW() - 80) : clamp(x, 40, stageW() - 40);
    world.foods.push(new Food(fx, emoji));
  }

  function onFoodLanded(food) {
    for (const p of pets) {
      if (!p.available() || ['gofood', 'eat'].includes(p.state)) continue;
      if (p.state === 'sleep' || p.state === 'lie') p.say('!', 0.8);
      else if (Math.random() < 0.5) p.say(pick(['!', '간식이다!', '냠…?']), 1);
      p.goFood(nearestFood(p) || food);
    }
  }

  // ---- 기차놀이 ----
  function startTrain() {
    const cand = pets.filter((p) => p.available() && !['eat', 'gofood', 'boing'].includes(p.state));
    if (cand.length < 2) {
      if (cand[0]) cand[0].say('친구가 더 필요해…', 1.6);
      return false;
    }
    const leader = pick(cand);
    const rest = cand.filter((p) => p !== leader).sort((a, b) => Math.abs(a.x - leader.x) - Math.abs(b.x - leader.x));
    leader.setState('train_lead', rand(10, 15));
    leader.say('칙칙폭폭~!', 2);
    let prev = leader;
    for (const p of rest) {
      p.trainPrev = prev;
      p.setState('train', 1e9);
      prev = p;
    }
    setTimeout(() => { if (rest.length) pick(rest).say('뿌우~!', 1.4); }, 1200);
    return true;
  }

  // ---- 토벌 ----
  let lastMonsterAt = now();
  function summonMonster(kind) {
    if (world.monster || world.away || !pets.some((p) => !p.leaving)) return;
    lastMonsterAt = now();
    const m = new window.Monster(world, kind || (Math.random() < 0.65 ? 'beast' : 'mermaid'));
    world.monster = m;
    world.monsters.push(m);
    for (const p of pets) {
      if (p.state === 'ride') p.dismount(true);
      if (!p.available()) continue;
      p.say(pick(['!!', '괴물이다…!', '토벌이다!']), 1.4);
      p.next();
    }
  }

  world.onMonsterGone = (m, defeated) => {
    if (world.monster !== m) return;
    world.monster = null;
    for (const p of pets) {
      if (!p.available()) continue;
      if (defeated) {
        p.setState('celebrate', rand(2.5, 3.5));
        p.say(pick(['토벌 성공!', '해냈다…!', '야하!', '우라!']), 2);
      } else {
        p.say('휴…', 1.2);
        p.next();
      }
    }
    if (defeated) setTimeout(() => dropFood(m.x, '🌰'), 600); // 보상 쿠리만주
  };

  // ---- 자리 비움 ----
  api.onAway(() => {
    world.away = true;
    if (world.monster) world.monster.leave('…');
    for (const p of pets) {
      if (p.leaving || p.state === 'held' || p.state === 'stretch') continue;
      p.setState('sleep', 1e9);
    }
  });
  api.onBack(() => {
    if (!world.away) return;
    world.away = false;
    pets.forEach((p, i) => setTimeout(() => {
      if (!pets.includes(p) || p.leaving || p.state === 'held' || p.state === 'stretch') return;
      p.say(pick(WELCOME), 2.2);
      p.welcomeChase = true; // 착지하면 커서 쪽으로 달려옴
      if (!p.airborne) {
        p.setState('jump');
        p.vx = 0;
      }
    }, i * 180));
  });

  // ---- 커서 위치 (메인 프로세스가 0.1초마다 알려줌) ----
  function updateCursor(x, y) {
    const c = world.cursor;
    if (Math.abs(x - c.x) + Math.abs(y - c.y) > 2) c.moved = now();
    c.x = x; c.y = y;
  }
  api.onCursor((p) => updateCursor(p.x, p.y));

  function reportCounts() {
    const counts = { chiikawa: 0, hachiware: 0, usagi: 0 };
    for (const p of pets) if (!p.leaving) counts[p.type]++;
    api.reportCounts(counts);
  }

  function spawn(type) {
    if (!CHARS[type]) return;
    if (pets.filter((p) => !p.leaving).length >= MAX_PETS) return;
    const p = new Pet(type);
    pets.push(p);
    if (world.away) p.setState('sleep', 1e9);
    reportCounts();
  }

  function clearAll() {
    for (const p of pets) if (!p.leaving) p.leave();
    if (world.monster) world.monster.leave();
    for (const f of world.foods.slice()) f.remove();
    reportCounts();
  }

  api.onSpawn(spawn);
  api.onClear(clearAll);
  api.onEvent((name) => {
    if (name === 'food') dropFood();
    else if (name === 'train') startTrain();
    else if (name === 'monster') summonMonster();
  });

  // ---- 마우스: 캐릭터·괴물 위에서만 클릭을 받고, 나머지는 아래 창으로 통과 ----
  function setIgnore(v) {
    if (v === ignoring) return;
    ignoring = v;
    api.setIgnore(v);
  }

  function targetFromEvent(e) {
    const el = e.target && e.target.closest ? e.target.closest('.pet, .monster') : null;
    return el ? (el._pet || el._monster) : null;
  }

  // 쓰담쓰담: 캐릭터 위에서 좌우로 문지르기
  function rub(p, x) {
    const t = now();
    const r = p.rub || (p.rub = { lx: x, dir: 0, flips: [], lt: t });
    if (t - r.lt > 300) { r.lx = x; r.dir = 0; r.flips.length = 0; }
    r.lt = t;
    const dx = x - r.lx;
    if (Math.abs(dx) < 3) return;
    const d = Math.sign(dx);
    if (r.dir && d !== r.dir) r.flips.push(t);
    r.dir = d;
    r.lx = x;
    r.flips = r.flips.filter((ft) => t - ft < 1200);
    if (r.flips.length >= 3) {
      r.flips.length = 0;
      p.petted();
    }
  }

  window.addEventListener('mousemove', (e) => {
    updateCursor(e.clientX, e.clientY);
    if (drag) {
      const p = drag.pet;
      if (drag.stretch) {
        p.stretch = clamp(1 + (drag.sy - e.clientY) / 90, 0.55, 2.1);
        return;
      }
      const t = now();
      const dtm = Math.max(1, t - drag.lt) / 1000;
      drag.vx = (e.clientX - drag.lx) / dtm;
      drag.vy = -(e.clientY - drag.ly) / dtm;
      drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = t;
      if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 4) {
        drag.moved = true;
        if (p.rider) p.rider.dismount(false);
        p.setState('held', 1e9);
      }
      if (drag.moved) {
        p.x = e.clientX - drag.ox;
        p.y = Math.max(0, groundY() - (e.clientY - drag.oy) - H);
        if (Math.abs(drag.vx) > 30) p.facing = drag.vx > 0 ? 1 : -1;
        // 빠르게 좌우로 흔들면 어질어질
        if (Math.abs(drag.vx) > 500) {
          const sgn = Math.sign(drag.vx);
          if (drag.shakeDir && sgn !== drag.shakeDir) drag.shakes.push(t);
          drag.shakeDir = sgn;
          drag.shakes = drag.shakes.filter((st) => t - st < 1500);
          if (drag.shakes.length >= 4 && !p.dizzyOnLand) {
            p.dizzyOnLand = true;
            p.say('으아아아~', 1.2);
          }
        }
      }
      return;
    }
    const hit = targetFromEvent(e);
    setIgnore(!hit);
    if (hit instanceof Pet && e.buttons === 0) rub(hit, e.clientX);
  });

  window.addEventListener('mousedown', (e) => {
    const hit = targetFromEvent(e);
    if (!hit) return;
    if (hit instanceof window.Monster) {
      if (e.button === 0) hit.hit(null); // 클릭으로 같이 토벌
      return;
    }
    const p = hit;
    if (p.leaving) return;
    if (e.button === 2) { p.say('안녕~', 1); p.leave(); reportCounts(); return; }
    if (e.button !== 0) return;
    const rect = p.el.getBoundingClientRect();
    drag = {
      pet: p, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, lt: now(), t0: now(),
      ox: e.clientX - (rect.left + W / 2), oy: e.clientY - rect.top, vx: 0, vy: 0,
      moved: false, stretch: false, shakes: [], shakeDir: 0,
    };
  });

  window.addEventListener('mouseup', () => {
    if (!drag) return;
    const { pet: p, moved } = drag;
    if (drag.stretch) {
      p.spring = { v: 0 };
      p.setState('boing', 3);
      if (Math.abs(p.stretch - 1) > 0.15) p.say('띠용~', 1);
    } else if (!moved) {
      // 클릭: 깡충 뛰며 한마디
      p.say(pick(LINES[p.type].click), 1.2);
      if (p.state === 'ride') p.dismount(true);
      else if (!p.airborne) p.setState('jump');
    } else {
      // 던지기
      p.setState('fall');
      p.vx = clamp(drag.vx * 0.6, -900, 900);
      p.vy = clamp(drag.vy * 0.6, -200, 900);
      if (p.y <= 0 && p.vy <= 0) {
        p.y = 0; p.vy = 0; p.vx = 0;
        if (p.dizzyOnLand) { p.dizzyOnLand = false; p.setState('dizzy', 2.6); } else p.setState('land', 0.18);
      }
    }
    drag = null;
  });

  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- 메인 루프 ----
  let last = now();
  let eventClock = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;

    // 꾹 누르고 가만히 있으면 말랑 늘이기 시작
    if (drag && !drag.moved && !drag.stretch && t - drag.t0 > STRETCH_HOLD_MS) {
      const p = drag.pet;
      if (!p.airborne && !['ride', 'splat', 'exit'].includes(p.state)) {
        drag.stretch = true;
        if (p.rider) p.rider.dismount(false);
        p.spring = null;
        p.setState('stretch', 1e9);
      }
    }

    // 가끔 저절로 일어나는 이벤트 (1초마다 확률 체크)
    eventClock += dt;
    if (eventClock >= 1) {
      eventClock = 0;
      const n = pets.filter((p) => !p.leaving).length;
      if (!world.away && !world.monster) {
        if (n >= 3 && Math.random() < 1 / 120) startTrain();
        if (n >= 1 && t - lastMonsterAt > 5 * 60 * 1000 && Math.random() < 1 / 300) summonMonster();
      }
    }

    for (const p of pets.slice()) p.update(dt);
    for (const f of world.foods.slice()) f.update(dt);
    for (const m of world.monsters) m.update(dt);
    world.monsters = world.monsters.filter((m) => !m.gone);
    for (const p of pets) p.draw();
    for (const f of world.foods) f.draw();
    for (const m of world.monsters) m.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener('resize', () => {
    for (const p of pets) p.x = clamp(p.x, W / 2, stageW() - W / 2);
  });

  // 브라우저 미리보기/테스트용
  window.__pets = { spawn, clearAll, pets, world, dropFood, startTrain, summonMonster, updateCursor };
})();
