import sys, random
import sim
a, b, n = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3])
rng = random.Random(5)
maps = [('practice', sim.PRACTICE, sim.PRACTICE_A, sim.PRACTICE_B)]
for i in range(n):
    rows, sa, sb = sim.random_map(rng)
    maps.append((f'r{i}', rows, sa, sb))
class P(sim.Brain): ENGAGE = a
class Q(sim.Brain): ENGAGE = b
w = 0
for mi, (mname, rows, sa, sb) in enumerate(maps):
    for side in ('A', 'B'):
        g = sim.play(P, Q, side, rows, sa, sb, seed=mi * 11 + (side == 'B'))
        w += g.winner == side
print(f'ENGAGE {a} vs {b}: {w}/{2*len(maps)}')
