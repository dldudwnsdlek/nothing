// 토벌 이벤트에 나오는 괴물 (pets.js 가 world 를 넘겨서 생성)
(function () {
  // 스프라이트 이름 → 화면 높이(px)
  const SPR = { monster_sit: 150, monster_night: 140, monster_pounce: 165, mermaid: 135 };
  const BOX = 220; // 괴물 한 마리가 차지하는 영역

  const LINES = {
    beast: { enter: ['가오…', '크르릉…', '…!'], hurt: ['크앙!', '갸웃…?', '크릉!'], leave: '…흥!', down: '끼잉…' },
    mermaid: { enter: ['…♪', '후후…', '배고파…'], hurt: ['앗 따가!', '흥!'], leave: '…다음에 또 올게', down: '퐁당…' },
  };

  class Monster {
    constructor(world, kind) {
      this.w = world;
      this.kind = kind; // 'beast' | 'mermaid'
      this.hpMax = kind === 'mermaid' ? 7 : 10;
      this.hp = this.hpMax;
      const fromLeft = Math.random() < 0.5;
      this.facing = fromLeft ? 1 : -1;
      this.x = fromLeft ? -BOX / 2 : world.stageW() + BOX / 2;
      this.y = 0; this.vx = 0; this.vy = 0;
      this.t = 0; this.life = 0; this.hurt = 0;
      this.gone = false;

      this.el = document.createElement('div');
      this.el.className = 'monster';
      this.el.style.width = BOX + 'px';
      this.el.style.height = BOX + 'px';
      this.shadow = document.createElement('div');
      this.shadow.className = 'shadow big';
      this.body = document.createElement('div');
      this.body.className = 'monster-body';
      this.img = document.createElement('img');
      this.img.draggable = false;
      this.body.appendChild(this.img);
      this.hpBar = document.createElement('div');
      this.hpBar.className = 'hp';
      this.hpFill = document.createElement('div');
      this.hpFill.className = 'hp-fill';
      this.hpBar.appendChild(this.hpFill);
      this.bubble = document.createElement('div');
      this.bubble.className = 'bubble';
      this.el.append(this.shadow, this.body, this.hpBar, this.bubble);
      this.el._monster = this;
      world.stage.appendChild(this.el);
      this.sprite = null;

      this.setState('enter', 99, world.rand(world.stageW() * 0.3, world.stageW() * 0.7));
    }

    setState(state, dur = 2, target) {
      this.state = state;
      this.timer = dur;
      this.target = target;
    }

    say(text, sec = 1.6) {
      this.bubble.textContent = text;
      this.bubble.classList.add('show');
      clearTimeout(this.bubbleTimer);
      this.bubbleTimer = setTimeout(() => this.bubble.classList.remove('show'), sec * 1000);
    }

    get active() { return this.state !== 'defeated' && this.state !== 'leave' && !this.gone; }
    get airborne() { return this.y > 0 || this.vy > 0; }
    spriteName() {
      if (this.kind === 'mermaid') return 'mermaid';
      if (this.airborne) return 'monster_pounce';
      if (this.state === 'rest') return 'monster_night';
      return 'monster_sit';
    }
    height() { return SPR[this.spriteName()]; }
    halfW() { return this.height() * 0.42; }

    // 공격하러 날아온 캐릭터와 겹치는지
    hits(p) {
      return Math.abs(p.x - this.x) < this.halfW() + 10 && p.y < this.y + this.height() * 0.8;
    }

    nearestPet() {
      let best = null, bd = Infinity;
      for (const p of this.w.pets) {
        if (p.leaving) continue;
        const d = Math.abs(p.x - this.x);
        if (d < bd) { bd = d; best = p; }
      }
      return best;
    }

    hit(by) {
      if (!this.active) return;
      this.hp -= 1;
      this.hurt = 0.3;
      this.pop('-1');
      if (this.hp <= 0) return this.defeat();
      if (Math.random() < 0.35) this.say(this.w.pick(LINES[this.kind].hurt), 0.9);
      // 맞으면 잠깐 움찔하고 공격 대상을 바꿈
      if (!this.airborne && by) this.facing = Math.sign(by.x - this.x) || this.facing;
    }

    pop(text) {
      const d = document.createElement('div');
      d.className = 'pop';
      d.textContent = text;
      d.style.left = (this.x + this.w.rand(-30, 30)) + 'px';
      d.style.top = (this.w.groundY() - this.y - this.height() - 10) + 'px';
      this.w.stage.appendChild(d);
      setTimeout(() => d.remove(), 800);
    }

    defeat() {
      this.setState('defeated', 1.1);
      this.say(LINES[this.kind].down, 1.1);
      this.vx = 0; this.vy = 0;
      this.w.onMonsterGone(this, true);
    }

    leave(text) {
      if (!this.active) return;
      this.setState('leave', 99);
      this.facing = this.x < this.w.stageW() / 2 ? -1 : 1;
      this.say(text || LINES[this.kind].leave, 1.6);
      this.w.onMonsterGone(this, false);
    }

    pounce(target) {
      const dx = target.x - this.x;
      this.facing = Math.sign(dx) || this.facing;
      this.vy = this.kind === 'mermaid' ? 470 : 640;
      const flight = (2 * this.vy) / this.w.GRAVITY;
      this.vx = Math.max(-650, Math.min(650, dx / flight));
      this.y = 1;
      this.setState('pounce', 99);
    }

    // 착지하면 근처 캐릭터들이 튕겨 나감
    stomp() {
      if (this.kind === 'beast') this.say('쿵!', 0.6);
      for (const p of this.w.pets) {
        if (Math.abs(p.x - this.x) < this.halfW() + 45 && p.y < 30) p.knock(Math.sign(p.x - this.x) || 1);
      }
    }

    update(dt) {
      this.t += dt;
      this.life += dt;
      if (this.hurt > 0) this.hurt -= dt;
      const W = this.w.stageW();

      if (this.state === 'defeated') {
        this.timer -= dt;
        if (this.timer <= 0) this.remove();
        return;
      }
      if (this.active && this.life > 45) this.leave();

      if (this.airborne) {
        this.vy -= this.w.GRAVITY * dt;
        this.y += this.vy * dt;
        this.x = Math.max(this.halfW(), Math.min(W - this.halfW(), this.x + this.vx * dt));
        if (this.y <= 0) {
          this.y = 0; this.vy = 0; this.vx = 0;
          this.stomp();
          if (this.active) this.setState('rest', 1.4);
        }
        return;
      }

      this.timer -= dt;
      const speed = this.kind === 'mermaid' ? 75 : 60;
      switch (this.state) {
        case 'enter':
          this.x += this.facing * 90 * dt;
          if ((this.facing > 0 && this.x >= this.target) || (this.facing < 0 && this.x <= this.target)) {
            this.say(this.w.pick(LINES[this.kind].enter));
            this.setState('prowl', this.w.rand(1.5, 3));
          }
          break;
        case 'prowl': {
          const p = this.nearestPet();
          if (p) {
            const dx = p.x - this.x;
            if (Math.abs(dx) > 70) {
              this.facing = Math.sign(dx);
              this.x += this.facing * speed * dt;
            }
            if (this.timer <= 0) {
              if (Math.abs(dx) < 450) this.pounce(p);
              else this.setState('prowl', this.w.rand(1, 2));
            }
          } else if (this.timer <= 0) {
            this.leave();
          }
          break;
        }
        case 'rest':
          if (this.timer <= 0) this.setState('prowl', this.w.rand(1.5, 3));
          break;
        case 'leave':
          this.x += this.facing * 120 * dt;
          if (this.x < -BOX || this.x > W + BOX) this.remove();
          break;
      }
    }

    draw() {
      const name = this.spriteName();
      if (this.sprite !== name) {
        this.sprite = name;
        this.img.src = `sprites/${name}.png`;
        this.img.style.height = SPR[name] + 'px';
      }
      const t = this.t;
      let y = 0, rot = 0, sx = 1, sy = 1, dx = 0;
      if (this.airborne) {
        rot = this.vy > 0 ? -8 : 6;
      } else if (this.state === 'enter' || this.state === 'prowl' || this.state === 'leave') {
        if (this.kind === 'mermaid') { // 통통 튀며 이동
          y = Math.abs(Math.sin(t * 6)) * 14;
          rot = Math.sin(t * 6) * 8;
        } else { // 쿵쿵 걷기
          y = Math.abs(Math.sin(t * 5)) * 6;
          rot = Math.sin(t * 5) * 4;
        }
      } else if (this.state === 'rest') {
        sy = 1 + Math.sin(t * 2.5) * 0.03;
      }
      if (this.state === 'defeated') {
        const k = Math.max(0, this.timer / 1.1);
        rot = (1 - k) * 720;
        sx = sy = k;
        y = (1 - k) * 60;
      }
      if (this.hurt > 0) {
        dx = Math.sin(t * 70) * 5;
        this.img.style.filter = 'sepia(.6) saturate(5) hue-rotate(-35deg) brightness(1.05)';
      } else {
        this.img.style.filter = '';
      }
      this.body.style.transform =
        `translate(calc(-50% + ${dx.toFixed(1)}px), ${(-y).toFixed(1)}px) scaleX(${this.facing}) rotate(${rot.toFixed(1)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
      const h = SPR[name];
      this.hpBar.style.bottom = (h + 14 + y) + 'px';
      this.hpBar.style.opacity = this.state === 'defeated' ? '0' : '1';
      this.hpFill.style.width = (100 * Math.max(0, this.hp) / this.hpMax) + '%';
      this.bubble.style.bottom = (h + 30 + y) + 'px';
      const s = Math.max(0.3, 1 - this.y / 300);
      this.shadow.style.transform = `translate(-50%, ${this.y.toFixed(1)}px) scale(${s.toFixed(2)})`;
      this.el.style.transform =
        `translate(${(this.x - BOX / 2).toFixed(1)}px, ${(this.w.groundY() - BOX - this.y).toFixed(1)}px)`;
    }

    remove() {
      if (this.gone) return;
      this.gone = true;
      this.el.remove();
      if (this.w.monster === this) this.w.onMonsterGone(this, false);
    }
  }

  window.Monster = Monster;
})();
