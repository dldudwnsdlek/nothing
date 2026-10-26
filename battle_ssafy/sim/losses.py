import random, sim
rng = random.Random(1)
maps = [('practice', sim.PRACTICE, sim.PRACTICE_A, sim.PRACTICE_B)]
for i in range(10):
    rows, sa, sb = sim.random_map(rng)
    maps.append((f'r{i}', rows, sa, sb))
for oname in ('hunter', 'rusher', 'mirror'):
    ocls = sim.OPPONENTS[oname]
    if oname == 'mirror':
        class O(sim.Brain): ENGAGE = 0
        ocls = O
    for mi, (mname, rows, sa, sb) in enumerate(maps):
        for side in ('A', 'B'):
            g = sim.play(sim.Brain, ocls, side, rows, sa, sb, seed=mi * 7 + (side == 'B'))
            if g.winner != side:
                ours = [(t.idx, t.hp, t.pos, t.mega) for t in g.tanks if t.team == side]
                print(oname, mname, side, g.reason, 'rounds', g.rounds, 'turrets', {k: v[1] for k, v in g.turret.items()}, 'ours', ours)
