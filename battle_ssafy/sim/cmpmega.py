import random, sim
rng = random.Random(1)
maps = [('practice', sim.PRACTICE, sim.PRACTICE_A, sim.PRACTICE_B)]
for i in range(10):
    rows, sa, sb = sim.random_map(rng); maps.append((f'r{i}', rows, sa, sb))
class NoMega(sim.Brain): MEGA_DETOUR = False
out = []; tot = 0
for oname, ocls in sim.OPPONENTS.items():
    w = 0
    for mi, (mname, rows, sa, sb) in enumerate(maps):
        for side in ('A', 'B'):
            g = sim.play(NoMega, ocls, side, rows, sa, sb, seed=mi * 7 + (side == 'B'))
            w += g.winner == side
    tot += w; out.append(f'{oname}:{w}')
print('NoMega', ' '.join(out), 'total', tot)
