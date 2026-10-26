"""main.py(공통 엔진)로부터 탱크별 실행 파일 3개를 생성한다.  사용: python3 make_players.py"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = open(os.path.join(HERE, 'main.py'), encoding='utf-8').read()

PLAYERS = [
    ('Player1', 'GUARD', '수비대장 (우리 포탑에 가장 가까운 1번 탱크)', [
        '레인 배정에는 참여하되, 처치 시간이 같으면 공격 레인을 동료에게 양보한다.',
        '레인이 다 차면 보급시설에서 메가 2발을 확보한 뒤, 우리 포탑을 쏠 수 있는 적 탱크를 최우선으로 사냥한다.',
        '사선에 들어온 적 탱크와는 항상 먼저 쏜다 (적 2대 파괴 = 승리, 동시에 우리 포탑 보호).',
        '동료 공격수가 쓰러지거나 레인이 비면 즉시 포탑 공격수로 전환한다.',
    ]),
    ('Player2', 'MEGA', '메가 포격수 (중앙 2번 탱크)', [
        '보급시설을 경유해도 포탑 처치가 늦어지지 않으면 카이사르 암호를 풀어 메가탄을 확보한다. 동률이면 메가를 택한다.',
        '레인에 서면 메가 70 + 동료 일반탄 30으로 포탑(체력 100)을 한 라운드 안에 끝낸다.',
        '레인이 다 찼을 때는 메가를 최대 3발까지 비축해 적 탱크를 두 방(70+30)에 잡는다.',
    ]),
    ('Player3', 'STRIKER', '선봉 돌격수 (적 포탑에 가장 가까운 3번 탱크)', [
        '최단 경로로 적 포탑 사격 레인(직선 3칸)에 가장 먼저 도착해 첫 포격을 시작한다.',
        '메가 우회는 처치가 확실히 빨라질 때만 한다 (속도 최우선).',
        '경로를 막는 나무는 쏴서 뚫고, 레인을 가리는 적 탱크도 사격한다.',
    ]),
]

COMMON = [
    '공통: 포탑을 쏠 수 있으면 무조건 사격, 한 방 처치 가능한 적은 즉시 처치,',
    '      레이스에서 지면 우리 포탑을 노리는 적 집중 사격, 옐로카드 행동 원천 차단.',
    '역할은 실행 순서(Player1 > Player2 > Player3)를 기준으로 서로를 추정합니다.',
    '순서가 바뀌어도 동작하며, 실제 레인 배정은 매 턴 맵을 보고 다시 계산합니다.',
]

for name, role, title, lines in PLAYERS:
    head = ['#' * 70, f'# [{name}] 역할: {role} - {title}', '#']
    head += [f'#  - {l}' for l in lines]
    head += ['#'] + [f'#  {l}' for l in COMMON]
    head += ['#', f"#  제출 파일명 예: {name}_서울19_김싸피.py  /  NICKNAME만 본인 것으로 수정", '#' * 70, '']
    body = SRC.replace("NICKNAME = '지역반_이름'", f"NICKNAME = '지역반_이름'  # ← 본인 닉네임으로 수정 (12자 이내)\nMY_ROLE = '{role}'  # 이 탱크의 작전 역할 (수정하지 마세요)")
    body = body.replace('brain = Brain()\n', 'brain = Brain()\nbrain.ROLE = MY_ROLE\n')
    assert 'brain.ROLE = MY_ROLE' in body and "MY_ROLE = '" in body
    out = os.path.join(HERE, 'team', f'{name}_지역반_이름.py')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write('\n'.join(head) + body)
    print('wrote', out)
