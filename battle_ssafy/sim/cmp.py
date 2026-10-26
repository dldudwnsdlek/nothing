import sys, random
import sim
modes = [int(x) for x in sys.argv[1].split(',')]
n = int(sys.argv[2]) if len(sys.argv) > 2 else 10
rng = random.Random(1)
maps = [('practice', sim.PRACTICE, sim.PRACTICE_A, sim.PRACTICE_B)]
for i in range(n):
    rows, sa, sb = sim.random_map(rng)
    maps.append((f'r{i}', rows, sa, sb))
for m in modes:
    class Ours(sim.Brain):
        ENGAGE = m
    out = []
    tot = 0
    for oname, ocls in sim.OPPONENTS.items():
        if oname == 'mirror':
            class Opp(sim.Brain):
                ENGAGE = 0
            ocls = Opp
        w = 0
        for mi, (mname, rows, sa, sb) in enumerate(maps):
            for side in ('A', 'B'):
                g = sim.play(Ours, ocls, side, rows, sa, sb, seed=mi * 7 + (side == 'B'))
                w += g.winner == side
        tot += w
        out.append(f'{oname}:{w}/{2*len(maps)}')
    print('ENGAGE', m, ' '.join(out), 'total', tot)
