import sys, random, heapq
import sim
def load(path):
    src = open(path, encoding='utf-8').read()
    s = src.index('DIR_VEC = '); e = src.index('brain = Brain()')
    ns = {'heapq': heapq, '__name__': 'bot'}
    exec(src[s:e], ns); return ns['Brain']
Auto = load(sys.argv[1])
roles = sys.argv[2].split(',')   # e.g. STRIKER,MEGA,GUARD
n = int(sys.argv[3])
extra = dict(kv.split('=') for kv in sys.argv[4:])
def mk(role):
    class R(sim.Brain):
        ROLE = role
    for k, v in extra.items():
        setattr(R, k, int(v))
    return R
ours_cls = [mk(r) for r in roles]
rng = random.Random(1)
maps = [('practice', sim.PRACTICE, sim.PRACTICE_A, sim.PRACTICE_B)]
for i in range(n):
    rows, sa, sb = sim.random_map(rng); maps.append((f'r{i}', rows, sa, sb))
opps = dict(sim.OPPONENTS); opps['auto'] = Auto
out = []; tot = 0
for oname, ocls in opps.items():
    if oname == 'mirror': continue
    w = 0
    for mi, (mname, rows, sa, sb) in enumerate(maps):
        for side in ('A', 'B'):
            ours = [c() for c in ours_cls]; op = [ocls() for _ in range(3)]
            ba, bb = (ours, op) if side == 'A' else (op, ours)
            g = sim.Game(rows, sa, sb, ba, bb, seed=mi * 7 + (side == 'B'))
            g.run(); w += g.winner == side
            for e in g.log:
                if e[0] == side and e[3] in ('YELLOW', 'FRIENDLY FIRE', 'FRIENDLY TURRET'): print('BAD', e)
            if g.errors: print('ERR')
    tot += w; out.append(f'{oname}:{w}/{2*len(maps)}')
print(roles, extra, ' '.join(out), 'total', tot)
