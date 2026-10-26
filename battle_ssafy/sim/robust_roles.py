import random, sim
def mk(role):
    class R(sim.Brain): ROLE = role
    return R
roles = [mk('GUARD'), mk('MEGA'), mk('STRIKER')]
rng = random.Random(9); bad = 0; errs = 0; games = 0; wins = 0
for i in range(12):
    rows, sa, sb = sim.random_map(rng)
    for opp in (sim.Hunter, sim.Rusher, sim.Brain):
        for side in ('A', 'B'):
            for order_variant in (0, 1):
                ours = [c() for c in roles]
                if order_variant: ours = ours[::-1]   # 실행 순서가 뒤바뀐 경우
                op = [opp() for _ in range(3)]
                ba, bb = (ours, op) if side == 'A' else (op, ours)
                g = sim.Game(rows, sa, sb, ba, bb, seed=i, list_dead=bool(i % 2))
                if i % 3 == 0: g.order = g.tanks[:3] + g.tanks[3:]
                g.run(); games += 1; errs += g.errors; wins += g.winner == side
                for e in g.log:
                    if e[0] == side and e[3] in ('YELLOW', 'FRIENDLY FIRE', 'FRIENDLY TURRET', 'SLOW'):
                        bad += 1; print(e)
print('games', games, 'wins', wins, 'errors', errs, 'yellow/ff', bad)
