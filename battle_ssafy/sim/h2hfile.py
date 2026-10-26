import sys, random, heapq, importlib.util
import sim
def load(path):
    src = open(path, encoding='utf-8').read()
    s = src.index('DIR_VEC = '); e = src.index('brain = Brain()')
    ns = {'heapq': heapq, '__name__': 'bot'}
    exec(src[s:e], ns); return ns['Brain']
P = load(sys.argv[1]); Q = load(sys.argv[2]); n = int(sys.argv[3])
rng = random.Random(5)
maps = [('practice', sim.PRACTICE, sim.PRACTICE_A, sim.PRACTICE_B)]
for i in range(n):
    rows, sa, sb = sim.random_map(rng); maps.append((f'r{i}', rows, sa, sb))
w = 0
for mi, (mname, rows, sa, sb) in enumerate(maps):
    for side in ('A', 'B'):
        g = sim.play(P, Q, side, rows, sa, sb, seed=mi * 11 + (side == 'B'))
        w += g.winner == side
print(f'{sys.argv[1]} vs {sys.argv[2]}: {w}/{2*len(maps)}')
