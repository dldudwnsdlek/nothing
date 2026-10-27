// 캐릭터 그림(스프라이트)과 자세별 움직임 정의 (브라우저/Electron 렌더러 공용)
// 스프라이트는 저장소 루트의 사진들에서 tools/make_sprites.py 로 배경을 지워 만든 것입니다.
(function (root) {
  const CHARS = {
    chiikawa: { name: '치이카와', speed: 55 },
    hachiware: { name: '하치와레', speed: 65 },
    usagi: { name: '우사기', speed: 85 },
  };

  // 스프라이트 파일과 화면에 보일 높이(px)
  const SPRITES = {
    chiikawa_1: 88, chiikawa_2: 84, chiikawa_3: 82, chiikawa_picnic: 74,
    hachiware_1: 92, hachiware_2: 80, hachiware_3: 92, hachiware_picnic: 80,
    usagi_1: 104, usagi_2: 112, usagi_3: 104, usagi_picnic: 100,
  };

  // 자세 → 캐릭터별로 쓸 그림
  const POSE_SPRITE = {
    chiikawa: { default: 1, eat: 2, held: 3, fall: 3, cry: 3, scared: 3, picnic: 'picnic' },
    hachiware: { default: 1, dance: 2, jump: 3, talk: 3, held: 3, petted: 3, photo: 3, picnic: 'picnic' },
    usagi: { default: 1, run: 2, shout: 2, sweep: 3, picnic: 'picnic' },
  };

  function spriteFor(type, pose) {
    const map = POSE_SPRITE[type];
    const key = pose in map ? map[pose] : map.default;
    const name = `${type}_${key}`;
    return { name, src: `sprites/${name}.png`, height: SPRITES[name] };
  }

  // 자세별 움직임. 기준점은 그림의 발밑 가운데.
  // 반환: { y(위로 px), rot(deg), sx, sy, extra }
  function motion(pose, t, type) {
    const m = { y: 0, rot: 0, sx: 1, sy: 1, extra: null };
    let ph;
    switch (pose) {
      case 'walk':
        ph = t * 9;
        m.y = Math.abs(Math.sin(ph)) * 5;
        m.rot = Math.sin(ph) * 5;
        m.sy = 1 - Math.abs(Math.cos(ph)) * 0.03;
        break;
      case 'run':
        ph = t * 15;
        m.y = Math.abs(Math.sin(ph)) * 9;
        m.rot = 8 + Math.sin(ph) * 6;
        m.extra = 'dust';
        break;
      case 'idle':
      case 'sit':
      case 'picnic':
        m.sy = 1 + Math.sin(t * 2.2) * 0.025;
        m.sx = 1 - Math.sin(t * 2.2) * 0.012;
        break;
      case 'eat':
        m.sy = 1 + Math.sin(t * 6) * 0.03;
        m.rot = Math.sin(t * 3) * 2;
        m.extra = 'sparkle';
        break;
      case 'lie': // 첫 사진처럼 납작하게 엎드린 찹쌀떡 자세
        m.sx = 1.22 + Math.sin(t * 1.6) * 0.01;
        m.sy = 0.66 + Math.sin(t * 1.6) * 0.015;
        break;
      case 'sleep':
        m.sx = 1.25;
        m.sy = 0.62 + Math.sin(t * 1.4) * 0.025;
        m.extra = 'zzz';
        break;
      case 'jump':
        m.rot = -6;
        m.sx = 0.94; m.sy = 1.08;
        break;
      case 'fall':
        m.rot = Math.sin(t * 10) * 8;
        break;
      case 'held':
        m.rot = Math.sin(t * 5) * 14;
        m.y = Math.sin(t * 10) * 2;
        break;
      case 'land':
        m.sx = 1.18; m.sy = 0.82;
        break;
      case 'dance':
        ph = t * 6;
        m.rot = Math.sin(ph) * 12;
        m.y = Math.abs(Math.sin(ph * 2)) * 6;
        m.extra = 'notes';
        break;
      case 'cry':
        m.rot = Math.sin(t * 28) * 2;
        m.sy = 1 + Math.sin(t * 9) * 0.02;
        m.extra = 'tears';
        break;
      case 'talk':
        m.y = Math.abs(Math.sin(t * 7)) * 3;
        m.sy = 1 + Math.sin(t * 14) * 0.02;
        break;
      case 'shout':
        m.y = 3 + Math.abs(Math.sin(t * 20)) * 4;
        m.rot = Math.sin(t * 25) * 5;
        m.sx = 1.05; m.sy = 1.05;
        break;
      case 'petted': // 쓰담쓰담: 녹아내리듯 말랑
        m.sx = 1.12 + Math.sin(t * 4) * 0.02;
        m.sy = 0.86 - Math.sin(t * 4) * 0.02;
        m.rot = Math.sin(t * 3) * 4;
        m.extra = 'hearts';
        break;
      case 'dizzy':
        m.rot = Math.sin(t * 4) * 11;
        m.y = Math.abs(Math.sin(t * 2)) * 2;
        m.extra = 'stars';
        break;
      case 'hang': // 벽·천장에 매달려 흔들흔들
        m.rot = Math.sin(t * 2.2) * 10;
        m.sy = 1 + Math.sin(t * 4.4) * 0.02;
        break;
      case 'photo': // 기념사진 포즈: 살짝 통통
        m.y = Math.abs(Math.sin(t * 3)) * 2;
        m.sy = 1 + Math.sin(t * 6) * 0.015;
        break;
      case 'splat': // 벽에 철퍽
        m.sx = 0.58; m.sy = 1.12;
        break;
      case 'scared':
        m.rot = Math.sin(t * 40) * 3;
        m.sy = 0.95;
        m.extra = type === 'chiikawa' ? 'tears' : 'sweat';
        break;
      case 'sweep':
        m.rot = Math.sin(t * 5) * 7;
        m.y = Math.abs(Math.sin(t * 5)) * 2;
        m.extra = 'dust';
        break;
    }
    return m;
  }

  // 그림 위에 겹치는 효과 (Zzz, 음표, 눈물, 먼지 등). 좌표: 그림 박스 기준 0~100
  function effects(kind, t) {
    let s = '';
    const fade = (k) => Math.sin(k * Math.PI).toFixed(2);
    if (kind === 'zzz') {
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.6 + i / 3) % 1;
        s += `<text x="${70 + k * 22}" y="${40 - k * 45}" font-size="${12 + k * 10}" font-weight="700" fill="#6c7fb8" opacity="${fade(k)}">Z</text>`;
      }
    } else if (kind === 'notes') {
      for (let i = 0; i < 2; i++) {
        const k = (t * 0.7 + i / 2) % 1;
        s += `<text x="${(i ? -2 : 88) + Math.sin(k * 6) * 4}" y="${30 - k * 40}" font-size="18" fill="#e98bb0" opacity="${fade(k)}">♪</text>`;
      }
    } else if (kind === 'tears') {
      const k = (t * 2.5) % 1;
      s += `<path d="M 30 45 q -6 ${10 + k * 10} -3 ${20 + k * 14}" stroke="#7ec3f2" stroke-width="4" fill="none" stroke-linecap="round" opacity=".9"/>
            <path d="M 70 45 q 6 ${10 + k * 10} 3 ${20 + k * 14}" stroke="#7ec3f2" stroke-width="4" fill="none" stroke-linecap="round" opacity=".9"/>`;
    } else if (kind === 'sparkle') {
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.9 + i / 3) % 1;
        const x = [8, 92, 50][i], y = [30, 25, -6][i];
        s += `<text x="${x}" y="${y}" font-size="${10 + Math.sin(k * Math.PI) * 6}" fill="#f2c14e" opacity="${fade(k)}" text-anchor="middle">✦</text>`;
      }
    } else if (kind === 'hearts') {
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.8 + i / 4) % 1;
        const x = 50 + Math.sin(i * 2.3 + k * 5) * 38;
        s += `<text x="${x.toFixed(1)}" y="${(25 - k * 50).toFixed(1)}" font-size="${12 + k * 8}" fill="#ff7fa8" opacity="${fade(k)}" text-anchor="middle">♥</text>`;
      }
    } else if (kind === 'stars') {
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + (i * Math.PI * 2) / 3;
        s += `<text x="${(50 + Math.cos(a) * 30).toFixed(1)}" y="${(2 + Math.sin(a) * 8).toFixed(1)}" font-size="15" fill="#f2c14e" stroke="#b8860b" stroke-width=".6" text-anchor="middle">★</text>`;
      }
    } else if (kind === 'sweat') {
      const k = (t * 1.5) % 1;
      s += `<path d="M 88 ${10 + k * 10} q 6 8 0 12 q -6 -4 0 -12 Z" fill="#9bd3f7" stroke="#5a9ccc" stroke-width="1" opacity="${(1 - k).toFixed(2)}"/>`;
    } else if (kind === 'dust') {
      for (let i = 0; i < 3; i++) {
        const k = (t * 2 + i / 3) % 1;
        s += `<circle cx="${50 - 30 - k * 25}" cy="${98 - k * 8}" r="${3 + k * 4}" fill="#d9cfc4" opacity="${(1 - k) * 0.7}"/>`;
      }
    }
    if (!s) return '';
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;font-family:sans-serif">${s}</svg>`;
  }

  root.ChiiDraw = {
    CHARS, SPRITES, spriteFor, motion, effects,
    POSES: ['idle', 'walk', 'run', 'sit', 'eat', 'lie', 'sleep', 'jump', 'fall', 'held', 'land', 'dance', 'cry', 'talk', 'shout', 'sweep', 'picnic', 'petted', 'dizzy', 'splat', 'scared', 'hang', 'photo'],
  };
})(typeof window !== 'undefined' ? window : globalThis);
