"""배틀싸피 팀 대항전 로컬 시뮬레이터 (규칙은 OT/매뉴얼 기반 추정 구현)

사용법: python3 sim.py [게임수]
 - main.py 의 알고리즘 부분(Brain)을 그대로 불러와 6대(3:3)를 돌린다.
 - 옐로카드/런타임 에러/승패를 집계한다.
"""
import os
import random
import sys
import heapq
import time

HERE = os.path.dirname(os.path.abspath(__file__))
MAIN = os.path.join(HERE, '..', 'main.py')


def load_brain_module():
    src = open(MAIN, encoding='utf-8').read()
    s = src.index('DIR_VEC = ')
    e = src.index('brain = Brain()')
    ns = {'heapq': heapq, '__name__': 'bot'}
    exec(src[s:e], ns)
    return ns


BOT = load_brain_module()
Brain = BOT['Brain']
DIR_VEC = BOT['DIR_VEC']
DIR_ORDER = BOT['DIR_ORDER']

WORDS = ['BATTLESSAFY', 'SAMSUNG', 'HELLOWORLD', 'ALGORITHM', 'TANKATTACK', 'MEGAMISSILE',
         'SSAFYYOUTH', 'GOODLUCK', 'VICTORY', 'SOFTWAREACADEMY', 'PYTHONJAVA', 'TEAMBATTLE']

# 연습 맵 (OT 이미지에서 복원). A팀 포탑 (15,0), B팀 포탑 (0,15)
PRACTICE = [
    "GGGGGGGGGGGGGGGX",
    "GGTTGSSGGGGFGGGG",
    "GGTTGSSGGFGGGGGG",
    "GGGGGGGGGGGGGGGG",
    "GGRRGWWGGRRGTTGG",
    "GGRRGWWGGRRGTTGG",
    "GGGGGGGGGGGGGGGG",
    "GGSSGTTGGTTGSSGG",
    "GGSSGTTGGTTGSSGG",
    "GGGGGGGGGGGGGGGG",
    "GGTTGRRGGWWGRRGG",
    "GGTTGRRGGWWGRRGG",
    "GGGGGGGGGGGGGGGG",
    "GGGGGGFGGSSGTTGG",
    "GGGGFGGGGSSGTTGG",
    "HGGGGGGGGGGGGGGG",
]
PRACTICE_A = [(9, 1), (7, 0), (5, 0)]
PRACTICE_B = [(6, 14), (8, 15), (10, 15)]


def random_map(rng):
    n = 16
    g = [['G'] * n for _ in range(n)]
    Hpos, Xpos = (15, 0), (0, 15)
    protect = set()
    for (r, c) in (Hpos, Xpos):
        for dr in range(-3, 4):
            for dc in range(-3, 4):
                protect.add((r + dr, c + dc))
    starts_a = [(9, 1), (7, 0), (5, 0)]
    for (r, c) in starts_a:
        protect.add((r, c)); protect.add((15 - r, 15 - c))
    for _ in range(rng.randint(10, 22)):
        t = rng.choice('TTTRRWSSF') if _ % 9 else 'F'
        r, c = rng.randrange(n), rng.randrange(n)
        cells = [(r, c), (r + 1, c), (r, c + 1), (r + 1, c + 1)] if t != 'F' else [(r, c)]
        for (a, b) in cells:
            if 0 <= a < n and 0 <= b < n and (a, b) not in protect and (15 - a, 15 - b) not in protect:
                g[a][b] = t
                g[15 - a][15 - b] = t
    # 포탑 레인 일부에 나무 (가끔)
    if rng.random() < 0.3:
        g[0][13] = 'T'; g[15][2] = 'T'
    g[15][0] = 'H'; g[0][15] = 'X'
    return [''.join(row) for row in g], starts_a, [(15 - r, 15 - c) for (r, c) in starts_a]


class Tank:
    def __init__(self, team, idx, pos, brain):
        self.team, self.idx, self.pos, self.brain = team, idx, pos, brain
        self.dir = 'R' if team == 'A' else 'L'
        self.hp = 100
        self.normal = 99
        self.mega = 0
        self.yellow = 0
        self.alive = True
        self.turns = 0
        self.last_plain = None
        self.dead_by_penalty = False


class Game:
    def __init__(self, rows, starts_a, starts_b, brains_a, brains_b, seed=0, list_dead=False):
        self.rng = random.Random(seed)
        self.h = len(rows)
        self.w = len(rows[0])
        self.terrain = [list(r) for r in rows]
        self.turret = {}
        for r in range(self.h):
            for c in range(self.w):
                if self.terrain[r][c] == 'H':
                    self.turret['A'] = [(r, c), 100]
                    self.terrain[r][c] = 'G'
                elif self.terrain[r][c] == 'X':
                    self.turret['B'] = [(r, c), 100]
                    self.terrain[r][c] = 'G'
        self.tanks = []
        for i, p in enumerate(starts_a):
            self.tanks.append(Tank('A', i + 1, p, brains_a[i]))
        for i, p in enumerate(starts_b):
            self.tanks.append(Tank('B', i + 1, p, brains_b[i]))
        self.order = []
        for i in range(3):
            self.order.append(self.tanks[i])
            self.order.append(self.tanks[3 + i])
        self.shift = self.rng.randrange(1, 26) if self.rng.random() < 0.5 else 17  # 암호 = 원문 + shift
        self.log = []
        self.winner = None
        self.reason = None
        self.list_dead = list_dead
        self.errors = 0

    def zone(self, team):
        (tr, tc), _ = self.turret[team]
        return {(tr + dr, tc + dc) for dr in range(-2, 3) for dc in range(-2, 3)}

    def tank_at(self, pos):
        for t in self.tanks:
            if t.alive and t.pos == pos:
                return t
        return None

    def render(self, me):
        rows = []
        for r in range(self.h):
            row = []
            for c in range(self.w):
                row.append(self.terrain[r][c])
            rows.append(row)
        for team, ((r, c), hp) in self.turret.items():
            if hp > 0:
                rows[r][c] = 'H' if team == me.team else 'X'
        for t in self.tanks:
            if not t.alive:
                continue
            r, c = t.pos
            if t is me:
                rows[r][c] = 'M'
            elif t.team == me.team:
                rows[r][c] = f'M{t.idx}'
            else:
                rows[r][c] = f'E{t.idx}'
        allies = [f'M {me.hp} {me.dir} {me.normal} {me.mega}']
        for t in self.tanks:
            if t.team == me.team and t is not me and (t.alive or self.list_dead):
                allies.append(f'M{t.idx} {max(t.hp, 0)}')
        allies.append(f'H {self.turret[me.team][1]}')
        enemies = []
        for t in self.tanks:
            if t.team != me.team and (t.alive or self.list_dead):
                enemies.append(f'E{t.idx} {max(t.hp, 0)}')
        other = 'B' if me.team == 'A' else 'A'
        enemies.append(f'X {self.turret[other][1]}')
        codes = []
        r, c = me.pos
        for dr, dc in DIR_VEC.values():
            nr, nc = r + dr, c + dc
            if 0 <= nr < self.h and 0 <= nc < self.w and self.terrain[nr][nc] == 'F':
                plain = self.rng.choice(WORDS)
                me.last_plain = plain
                codes.append(''.join(chr((ord(ch) - 65 + self.shift) % 26 + 65) for ch in plain))
                break
        header = f'{self.h} {self.w} {len(allies)} {len(enemies)} {len(codes)}'
        lines = [header] + [' '.join(row) for row in rows] + allies + enemies + codes
        return '\n'.join(lines)

    def yellow(self, t, why):
        t.yellow += 1
        self.log.append((t.team, t.idx, t.turns, 'YELLOW', why))
        if t.yellow >= 3:
            t.alive = False
            t.dead_by_penalty = True

    def damage_tank(self, t, dmg):
        t.hp -= dmg
        if t.hp <= 0:
            t.alive = False

    def step(self, t, cmd):
        toks = cmd.split()
        if not toks:
            self.yellow(t, 'empty')
            return
        d = None
        if toks[0] in DIR_VEC:
            d = toks[0]
            toks = toks[1:]
        if d:
            t.dir = d
        if not toks:
            self.yellow(t, 'rotate-only')
            return
        act = toks[0]
        opt = toks[1] if len(toks) > 1 else None
        if act == 'S':
            self.yellow(t, 'stay')
            return
        if act == 'A':
            dr, dc = DIR_VEC[t.dir]
            nr, nc = t.pos[0] + dr, t.pos[1] + dc
            ok = 0 <= nr < self.h and 0 <= nc < self.w
            if ok:
                ter = self.terrain[nr][nc]
                if ter not in ('G', 'S'):
                    ok = False
                if (nr, nc) in self.zone(t.team):
                    ok = False
                for team, (p, hp) in self.turret.items():
                    if p == (nr, nc):
                        ok = False
                if self.tank_at((nr, nc)):
                    ok = False
            if not ok:
                self.yellow(t, f'bad move {cmd} at {t.pos}')
                return
            t.pos = (nr, nc)
            if self.terrain[nr][nc] == 'S':
                self.damage_tank(t, 10)
                if not t.alive:
                    t.dead_by_penalty = True
            return
        if act == 'F':
            mega = opt == 'M'
            if mega and t.mega <= 0:
                self.yellow(t, 'FM without mega')
                return
            if not mega and t.normal <= 0:
                self.yellow(t, 'F without ammo')
                return
            if mega:
                t.mega -= 1
            else:
                t.normal -= 1
            dmg = 70 if mega else 30
            dr, dc = DIR_VEC[t.dir]
            r, c = t.pos
            for _ in range(3):
                r += dr; c += dc
                if not (0 <= r < self.h and 0 <= c < self.w):
                    break
                for team, tur in self.turret.items():
                    if tur[0] == (r, c) and tur[1] > 0:
                        tur[1] -= dmg
                        if team == t.team:
                            self.log.append((t.team, t.idx, t.turns, 'FRIENDLY TURRET', cmd))
                        return
                tk = self.tank_at((r, c))
                if tk:
                    if tk.team == t.team:
                        self.log.append((t.team, t.idx, t.turns, 'FRIENDLY FIRE', cmd))
                    self.damage_tank(tk, dmg)
                    return
                ter = self.terrain[r][c]
                if ter == 'T':
                    self.terrain[r][c] = 'G'
                    return
                if ter in ('R', 'F'):
                    self.yellow(t, f'shot at {ter}')
                    return
            self.yellow(t, f'shot at nothing {cmd} at {t.pos}')
            return
        if act == 'G':
            adj = any(0 <= t.pos[0] + dr < self.h and 0 <= t.pos[1] + dc < self.w and
                      self.terrain[t.pos[0] + dr][t.pos[1] + dc] == 'F' for dr, dc in DIR_VEC.values())
            if t.mega >= 10:
                self.yellow(t, 'G at max mega')
                return
            if adj and opt == t.last_plain:
                t.mega += 1
            else:
                self.log.append((t.team, t.idx, t.turns, 'G FAIL', cmd))
            return
        self.yellow(t, f'unknown {cmd}')

    def check_end(self):
        for team in ('A', 'B'):
            if self.turret[team][1] <= 0:
                self.winner = 'B' if team == 'A' else 'A'
                self.reason = 'turret'
                return True
        for team in ('A', 'B'):
            dead = sum(1 for t in self.tanks if t.team == team and not t.alive)
            if dead >= 2:
                self.winner = 'B' if team == 'A' else 'A'
                self.reason = '2 tanks'
                return True
        return False

    def run(self, max_turns=100):
        rnd = 0
        while True:
            rnd += 1
            any_turn = False
            for t in self.order:
                if not t.alive or t.turns >= max_turns:
                    continue
                any_turn = True
                t.turns += 1
                data = self.render(t)
                t0 = time.time()
                try:
                    cmd = t.brain.decide(data)
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    self.errors += 1
                    self.winner = 'B' if t.team == 'A' else 'A'
                    self.reason = f'runtime error {t.team}{t.idx}: {e}'
                    return
                if time.time() - t0 > 5:
                    self.log.append((t.team, t.idx, t.turns, 'SLOW', time.time() - t0))
                self.step(t, cmd)
                if self.check_end():
                    self.rounds = rnd
                    return
            if not any_turn:
                break
        self.rounds = rnd
        # 100턴 종료 판정
        dmg = {}
        for team in ('A', 'B'):
            d = 100 - max(self.turret[team][1], 0)
            for t in self.tanks:
                if t.team == team:
                    d += 100 - max(t.hp, 0) if t.alive else 100
            dmg[team] = d
        if dmg['A'] != dmg['B']:
            self.winner = 'A' if dmg['A'] < dmg['B'] else 'B'
            self.reason = 'damage'
            return
        dist = {}
        for team in ('A', 'B'):
            other = 'B' if team == 'A' else 'A'
            (tr, tc), _ = self.turret[other]
            dist[team] = sum(abs(t.pos[0] - tr) + abs(t.pos[1] - tc) for t in self.tanks if t.team == team and t.alive)
        if dist['A'] != dist['B']:
            self.winner = 'A' if dist['A'] < dist['B'] else 'B'
            self.reason = 'distance'
            return
        self.winner = 'B'
        self.reason = 'second mover'


# ---------------------------------------------------------------- 상대 봇들
class Rusher(Brain):
    """레인 배정/메가 없이 가장 가까운 사격 위치로 돌진, 사거리 3에서 포탑 사격"""
    def plan(self):
        st = self.st
        rays = {d: self.ray(st.my_pos, d) for d in DIR_ORDER}
        for d in DIR_ORDER:
            if rays[d][0] == 'X':
                return self.shot_cmd(d, st.mega > 0)
        dist, parent = self.dijkstra(st.my_pos, hp=st.hp)
        opts = self.lane_options(dist, st.X)
        if not opts:
            return None
        cost, cellp = min(opts.values())
        if cellp == st.my_pos:
            for d in DIR_ORDER:
                if rays[d][0] in ('T', 'E'):
                    return self.shot_cmd(d, False)
            return None
        step = self.first_step(parent, st.my_pos, cellp)
        return self.step_cmd(step) if step else None


class AdjRusher(Brain):
    """기본코드 스타일: BFS로 포탑 바로 옆까지 가서 사격 (나무는 쏘고 지나감)"""
    def plan(self):
        st = self.st
        rays = {d: self.ray(st.my_pos, d) for d in DIR_ORDER}
        for d in DIR_ORDER:
            if rays[d][0] == 'X' and abs(rays[d][1][0] - st.my_pos[0]) + abs(rays[d][1][1] - st.my_pos[1]) == 1:
                return self.shot_cmd(d, False)
        dist, parent = self.dijkstra(st.my_pos, hp=st.hp)
        best = None
        for d in DIR_ORDER:
            dr, dc = DIR_VEC[d]
            q = (st.X[0] + dr, st.X[1] + dc)
            if q in dist and (best is None or dist[q] < dist[best]):
                best = q
        if best is None:
            return None
        if best == st.my_pos:
            return None
        step = self.first_step(parent, st.my_pos, best)
        return self.step_cmd(step) if step else None


class Hunter(Brain):
    """적 탱크가 사선에 있으면 무조건 사격, 아니면 가장 가까운 적 탱크 사냥, 포탑은 보이면 사격"""
    def plan(self):
        st = self.st
        rays = {d: self.ray(st.my_pos, d) for d in DIR_ORDER}
        for want in ('X', 'E'):
            for d in DIR_ORDER:
                if rays[d][0] == want:
                    return self.shot_cmd(d, False)
        dist, parent = self.dijkstra(st.my_pos, hp=st.hp)
        cellp = self.hunt_cell(dist)
        if cellp is None or cellp == st.my_pos:
            opts = self.lane_options(dist, st.X)
            if not opts:
                return None
            cellp = min(opts.values())[1]
            if cellp == st.my_pos:
                return None
        step = self.first_step(parent, st.my_pos, cellp)
        return self.step_cmd(step) if step else None


class MegaRusher(Rusher):
    """보급시설에서 메가 2개 확보 후 돌진 (해독 규칙을 알고 있다고 가정)"""
    def plan(self):
        st = self.st
        rays = {d: self.ray(st.my_pos, d) for d in DIR_ORDER}
        for d in DIR_ORDER:
            if rays[d][0] == 'X':
                return self.shot_cmd(d, st.mega > 0)
        if st.mega < 2 and st.codes:
            text, s = self.decode(st.codes[0])
            self.pending_g = (s, st.mega)
            return f'G {text}'
        if st.mega < 2:
            dist, parent = self.dijkstra(st.my_pos, hp=st.hp)
            q = self.nearest_supply_adj(dist)
            if q is not None and q != st.my_pos:
                step = self.first_step(parent, st.my_pos, q)
                if step:
                    c = self.step_cmd(step)
                    if c:
                        return c
        return Rusher.plan(self)


OPPONENTS = {
    'mirror': Brain,
    'rusher': Rusher,
    'adjrusher': AdjRusher,
    'hunter': Hunter,
    'megarusher': MegaRusher,
}


def play(our_cls, opp_cls, our_side, rows, sa, sb, seed, list_dead=False):
    ours = [our_cls() for _ in range(3)]
    opps = [opp_cls() for _ in range(3)]
    if our_side == 'A':
        g = Game(rows, sa, sb, ours, opps, seed, list_dead)
    else:
        g = Game(rows, sa, sb, opps, ours, seed, list_dead)
    g.run()
    return g


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    rng = random.Random(1)
    maps = [('practice', PRACTICE, PRACTICE_A, PRACTICE_B)]
    for i in range(n):
        rows, sa, sb = random_map(rng)
        maps.append((f'rand{i}', rows, sa, sb))
    total_yellow_ours = 0
    for oname, ocls in OPPONENTS.items():
        res = {'win': 0, 'lose': 0}
        reasons = {}
        for mi, (mname, rows, sa, sb) in enumerate(maps):
            for side in ('A', 'B'):
                g = play(Brain, ocls, side, rows, sa, sb, seed=mi * 7 + (side == 'B'))
                won = g.winner == side
                res['win' if won else 'lose'] += 1
                key = ('W ' if won else 'L ') + g.reason
                reasons[key] = reasons.get(key, 0) + 1
                for entry in g.log:
                    if entry[0] == side and entry[3] in ('YELLOW', 'FRIENDLY FIRE', 'FRIENDLY TURRET'):
                        total_yellow_ours += 1
                        if total_yellow_ours <= 15:
                            print('  [ours]', mname, side, entry)
                if mname == 'practice':
                    print(f'  practice vs {oname} as {side}: winner={g.winner} reason={g.reason} rounds={getattr(g, "rounds", "?")}')
        print(f'vs {oname:10s}: {res}  {reasons}')
    print('our yellow/friendly-fire events:', total_yellow_ours)


if __name__ == '__main__':
    main()
