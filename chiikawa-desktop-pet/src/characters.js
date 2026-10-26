// 캐릭터 SVG 렌더러 (브라우저/Electron 렌더러 공용)
// 공식 그림이 아니라 도형으로 직접 그린 팬아트 스타일 캐릭터입니다.
(function (root) {
  const OUT = '#4b3a3a';
  const SW = 2.4;
  const NS = 'vector-effect="non-scaling-stroke"';

  const CHARS = {
    chiikawa: { name: '치이카와', body: '#ffffff', blush: '#ffb3c1', speed: 55 },
    hachiware: { name: '하치와레', body: '#ffffff', accent: '#8db2e0', blush: '#ffb3c1', speed: 65 },
    usagi: { name: '우사기', body: '#fff3c4', blush: '#ffb3a7', speed: 85 },
  };

  // 자세별 파라미터 계산. t: 초 단위 시간
  function poseParams(type, pose, t) {
    const p = {
      bob: 0, lean: 0, sx: 1, sy: 1,
      armL: 15, armR: 15,
      feet: 'stand', fx: [0, 0], fy: [0, 0],
      eyes: 'open', mouth: type === 'usagi' ? 'grin' : 'small',
      extra: null, earSway: Math.sin(t * 2) * 3,
    };
    const blink = (t % 3.7) < 0.13;
    let ph;
    switch (pose) {
      case 'idle':
        p.bob = Math.sin(t * 2.2) * 1.2;
        if (blink) p.eyes = 'blink';
        break;
      case 'walk':
        ph = t * 9;
        p.bob = Math.abs(Math.sin(ph)) * 2.5;
        p.fx = [Math.sin(ph) * 4, -Math.sin(ph) * 4];
        p.fy = [Math.max(0, Math.sin(ph)) * 3, Math.max(0, -Math.sin(ph)) * 3];
        p.armL = 15 + Math.sin(ph) * 25;
        p.armR = 15 - Math.sin(ph) * 25;
        p.lean = 3;
        if (blink) p.eyes = 'blink';
        break;
      case 'run':
        ph = t * 16;
        p.bob = Math.abs(Math.sin(ph)) * 4;
        p.fx = [Math.sin(ph) * 6, -Math.sin(ph) * 6];
        p.fy = [Math.max(0, Math.sin(ph)) * 5, Math.max(0, -Math.sin(ph)) * 5];
        p.armL = 50 + Math.sin(ph) * 40;
        p.armR = 50 - Math.sin(ph) * 40;
        p.lean = 10;
        p.earSway = Math.sin(ph) * 8 - 10;
        if (type === 'chiikawa') p.extra = 'sweat';
        if (type === 'usagi') p.mouth = 'wide';
        break;
      case 'sit':
        p.feet = 'sit';
        p.bob = -5;
        p.armL = p.armR = 25;
        if (blink) p.eyes = 'blink';
        break;
      case 'lie': // 사진 속 "엎드려서 빼꼼" 자세
        p.feet = 'hidden';
        p.sx = 1.22; p.sy = 0.7;
        p.bob = -3;
        p.armL = p.armR = 80;
        p.eyes = 'sleepy';
        p.sy += Math.sin(t * 1.6) * 0.012;
        break;
      case 'sleep':
        p.feet = 'hidden';
        p.sx = 1.25; p.sy = 0.66 + Math.sin(t * 1.5) * 0.02;
        p.bob = -3;
        p.armL = p.armR = 85;
        p.eyes = 'closed';
        p.mouth = 'dot';
        p.extra = 'zzz';
        break;
      case 'jump':
        p.armL = p.armR = 150;
        p.fy = [3, 3];
        p.eyes = 'happy';
        p.mouth = 'open';
        break;
      case 'fall':
        p.armL = p.armR = 160;
        p.eyes = 'surprised';
        p.mouth = 'open';
        p.earSway = -15;
        break;
      case 'held':
        p.feet = 'dangle';
        p.armL = p.armR = 165;
        p.lean = Math.sin(t * 5) * 10;
        p.fx = [Math.sin(t * 9) * 2, -Math.sin(t * 9) * 2];
        p.eyes = 'surprised';
        p.mouth = 'wavy';
        break;
      case 'land':
        p.sx = 1.15; p.sy = 0.86;
        p.armL = p.armR = 60;
        p.eyes = 'blink';
        break;
      case 'dance':
        ph = t * 6;
        p.armL = 90 + Math.sin(ph) * 70;
        p.armR = 90 - Math.sin(ph) * 70;
        p.lean = Math.sin(ph) * 9;
        p.bob = Math.abs(Math.sin(ph * 2)) * 3;
        p.fy = [Math.max(0, Math.sin(ph)) * 3, Math.max(0, -Math.sin(ph)) * 3];
        p.eyes = 'happy';
        p.mouth = 'open';
        p.extra = 'notes';
        break;
      case 'cry':
        p.armL = p.armR = 35 + Math.sin(t * 22) * 6;
        p.bob = Math.sin(t * 30) * 0.7;
        p.eyes = 'tear';
        p.mouth = 'wavy';
        p.extra = 'tears';
        break;
      case 'talk':
        p.armL = 40; p.armR = 20 + Math.abs(Math.sin(t * 4)) * 50;
        p.mouth = Math.sin(t * 14) > 0 ? 'open' : (type === 'usagi' ? 'grin' : 'small');
        p.bob = Math.abs(Math.sin(t * 7)) * 1.5;
        if (blink) p.eyes = 'blink';
        break;
      case 'shout':
        p.armL = p.armR = 125 + Math.sin(t * 18) * 8;
        p.mouth = 'wide';
        p.lean = -5;
        p.bob = 2 + Math.sin(t * 25) * 1;
        p.earSway = Math.sin(t * 18) * 6;
        break;
    }
    return p;
  }

  function arm(side, angle, color) {
    // side: -1 왼쪽, 1 오른쪽. angle 0 = 아래로 늘어뜨림, 180 = 위로
    const sx = side * 19;
    const rot = side < 0 ? angle : -angle;
    return `<g transform="translate(${sx} -24) rotate(${rot.toFixed(1)})">
      <ellipse cx="0" cy="7" rx="5.5" ry="9" fill="${color}" stroke="${OUT}" stroke-width="${SW}" ${NS}/></g>`;
  }

  function feet(p, color) {
    const f = (i, x) => {
      let fx = x + p.fx[i], fy = -4 - p.fy[i], rx = 7.5, ry = 4.8;
      if (p.feet === 'sit') { fx = x * 1.3; fy = -3; rx = 8; ry = 5.5; }
      if (p.feet === 'dangle') { fy = 2 + Math.abs(p.fx[i]); }
      return `<ellipse cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" rx="${rx}" ry="${ry}" fill="${color}" stroke="${OUT}" stroke-width="${SW}" ${NS}/>`;
    };
    if (p.feet === 'hidden') return '';
    return f(0, -10) + f(1, 10);
  }

  function ears(type, c, p) {
    const st = `stroke="${OUT}" stroke-width="${SW}" stroke-linejoin="round" ${NS}`;
    if (type === 'chiikawa') {
      return `<circle cx="-19" cy="-79" r="9" fill="${c.body}" ${st}/>
              <circle cx="19" cy="-79" r="9" fill="${c.body}" ${st}/>`;
    }
    if (type === 'hachiware') {
      return `<path d="M -31 -66 L -27 -95 Q -25 -97 -23 -95 L -8 -80 Z" fill="${c.accent}" ${st}/>
              <path d="M 31 -66 L 27 -95 Q 25 -97 23 -95 L 8 -80 Z" fill="${c.accent}" ${st}/>`;
    }
    // usagi: 긴 귀
    const s = p.earSway;
    return `<g transform="rotate(${(-8 + s).toFixed(1)} -10 -76)"><ellipse cx="-10" cy="-99" rx="7.5" ry="23" fill="${c.body}" ${st}/></g>
            <g transform="rotate(${(8 - s * 0.6).toFixed(1)} 10 -76)"><ellipse cx="10" cy="-99" rx="7.5" ry="23" fill="${c.body}" ${st}/></g>`;
  }

  function eye(x, y, kind, type) {
    const st = `stroke="${OUT}" stroke-width="2.2" stroke-linecap="round" fill="none" ${NS}`;
    const small = type === 'usagi';
    switch (kind) {
      case 'blink':
      case 'closed':
        return `<path d="M ${x - 4} ${y} q 4 3 8 0" ${st}/>`;
      case 'sleepy': // 반쯤 감긴 눈
        return `<path d="M ${x - 4.5} ${y - 0.5} h 9 a 4.5 3.2 0 0 1 -9 0 Z" fill="${OUT}" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round" ${NS}/>`;
      case 'happy':
        return `<path d="M ${x - 4} ${y + 1.5} q 4 -6 8 0" ${st}/>`;
      case 'surprised':
        return `<ellipse cx="${x}" cy="${y}" rx="${small ? 2.4 : 3}" ry="${small ? 3 : 5}" fill="${OUT}"/>`;
      case 'tear':
        return `<ellipse cx="${x}" cy="${y}" rx="3.8" ry="4.8" fill="${OUT}"/>
                <circle cx="${x + 1.2}" cy="${y - 1.8}" r="1.6" fill="#fff"/>
                <circle cx="${x - 1.4}" cy="${y + 1.6}" r="0.9" fill="#fff"/>`;
      default:
        if (small) return `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="2.9" fill="${OUT}"/>`;
        return `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="4.4" fill="${OUT}"/>
                <circle cx="${x + 1}" cy="${y - 1.6}" r="1.25" fill="#fff"/>`;
    }
  }

  function mouth(kind) {
    const st = `stroke="${OUT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" ${NS}`;
    switch (kind) {
      case 'open':
        return `<ellipse cx="0" cy="-41" rx="3.6" ry="4.2" fill="#c8545a" stroke="${OUT}" stroke-width="1.8" ${NS}/>`;
      case 'wide':
        return `<path d="M -8 -45 Q 0 -29 8 -45 Z" fill="#c8545a" stroke="${OUT}" stroke-width="1.8" stroke-linejoin="round" ${NS}/>`;
      case 'grin':
        return `<path d="M -5 -45 Q 0 -38 5 -45 Z" fill="#c8545a" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round" ${NS}/>`;
      case 'wavy':
        return `<path d="M -6 -42 q 1.5 -2.2 3 0 t 3 0 t 3 0 t 3 0" ${st}/>`;
      case 'dot':
        return `<circle cx="0" cy="-42" r="1.3" fill="${OUT}"/>`;
      default:
        return `<path d="M -3.2 -43.5 q 1.6 2.2 3.2 0 q 1.6 2.2 3.2 0" ${st}/>`;
    }
  }

  function extraFront(kind, t) {
    if (kind === 'tears') {
      const k = (t * 3) % 1;
      return `<path d="M -12 -48 q -3 12 -2 ${18 + k * 6}" stroke="#7ec3f2" stroke-width="3.2" fill="none" stroke-linecap="round" opacity=".9"/>
              <path d="M 12 -48 q 3 12 2 ${18 + k * 6}" stroke="#7ec3f2" stroke-width="3.2" fill="none" stroke-linecap="round" opacity=".9"/>`;
    }
    if (kind === 'sweat') {
      return `<path d="M 30 -70 q 5 7 0 10 q -5 -3 0 -10 Z" fill="#9bd3f7" stroke="#5a9ccc" stroke-width="1.2"/>`;
    }
    return '';
  }

  function extraOver(kind, t) {
    if (kind === 'zzz') {
      let s = '';
      for (let i = 0; i < 3; i++) {
        const k = ((t * 0.6 + i / 3) % 1);
        const x = 30 + k * 18, y = -60 - k * 45, o = Math.sin(k * Math.PI);
        s += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${10 + k * 8}" font-weight="700" fill="#6c7fb8" opacity="${o.toFixed(2)}" font-family="sans-serif">Z</text>`;
      }
      return s;
    }
    if (kind === 'notes') {
      let s = '';
      for (let i = 0; i < 2; i++) {
        const k = ((t * 0.7 + i / 2) % 1);
        const x = (i ? -38 : 34) + Math.sin(k * 6) * 4, y = -70 - k * 40, o = Math.sin(k * Math.PI);
        s += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="16" fill="#e98bb0" opacity="${o.toFixed(2)}" font-family="sans-serif">♪</text>`;
      }
      return s;
    }
    return '';
  }

  let clipSeq = 0;

  // state: { pose, t, facing(1|-1), air(px), uid }
  function render(type, state) {
    const c = CHARS[type];
    const t = state.t || 0;
    const p = poseParams(type, state.pose || 'idle', t);
    const uid = state.uid || ('c' + (++clipSeq));
    const facing = state.facing || 1;
    const air = state.air || 0;
    const look = p.eyes === 'sleepy' || p.eyes === 'closed' ? 0 : 1.5;
    const eyeY = type === 'usagi' ? -54 : -52;
    const eyeX = type === 'usagi' ? 10 : 12;
    const headStroke = `stroke="${OUT}" stroke-width="${SW}" ${NS}`;

    let pattern = '';
    if (type === 'hachiware') {
      pattern = `<clipPath id="hc-${uid}"><ellipse cx="0" cy="-55" rx="32" ry="28"/></clipPath>
        <g clip-path="url(#hc-${uid})" fill="${c.accent}">
          <path d="M -36 -90 L -3 -90 C -4 -74 -13 -63 -36 -59 Z"/>
          <path d="M 36 -90 L 3 -90 C 4 -74 13 -63 36 -59 Z"/>
        </g>`;
    }

    const shadowScale = Math.max(0.35, 1 - air / 260);
    const shadow = `<ellipse cx="0" cy="${(air + 1).toFixed(1)}" rx="${(24 * shadowScale * p.sx).toFixed(1)}" ry="${(4 * shadowScale).toFixed(1)}" fill="rgba(0,0,0,.13)"/>`;

    return `<svg viewBox="-60 -128 120 134" width="100%" height="100%" style="overflow:visible" xmlns="http://www.w3.org/2000/svg">
      ${shadow}
      <g transform="scale(${facing} 1) rotate(${p.lean.toFixed(1)}) scale(${p.sx.toFixed(3)} ${p.sy.toFixed(3)})">
        ${feet(p, c.body)}
        <g transform="translate(0 ${(-p.bob).toFixed(1)})">
          ${ears(type, c, p)}
          <ellipse cx="0" cy="-22" rx="22" ry="18" fill="${c.body}" ${headStroke}/>
          <ellipse cx="0" cy="-55" rx="32" ry="28" fill="${c.body}"/>
          ${pattern}
          <ellipse cx="0" cy="-55" rx="32" ry="28" fill="none" ${headStroke}/>
          <g transform="translate(${look} 0)">
            <ellipse cx="${-eyeX - 8}" cy="-44" rx="5.5" ry="3.2" fill="${c.blush}" opacity=".85"/>
            <ellipse cx="${eyeX + 8}" cy="-44" rx="5.5" ry="3.2" fill="${c.blush}" opacity=".85"/>
            ${eye(-eyeX, eyeY, p.eyes, type)}
            ${eye(eyeX, eyeY, p.eyes, type)}
            ${mouth(p.mouth)}
            ${extraFront(p.extra, t)}
          </g>
          ${arm(-1, p.armL, c.body)}
          ${arm(1, p.armR, c.body)}
        </g>
      </g>
      ${extraOver(p.extra, t)}
    </svg>`;
  }

  root.ChiiDraw = { CHARS, render, POSES: ['idle', 'walk', 'run', 'sit', 'lie', 'sleep', 'jump', 'fall', 'held', 'land', 'dance', 'cry', 'talk', 'shout'] };
})(typeof window !== 'undefined' ? window : globalThis);
