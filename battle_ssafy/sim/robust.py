import random, sim
rng = random.Random(9)
yel = 0; errs = 0; games = 0
for i in range(12):
    rows, sa, sb = sim.random_map(rng)
    for opp in (sim.Hunter, sim.Rusher, sim.Brain):
        for side in ('A', 'B'):
            ours = [sim.Brain() for _ in range(3)]; opps = [opp() for _ in range(3)]
            ba, bb = (ours, opps) if side == 'A' else (opps, ours)
            g = sim.Game(rows, sa, sb, ba, bb, seed=i, list_dead=True)
            # 대체 턴 순서: A1 A2 A3 B1 B2 B3
            g.order = g.tanks[:3] + g.tanks[3:]
            g.run(); games += 1
            errs += g.errors
            for e in g.log:
                if e[0] == side and e[3] in ('YELLOW', 'FRIENDLY FIRE', 'FRIENDLY TURRET', 'SLOW'):
                    yel += 1; print(e)
print('games', games, 'errors', errs, 'our yellow/ff', yel)
