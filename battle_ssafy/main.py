import socket
import heapq

##############################
# 메인 프로그램 통신 변수 정의
##############################
HOST = '127.0.0.1'
PORT = 8747
ARR_DELAY = 100

sock = socket.socket()

##############################
# 메인 프로그램 통신 함수 정의
##############################

# 메인 프로그램 연결 및 초기화
def init(nickname):
    try:
        print(f'[STATUS] Trying to connect to {HOST}:{PORT}...')
        sock.connect((HOST, PORT))
        print('[STATUS] Connected')
        init_command = f'INIT {nickname}'

        return submit(init_command)

    except Exception as e:
        print('[ERROR] Failed to connect. Please check if the main program is waiting for connection.')
        print(e)

# 메인 프로그램으로 데이터(명령어) 전송
def submit(string_to_send):
    try:
        send_data = (string_to_send + ' ').encode('utf-8')
        sock.send(send_data)

        return receive()

    except Exception as e:
        print('[ERROR] Failed to send data. Please check if connection to the main program is valid.')

    return None

# 메인 프로그램으로부터 데이터 수신
# (기본 코드는 recv(1024) 한 번만 호출하지만, 16x16 맵은 데이터가 길어 잘릴 수 있으므로
#  헤더에 적힌 행 수만큼 다 받을 때까지 이어서 수신하도록 보강)
def receive():
    try:
        game_data = (sock.recv(4096)).decode()
        if not game_data or not game_data[0].isdigit() or int(game_data[0]) <= 0:
            print('[STATUS] No receive data from the main program.')
            close()
            return None

        game_data = _receive_rest(game_data)
        return game_data

    except Exception as e:
        print('[ERROR] Failed to receive data. Please check if connection to the main program is valid.')

def _expected_rows(text):
    try:
        header = text.split('\n')[0].split()
        if len(header) < 5:
            return None
        h, _, a, e, c = [int(x) for x in header[:5]]
        return 1 + h + a + e + c
    except Exception:
        return None

def _receive_rest(game_data):
    old_timeout = sock.gettimeout()
    try:
        for _ in range(50):
            need = _expected_rows(game_data)
            rows = [r for r in game_data.replace('\r', '').split('\n') if r.strip() != '']
            if need is not None and len(rows) >= need:
                # 마지막 행이 잘렸을 가능성에 대비해 아주 짧게 한 번 더 확인
                sock.settimeout(0.01)
                try:
                    more = sock.recv(4096)
                    if more:
                        game_data += more.decode()
                        continue
                except socket.timeout:
                    pass
                break
            sock.settimeout(1.0)
            try:
                more = sock.recv(4096)
            except socket.timeout:
                break
            if not more:
                break
            game_data += more.decode()
    except Exception:
        pass
    finally:
        try:
            sock.settimeout(old_timeout)
        except Exception:
            pass
    return game_data

# 연결 해제
def close():
    try:
        if sock is not None:
            sock.close()
        print('[STATUS] Connection closed')

    except Exception as e:
        print('[ERROR] Network connection has been corrupted.')

##############################
# 입력 데이터 변수 정의
##############################
map_data = [[]]  # 맵 정보. 예) map_data[0][1] - [0, 1]의 지형/지물
my_allies = {}  # 아군 정보. 예) my_allies['M'] - 플레이어 본인의 정보
enemies = {}  # 적군 정보. 예) enemies['X'] - 적 포탑의 정보
codes = []  # 주어진 암호문. 예) codes[0] - 첫 번째 암호문

##############################
# 입력 데이터 파싱
##############################

# 입력 데이터를 파싱하여 각각의 리스트/딕셔너리에 저장
def parse_data(game_data):
    # 입력 데이터를 행으로 나누기
    game_data_rows = game_data.replace('\r', '').split('\n')
    row_index = 0

    # 첫 번째 행 데이터 읽기
    header = game_data_rows[row_index].split(' ')
    map_height = int(header[0]) if len(header) >= 1 else 0 # 맵의 세로 크기
    map_width = int(header[1]) if len(header) >= 2 else 0  # 맵의 가로 크기
    num_of_allies = int(header[2]) if len(header) >= 3 else 0  # 아군의 수
    num_of_enemies = int(header[3]) if len(header) >= 4 else 0  # 적군의 수
    num_of_codes = int(header[4]) if len(header) >= 5 else 0  # 암호문의 수
    row_index += 1

    # 기존의 맵 정보를 초기화하고 다시 읽어오기
    map_data.clear()
    map_data.extend([[ '' for c in range(map_width)] for r in range(map_height)])
    for i in range(0, map_height):
        col = game_data_rows[row_index + i].split(' ')
        for j in range(0, min(len(col), map_width)):
            map_data[i][j] = col[j]
    row_index += map_height

    # 기존의 아군 정보를 초기화하고 다시 읽어오기
    my_allies.clear()
    for i in range(row_index, row_index + num_of_allies):
        ally = game_data_rows[i].split(' ')
        ally_name = ally.pop(0) if len(ally) >= 1 else '-'
        my_allies[ally_name] = ally
    row_index += num_of_allies

    # 기존의 적군 정보를 초기화하고 다시 읽어오기
    enemies.clear()
    for i in range(row_index, row_index + num_of_enemies):
        enemy = game_data_rows[i].split(' ')
        enemy_name = enemy.pop(0) if len(enemy) >= 1 else '-'
        enemies[enemy_name] = enemy
    row_index += num_of_enemies

    # 기존의 암호문 정보를 초기화하고 다시 읽어오기
    codes.clear()
    for i in range(row_index, row_index + num_of_codes):
        codes.append(game_data_rows[i])

# 파싱한 데이터를 화면에 출력
def print_data():
    print(f'\n----------입력 데이터----------\n{game_data}\n----------------------------')


##############################
# 닉네임 설정 및 최초 연결
##############################
NICKNAME = '지역반_이름'
game_data = init(NICKNAME)

###################################
# 알고리즘 함수/메서드 부분 구현 시작
###################################

# ============================================================================
#  [팀 대항전 전략 요약]
#   1) 승리 1순위 = 적 포탑(X) 파괴. 포탑 체력 100 = 일반탄 4발 / 메가 1 + 일반 1.
#   2) 포탑 사격 레인(포탑 기준 상하좌우 직선 3칸)에 아군을 1대씩 배치 → 매 턴 포탑 사격.
#      (같은 레인의 뒤쪽 탱크는 앞 탱크에 막혀 쏠 수 없으므로 레인당 1대만 배정)
#   3) 보급시설이 경로 근처면 암호 해독으로 메가탄 확보 → 포탑 파괴를 1라운드 단축.
#   4) 한 방에 죽일 수 있는 적 탱크는 즉시 처치 (적 탱크 2대 파괴 = 승리).
#   5) 우리 포탑이 먼저 위험하면(레이스에서 지는 중) 포탑을 노리는 적 탱크를 집중 사격.
#   6) 옐로카드 0개: 제자리(S/회전만), 이동불가 칸 이동, 허공/바위/보급시설 사격,
#      메가 없는데 FM, 메가 10개에서 G → 전부 사전에 차단. 어떤 경우에도 예외로 죽지 않음.
# ============================================================================

DIR_VEC = {'U': (-1, 0), 'D': (1, 0), 'L': (0, -1), 'R': (0, 1)}
DIR_ORDER = ['U', 'R', 'D', 'L']

NORMAL_DMG = 30
MEGA_DMG = 70
SHOT_RANGE = 3
MAX_MEGA = 10

SAND_EXTRA = 0.4        # 모래: 시간은 1턴이지만 체력 -10 → 약간의 추가 비용
TREE_COST = 2           # 나무: 사격 1턴 + 이동 1턴
ENEMY_ZONE_EXTRA = 0.3  # 적 포탑 3x3(5x5) 구역: 진입 가능하지만 가능하면 바깥 선호
ALLY_FAR_EXTRA = 1.5    # 멀리 있는 아군 탱크 칸: 곧 비켜줄 가능성
INF = float('inf')

# 카이사르 암호 해독용 사전 (해독문 후보 채점)
CIPHER_WORDS = [
    'BATTLE', 'SSAFY', 'SAMSUNG', 'SOFTWARE', 'ACADEMY', 'YOUTH', 'TANK', 'MISSILE',
    'ATTACK', 'DEFENSE', 'DEFENCE', 'ALGORITHM', 'CODE', 'CODING', 'PYTHON', 'JAVA',
    'HELLO', 'WORLD', 'GAME', 'WIN', 'VICTORY', 'FIRE', 'BOMB', 'MEGA', 'POWER',
    'SUPPLY', 'TURRET', 'ENEMY', 'ALLY', 'TEAM', 'SCHOOL', 'STUDY', 'DREAM', 'HAPPY',
    'GOOD', 'LUCK', 'BEST', 'KOREA', 'SEOUL', 'DAEJEON', 'GWANGJU', 'GUMI', 'BUSAN',
    'THE', 'AND', 'YOU', 'ARE', 'FOR', 'WITH', 'THIS', 'THAT', 'HAVE', 'LOVE', 'LIFE',
    'TIME', 'FUTURE', 'TOGETHER', 'PEOPLE', 'ENABLING', 'CHALLENGE', 'SUCCESS', 'MISSION',
    'SECRET', 'PASSWORD', 'KEY', 'OPEN', 'START', 'GOAL', 'FIGHT', 'SHOOT', 'SHOT',
    'STRONG', 'SMART', 'BRAVE', 'HERO', 'ARMY', 'SOLDIER', 'COMMANDER', 'GENERAL',
]
EN_FREQ = {
    'A': 8.2, 'B': 1.5, 'C': 2.8, 'D': 4.3, 'E': 12.7, 'F': 2.2, 'G': 2.0, 'H': 6.1,
    'I': 7.0, 'J': 0.15, 'K': 0.77, 'L': 4.0, 'M': 2.4, 'N': 6.7, 'O': 7.5, 'P': 1.9,
    'Q': 0.1, 'R': 6.0, 'S': 6.3, 'T': 9.1, 'U': 2.8, 'V': 1.0, 'W': 2.4, 'X': 0.15,
    'Y': 2.0, 'Z': 0.07,
}
DEFAULT_SHIFT = 9  # 매뉴얼 예시: SRKKCVJJRWP -> BATTLESSAFY (복호 = +9)


def caesar(text, shift):
    out = []
    for ch in text:
        if 'A' <= ch <= 'Z':
            out.append(chr((ord(ch) - 65 + shift) % 26 + 65))
        elif 'a' <= ch <= 'z':
            out.append(chr((ord(ch) - 97 + shift) % 26 + 65))
        else:
            out.append(ch)
    return ''.join(out)


def score_plain(text):
    score = 0.0
    for w in CIPHER_WORDS:
        if w in text:
            score += len(w) * len(w)
    import math
    letters = [c for c in text if 'A' <= c <= 'Z']
    if letters:
        score += sum(math.log(EN_FREQ.get(c, 0.05)) for c in letters) / len(letters) * 3.0
    return score


def is_tank_token(tok):
    return len(tok) >= 1 and tok[0] in ('M', 'E') and (len(tok) == 1 or tok[1:].isdigit())


class State:
    pass


def parse_state(raw):
    st = State()
    rows = raw.replace('\r', '').split('\n')
    header = rows[0].split()
    vals = []
    for x in header[:5]:
        try:
            vals.append(int(x))
        except Exception:
            vals.append(0)
    while len(vals) < 5:
        vals.append(0)
    h, w, na, ne, nc = vals
    st.h, st.w = h, w
    grid = []
    for i in range(h):
        toks = rows[1 + i].split() if 1 + i < len(rows) else []
        if len(toks) == 1 and len(toks[0]) == w and w > 1:
            toks = list(toks[0])
        toks = (toks + ['R'] * w)[:w]
        grid.append(toks)
    st.grid = grid
    idx = 1 + h
    st.allies = {}
    for i in range(na):
        toks = rows[idx + i].split() if idx + i < len(rows) else []
        if toks:
            st.allies[toks[0]] = toks[1:]
    idx += na
    st.enemies = {}
    for i in range(ne):
        toks = rows[idx + i].split() if idx + i < len(rows) else []
        if toks:
            st.enemies[toks[0]] = toks[1:]
    idx += ne
    st.codes = []
    for i in range(nc):
        if idx + i < len(rows) and rows[idx + i].strip():
            st.codes.append(rows[idx + i].strip())

    # 내 정보
    me = st.allies.get('M', [])
    st.hp = _int(me, 0, 100)
    st.dir = me[1] if len(me) > 1 and me[1] in DIR_VEC else 'U'
    st.normal = _int(me, 2, 0)
    st.mega = _int(me, 3, 0)

    st.my_pos = None
    st.ally_pos = {}
    st.enemy_pos = {}
    st.H = None
    st.X = None
    st.supplies = []
    for r in range(h):
        for c in range(w):
            t = grid[r][c]
            if t == 'M':
                st.my_pos = (r, c)
            elif t.startswith('M') and t[1:].isdigit():
                st.ally_pos[t] = (r, c)
            elif t.startswith('E') and t[1:].isdigit():
                st.enemy_pos[t] = (r, c)
            elif t == 'H':
                st.H = (r, c)
            elif t == 'X':
                st.X = (r, c)
            elif t == 'F':
                st.supplies.append((r, c))
    st.H_hp = _int(st.allies.get('H', []), 0, 100)
    st.X_hp = _int(st.enemies.get('X', []), 0, 100)
    st.ally_hp = {k: _int(v, 0, 100) for k, v in st.allies.items() if k.startswith('M') and k != 'M'}
    st.enemy_hp = {k: _int(v, 0, 100) for k, v in st.enemies.items() if k.startswith('E')}
    return st


def _int(lst, i, default):
    try:
        return int(lst[i])
    except Exception:
        return default


class Brain:
    def __init__(self):
        self.turn = 0
        self.my_id = None
        self.shift = None
        self.bad_shifts = set()
        self.pending_g = None      # (shift, mega_before)
        self.cipher_log = []
        self.last_move = None      # (from_pos, to_pos)
        self.learned_block = set() # 이동이 거부된 칸 (예상치 못한 규칙 대비)
        self.enemy_dead = set()
        self.g_fail = 0
        self.prev_hp = None
        self.was_shot = False
        self.last_moved = False
        self.terrain_mem = {}
        self.initial_enemies = None

    # ------------------------------------------------------------------ utils
    def inb(self, r, c):
        return 0 <= r < self.st.h and 0 <= c < self.st.w

    def cell(self, r, c):
        return self.st.grid[r][c]

    def zone(self, center, rad):
        z = set()
        if center is None:
            return z
        for dr in range(-rad, rad + 1):
            for dc in range(-rad, rad + 1):
                r, c = center[0] + dr, center[1] + dc
                if self.inb(r, c):
                    z.add((r, c))
        return z

    def terrain_passable(self, r, c):
        t = self.cell(r, c)
        return t in ('G', 'S') or t == ''

    def shell_transparent(self, r, c):
        t = self.cell(r, c)
        return t in ('G', 'S', 'W', '')

    # 아군 포탑 주변 진입 금지 구역 (모서리 포탑 기준 3x3 = 체비셰프 2)
    def own_zone(self):
        return self.own_zone_cache

    # ------------------------------------------------------- path finding
    def dijkstra(self, start, hp=100, side='me', first_block_ally=True):
        """side='me': 우리 탱크 기준 / side='enemy': 적 탱크 기준(적 구역 금지, 우리 구역 진입 가능)"""
        dist = {start: 0.0}
        parent = {start: None}
        pq = [(0.0, start)]
        if side == 'me':
            forbid = self.own_zone_cache
            penal = self.enemy_zone_cache
            friend, foe = 'M', 'E'
        else:
            forbid = self.enemy_zone_cache
            penal = frozenset()
            friend, foe = 'E', 'M'
        learned = self.learned_block if side == 'me' else frozenset()
        while pq:
            d, cur = heapq.heappop(pq)
            if d > dist.get(cur, INF):
                continue
            for dname in DIR_ORDER:
                dr, dc = DIR_VEC[dname]
                nr, nc = cur[0] + dr, cur[1] + dc
                if not self.inb(nr, nc):
                    continue
                nxt = (nr, nc)
                if nxt in forbid or nxt in learned:
                    continue
                t = self.cell(nr, nc)
                if t == 'G' or t == '':
                    cost = 1.0
                elif t == 'S':
                    if hp <= 10:
                        continue
                    cost = 1.0 + SAND_EXTRA
                elif t == 'T':
                    cost = TREE_COST
                elif is_tank_token(t):
                    if t[0] == friend:
                        # 아군: 바로 옆(첫 걸음)이면 막힘, 멀면 곧 비킬 것으로 보고 추가 비용
                        if first_block_ally and cur == start:
                            continue
                        cost = 1.0 + ALLY_FAR_EXTRA
                    else:
                        continue
                else:
                    continue
                if nxt in penal:
                    cost += ENEMY_ZONE_EXTRA
                nd = d + cost
                if nd < dist.get(nxt, INF) - 1e-9:
                    dist[nxt] = nd
                    parent[nxt] = cur
                    heapq.heappush(pq, (nd, nxt))
        return dist, parent

    def first_step(self, parent, start, goal):
        cur = goal
        if cur not in parent:
            return None
        prev = parent[cur]
        while prev is not None and prev != start:
            cur = prev
            prev = parent[cur]
        if prev is None and cur != start:
            return None
        return cur

    # ------------------------------------------------------- firing helpers
    # 방향 d로 쐈을 때 처음 맞는 대상 (사거리 3) → (종류, 좌표) / 종류: X,H,E,M,T,BLOCK,NONE
    def ray(self, pos, dname):
        dr, dc = DIR_VEC[dname]
        r, c = pos
        for _ in range(SHOT_RANGE):
            r += dr
            c += dc
            if not self.inb(r, c):
                return ('NONE', None)
            t = self.cell(r, c)
            if t in ('G', 'S', 'W', ''):
                continue
            if t == 'X':
                return ('X', (r, c))
            if t == 'H':
                return ('H', (r, c))
            if t == 'T':
                return ('T', (r, c))
            if t.startswith('E') and t[1:].isdigit():
                return ('E', (r, c), t)
            if t.startswith('M'):
                return ('M', (r, c))
            return ('BLOCK', (r, c))
        return ('NONE', None)

    # target을 맞출 수 있는 사격 위치 목록: (cell, lane_dir, trees_between, k)
    def firing_cells(self, target):
        res = []
        if target is None:
            return res
        for lane in DIR_ORDER:
            dr, dc = DIR_VEC[lane]
            trees = 0
            for k in range(1, SHOT_RANGE + 1):
                r, c = target[0] + dr * k, target[1] + dc * k
                if not self.inb(r, c):
                    break
                t = self.cell(r, c)
                res.append(((r, c), lane, trees, k))
                if t in ('G', 'S', 'W', ''):
                    continue
                if t == 'T':
                    trees += 1
                    continue
                break  # 바위/보급시설/탱크/포탑 → 그 뒤 칸에서는 target이 가려짐
        return res

    def lane_options(self, dist, target):
        """레인별로 (해당 레인에서 첫 사격까지 걸리는 턴, 위치) 최소값"""
        best = {}
        for cellp, lane, trees, k in self.firing_cells(target):
            if cellp not in dist:
                continue
            t = self.cell(*cellp)
            if not (t in ('G', 'S', 'T', '', 'M') or (t.startswith('M') and t[1:].isdigit())):
                continue
            cost = dist[cellp] + trees
            # 동률이면 먼 칸(k=3) 선호: 적 구역 밖 + 적 사선 회피
            key = (cost, -k)
            if lane not in best or key < best[lane][0]:
                best[lane] = (key, cellp, cost)
        return {ln: (v[2], v[1]) for ln, v in best.items()}

    # ------------------------------------------------------- cipher
    def decode(self, text):
        text = ''.join(ch for ch in text.upper() if 'A' <= ch <= 'Z')
        if self.shift is not None:
            return caesar(text, self.shift), self.shift
        cands = []
        for s in range(26):
            if s in self.bad_shifts:
                continue
            sc = sum(score_plain(caesar(t, s)) for t in (self.cipher_log[-6:] + [text]))
            if s == DEFAULT_SHIFT:
                sc += 25.0
            cands.append((sc, s))
        if not cands:
            self.bad_shifts.clear()
            return caesar(text, DEFAULT_SHIFT), DEFAULT_SHIFT
        cands.sort(reverse=True)
        s = cands[0][1]
        return caesar(text, s), s

    # ------------------------------------------------------- main decision
    def decide(self, raw):
        self.turn += 1
        st = parse_state(raw)
        self.st = st
        if st.my_pos is None and self.my_id in st.ally_pos:
            # 혹시 내 탱크가 'M' 대신 번호로 표시되는 경우 대비
            st.my_pos = st.ally_pos.pop(self.my_id)
        if st.my_pos is None:
            return 'S'

        # 내 번호 추정 (첫 턴에 보이지 않는 번호)
        if self.my_id is None:
            nums = set(['M1', 'M2', 'M3'])
            for k in st.allies.keys():
                nums.discard(k)
            self.my_id = sorted(nums)[0] if nums else 'M1'
        if self.initial_enemies is None:
            self.initial_enemies = set(st.enemy_pos.keys()) | set(k for k in st.enemy_hp)

        # 지난 턴 결과 학습: 암호 성공 여부 / 이동 거부 여부
        if self.pending_g is not None:
            s, before = self.pending_g
            if st.mega > before:
                self.shift = s
            else:
                self.bad_shifts.add(s)
                self.g_fail += 1
            self.pending_g = None
        if self.last_move is not None:
            frm, to = self.last_move
            if st.my_pos == frm and to is not None:
                self.learned_block.add(to)
            self.last_move = None
        for r in range(st.h):
            for c in range(st.w):
                t = st.grid[r][c]
                if t in ('G', 'S', 'W', 'T', 'R', 'F'):
                    self.terrain_mem[(r, c)] = t
        if self.prev_hp is not None and st.hp < self.prev_hp:
            # 모래로 잃은 10은 제외하고 피격 여부 판단
            on_sand = self.terrain_mem.get(st.my_pos) == 'S'
            if not (on_sand and self.prev_hp - st.hp == 10 and self.last_moved):
                self.was_shot = True
        self.prev_hp = st.hp
        self.last_moved = False
        for code in st.codes:
            clean = ''.join(ch for ch in code.upper() if 'A' <= ch <= 'Z')
            if clean and (not self.cipher_log or self.cipher_log[-1] != clean):
                self.cipher_log.append(clean)

        self.own_zone_cache = self.zone(st.H, 2)
        self.enemy_zone_cache = self.zone(st.X, 2)
        # 내가 이미 '내 구역'으로 판단한 칸 안에 있다면 (해석 오류) 작은 구역으로 완화
        if st.my_pos in self.own_zone_cache:
            self.own_zone_cache = self.zone(st.H, 1)

        cmd = None
        try:
            cmd = self.plan()
        except Exception as e:
            print('[WARN] plan error', e)
            cmd = None
        if not cmd:
            cmd = self.fallback()
        # 이동 기록
        toks = cmd.split()
        if len(toks) >= 2 and toks[1] == 'A' and toks[0] in DIR_VEC:
            dr, dc = DIR_VEC[toks[0]]
            self.last_move = (st.my_pos, (st.my_pos[0] + dr, st.my_pos[1] + dc))
            self.last_moved = True
        return cmd

    def shot_cmd(self, dname, mega):
        return f'{dname} F M' if mega else f'{dname} F'

    def can_move(self, dname):
        st = self.st
        dr, dc = DIR_VEC[dname]
        r, c = st.my_pos[0] + dr, st.my_pos[1] + dc
        if not self.inb(r, c):
            return False
        if (r, c) in self.own_zone_cache or (r, c) in self.learned_block:
            return False
        t = self.cell(r, c)
        if t == 'S' and st.hp <= 10:
            return False
        return t in ('G', 'S') or t == ''

    def enemy_threat_cells(self):
        """적 탱크가 다음 턴에 쏠 수 있는 칸들 (현재 위치 기준 직선 3칸, 가림 고려)"""
        cells = {}
        for name, pos in self.st.enemy_pos.items():
            for dname in DIR_ORDER:
                dr, dc = DIR_VEC[dname]
                r, c = pos
                for _ in range(SHOT_RANGE):
                    r += dr
                    c += dc
                    if not self.inb(r, c):
                        break
                    t = self.cell(r, c)
                    cells[(r, c)] = cells.get((r, c), 0) + 1
                    if t not in ('G', 'S', 'W', ''):
                        break
        return cells

    def plan(self):
        st = self.st
        me = st.my_pos
        x_hp = st.X_hp

        # 사격 가능한 대상 파악
        rays = {d: self.ray(me, d) for d in DIR_ORDER}
        dead_now = len(self.initial_enemies) - len([k for k, v in st.enemy_hp.items() if v > 0 and k in st.enemy_pos])
        dead_now = max(dead_now, 0)

        def dmg_of(use_mega):
            return MEGA_DMG if use_mega else NORMAL_DMG

        # 1) 포탑 사격 가능?
        x_dir = None
        for d in DIR_ORDER:
            if rays[d][0] == 'X':
                x_dir = d
        if x_dir is not None and (st.normal > 0 or st.mega > 0):
            # 이번 한 발로 포탑 파괴 가능하면 즉시
            if x_hp <= NORMAL_DMG and st.normal > 0:
                return self.shot_cmd(x_dir, False)
            if st.mega > 0 and x_hp <= MEGA_DMG:
                return self.shot_cmd(x_dir, True)
            # 적 탱크 처치로 2킬 달성(즉시 승리) 가능하면 우선
            if dead_now >= 1:
                k = self.kill_shot(rays)
                if k:
                    return k
            if st.mega > 0:
                return self.shot_cmd(x_dir, True)
            if st.normal > 0:
                return self.shot_cmd(x_dir, False)

        # 2) 한 방에 처치 가능한 적 탱크
        k = self.kill_shot(rays)
        if k:
            return k

        # 3) 레이스 판단: 우리 포탑이 먼저 위험하면 방어 사격
        race_us, race_them = self.race_estimate()
        threat_shot = self.defensive_shot(rays, race_us, race_them)
        if threat_shot:
            return threat_shot

        # 4) 교전: 사선이 겹친 적 탱크(서로 쏠 수 있음)는 먼저 쏘는 쪽이 이김 → 선제 사격
        duel = self.duel_shot(rays, race_us)
        if duel:
            return duel

        # 4) 이동 계획 (레인 배정 + 메가 확보)
        mv = self.move_plan(rays)
        if mv:
            return mv
        return None

    def kill_shot(self, rays):
        st = self.st
        best = None
        for d in DIR_ORDER:
            ry = rays[d]
            if ry[0] != 'E':
                continue
            name = ry[2]
            hp = st.enemy_hp.get(name, 100)
            if hp <= NORMAL_DMG and st.normal > 0:
                cand = (0, hp, self.shot_cmd(d, False))
            elif hp <= MEGA_DMG and st.mega > 0:
                cand = (1, hp, self.shot_cmd(d, True))
            else:
                continue
            if best is None or cand < best:
                best = cand
        if best is None:
            return None
        return best[2]

    def race_estimate(self):
        """(우리가 X를 부수는 데 걸리는 대략적 라운드, 적이 H를 부수는 데 걸리는 라운드)"""
        st = self.st
        us = self.team_kill_time(self.my_side_tanks(), st.X, st.X_hp, {'M': st.mega}, 'me')
        them = self.team_kill_time(list(st.enemy_pos.items()), st.H, st.H_hp, {}, 'enemy')
        return us, them

    def my_side_tanks(self):
        st = self.st
        lst = [('M', st.my_pos)]
        for k, p in st.ally_pos.items():
            if st.ally_hp.get(k, 100) > 0:
                lst.append((k, p))
        return lst

    def team_kill_time(self, tanks, target, hp, megas, side):
        if target is None or not tanks:
            return INF
        lane_costs = []
        for name, pos in tanks:
            dist, _ = self.dijkstra(pos, side=side)
            opts = self.lane_options(dist, target)
            lane_costs.append((name, opts))
        # 레인당 1대, 탱크당 1레인 배정 후 피해 누적 시뮬레이션 → 최소 처치 라운드
        lanes = sorted(set(l for _, o in lane_costs for l in o.keys()))
        best = INF
        n = len(lane_costs)

        def rec(i, used, assign):
            nonlocal best
            if i == n:
                t = self.kill_round(assign, hp, megas)
                if t < best:
                    best = t
                return
            rec(i + 1, used, assign)
            name, opts = lane_costs[i]
            for ln, (cost, _) in opts.items():
                if ln in used:
                    continue
                rec(i + 1, used | {ln}, assign + [(name, cost)])

        rec(0, frozenset(), [])
        return best

    def kill_round(self, assign, hp, megas):
        if not assign:
            return INF
        events = []
        for name, cost in assign:
            m = megas.get(name, 0)
            start = int(cost) + 1
            for k in range(0, 8):
                dmg = MEGA_DMG if k < m else NORMAL_DMG
                events.append((start + k, dmg))
        events.sort()
        tot = 0
        for t, d in events:
            tot += d
            if tot >= hp:
                return t
        return INF

    def defensive_shot(self, rays, race_us, race_them):
        """레이스에서 지고 있을 때만: 우리 포탑을 쏠 수 있는 적 탱크를 우선 사격"""
        st = self.st
        if not (race_them < race_us):
            return None
        best = None
        for d in DIR_ORDER:
            ry = rays[d]
            if ry[0] != 'E':
                continue
            name = ry[2]
            hp = st.enemy_hp.get(name, 100)
            pos = ry[1]
            tH = self.can_hit_from(pos, st.H)
            near_H = 0
            if st.H is not None:
                near_H = abs(pos[0] - st.H[0]) + abs(pos[1] - st.H[1])
            key = (0 if tH else 1, hp, near_H)
            use_mega = st.mega > 0
            if not use_mega and st.normal <= 0:
                continue
            cand = (key, self.shot_cmd(d, use_mega))
            if best is None or cand < best:
                best = cand
        return best[1] if best else None

    ENGAGE = 4
    MEGA_DETOUR = True
    ROLE = 'AUTO'   # 'STRIKER' / 'MEGA' / 'GUARD' (파일별로 지정), 'AUTO'면 자동 분담
    SLOT_ROLES = {'M1': 'GUARD', 'M2': 'MEGA', 'M3': 'STRIKER'}  # 실행 순서 Player1>2>3 기준

    def role_of(self, name):
        """탱크 이름(M=나, M1~M3=아군)의 역할"""
        if self.ROLE == 'AUTO':
            return 'AUTO'
        if name == 'M':
            return self.ROLE
        mapping = dict(self.SLOT_ROLES)
        mine = mapping.get(self.my_id)
        if mine != self.ROLE:
            # 실행 순서가 바뀐 경우: 내 역할을 가진 슬롯과 맞바꿔서 추정
            for k, v in list(mapping.items()):
                if v == self.ROLE:
                    mapping[k] = mine
            mapping[self.my_id] = self.ROLE
        return mapping.get(name, 'AUTO')

    def effective_engage(self):
        return 1 if self.ROLE == 'GUARD' else self.ENGAGE

    def duel_shot(self, rays, race_us):
        st = self.st
        engage = self.effective_engage()
        if engage == 0:
            return None
        best = None
        for d in DIR_ORDER:
            ry = rays[d]
            if ry[0] != 'E':
                continue
            name = ry[2]
            hp = st.enemy_hp.get(name, 100)
            if engage == 2:
                # 내가 곧(2턴 이내) 포탑을 쏠 수 있으면 교전 무시하고 레이스 우선
                if race_us <= 3 and st.X_hp > 0:
                    continue
            if engage == 4:
                if not (self.was_shot or hp <= 60 or hp < st.hp or self.can_hit_from(ry[1], st.H)):
                    continue
            if engage == 3:
                # 적이 공격적이거나(내가 맞은 적 있음) 약하거나 우리 포탑을 노릴 때만 교전
                if not (self.was_shot or hp <= 60 or self.can_hit_from(ry[1], st.H)):
                    continue
            use_mega = st.mega > 0 and hp > NORMAL_DMG and (st.X_hp <= NORMAL_DMG or st.mega >= 2)
            if not use_mega and st.normal <= 0:
                continue
            key = (hp, 0 if self.can_hit_from(ry[1], st.H) else 1)
            cand = (key, self.shot_cmd(d, use_mega))
            if best is None or cand < best:
                best = cand
        return best[1] if best else None

    def can_hit_from(self, pos, target):
        if pos is None or target is None:
            return False
        if pos[0] != target[0] and pos[1] != target[1]:
            return False
        dist = abs(pos[0] - target[0]) + abs(pos[1] - target[1])
        if dist == 0 or dist > SHOT_RANGE:
            return False
        dr = (target[0] > pos[0]) - (target[0] < pos[0])
        dc = (target[1] > pos[1]) - (target[1] < pos[1])
        r, c = pos
        for _ in range(dist - 1):
            r += dr
            c += dc
            if not self.shell_transparent(r, c):
                return False
        return True

    def move_plan(self, rays):
        st = self.st
        me = st.my_pos
        dist, parent = self.dijkstra(me, hp=st.hp)

        target_cell = None
        want_mega = False

        if st.X is not None:
            # 아군 전체 레인 배정 (모든 클라이언트가 같은 규칙으로 계산 → 역할 자동 분담)
            tanks = self.my_side_tanks()
            attackers = [(n, p) for n, p in tanks if self.role_of(n) != 'GUARD']
            guard_mode = False
            if self.HARD_ROLES and len(attackers) >= 2 and st.X_hp > NORMAL_DMG:
                if self.role_of('M') == 'GUARD':
                    guard_mode = True
                tanks = attackers
            if guard_mode:
                return self.guard_plan(dist, parent, rays)
            per = []
            for name, pos in tanks:
                if name == 'M':
                    opts = self.lane_options(dist, st.X)
                else:
                    d2, _ = self.dijkstra(pos, hp=st.ally_hp.get(name, 100))
                    opts = self.lane_options(d2, st.X)
                per.append((name if name != 'M' else self.my_id, name, opts))
            per.sort(key=lambda x: x[0])
            assign = self.assign_lanes(per)
            my_lane = assign.get('M')

            # 메가탄 확보 여부 판단
            if my_lane is not None:
                lane_cost, lane_cell = my_lane
                direct_time = lane_cost
                mega_plan = self.mega_detour(dist, st.X, lane_cell) if (self.mega_enabled() and self.MEGA_DETOUR) else None
                role = self.role_of('M')
                mega_goal = 2 if (role == 'MEGA' and self.HARD_ROLES) else 1
                slack = {'MEGA': self.MEGA_SLACK, 'STRIKER': -1}.get(role, 0)
                if mega_plan is not None and st.X_hp > NORMAL_DMG and st.mega < mega_goal:
                    q, via_cost = mega_plan
                    need = mega_goal - st.mega
                    via_cost += need - 1
                    # 다른 아군의 예상 사격 일정 + 내 일정으로 처치 라운드 비교
                    others = [(n, c) for n, c in assign.get('_list', []) if n != 'M']
                    t_direct = self.kill_round(others + [('M', direct_time)], st.X_hp, {'M': st.mega})
                    t_mega = self.kill_round(others + [('M', via_cost)], st.X_hp, {'M': mega_goal})
                    if t_mega <= t_direct + slack:
                        target_cell = q
                        want_mega = True
                if target_cell is None:
                    target_cell = lane_cell
            else:
                # 레인이 모두 찼거나 갈 수 없음 → 지원 역할: 메가 확보 후 적 탱크 사냥/대기
                if self.role_of('M') == 'GUARD':
                    return self.guard_plan(dist, parent, rays)
                support_mega = 3 if self.role_of('M') == 'MEGA' else 2
                if st.mega < support_mega and self.mega_enabled():
                    q = self.nearest_supply_adj(dist)
                    if q is not None and dist[q] <= 12:
                        target_cell = q
                        want_mega = True
                if target_cell is None:
                    target_cell = self.hunt_cell(dist)
                if target_cell is None:
                    # 아무 레인 칸이나 가장 가까운 곳 근처로
                    opts = self.lane_options(dist, st.X)
                    if opts:
                        target_cell = min(opts.values())[1]
        else:
            target_cell = self.hunt_cell(dist)

        # 보급시설 인접 + 메가 필요 → 해독
        if want_mega and target_cell == me and st.codes and st.mega < MAX_MEGA and self.mega_enabled():
            text, s = self.decode(st.codes[0])
            if text:
                self.pending_g = (s, st.mega)
                return f'G {text}'
        # 지나가는 길에 보급시설 인접 & 메가 0 & 포탑 체력 많음 → 공짜에 가까운 1회 해독은 하지 않음(시간 우선)

        if target_cell is None:
            return None
        if target_cell == me:
            # 레인 칸에 도착했지만 포탑이 가려짐 → 사이의 나무/적 탱크를 사격해서 뚫는다
            if st.X is not None:
                for d in DIR_ORDER:
                    ry = rays[d]
                    if ry[0] in ('T', 'E') and self.between(me, ry[1], st.X):
                        if st.normal > 0:
                            return self.shot_cmd(d, False)
                        if st.mega > 0:
                            return self.shot_cmd(d, True)
            return None
        step = self.first_step(parent, me, target_cell)
        if step is None:
            return None
        return self.step_cmd(step)

    def step_cmd(self, step):
        st = self.st
        me = st.my_pos
        for dname in DIR_ORDER:
            dr, dc = DIR_VEC[dname]
            if (me[0] + dr, me[1] + dc) == step:
                t = self.cell(*step)
                if t == 'T':
                    if st.normal > 0:
                        return self.shot_cmd(dname, False)
                    if st.mega > 0:
                        return self.shot_cmd(dname, True)
                    return None
                if self.can_move(dname):
                    return f'{dname} A'
                return None
        return None

    def assign_lanes(self, per):
        """per: [(정렬키, 이름, {lane: (cost, cell)})] → {'M': (cost, cell), '_list': [(name, cost)]}"""
        best = None
        n = len(per)

        def rec(i, used, cur):
            nonlocal best
            if i == n:
                lst = [(nm, cost) for nm, (cost, _cell) in cur]
                kr = self.kill_round(lst, self.st.X_hp, {})
                tot = sum(c + (0.5 if self.role_of(nm) == 'GUARD' else 0) for nm, c in lst)
                key = (kr, -len(lst), tot)
                if best is None or key < best[0]:
                    best = (key, dict((nm, v) for nm, v in cur), lst)
                return
            _, nm, opts = per[i]
            for ln in sorted(opts.keys()):
                if ln in used:
                    continue
                rec(i + 1, used | {ln}, cur + [(nm, opts[ln])])
            rec(i + 1, used, cur)

        rec(0, frozenset(), [])
        if best is None:
            return {}
        res = dict(best[1])
        res['_list'] = best[2]
        return res

    MEGA_SLACK = 0
    GUARD_MEGA = 2
    HARD_ROLES = False

    def guard_plan(self, dist, parent, rays):
        """수비/사냥 담당: 메가 확보 → 우리 포탑을 노리는 적 탱크를 최우선 사냥"""
        st = self.st
        me = st.my_pos
        target_cell = None
        threat = any(self.can_hit_from(p, st.H) for p in st.enemy_pos.values())
        if st.mega < self.GUARD_MEGA and self.mega_enabled() and not threat:
            q = self.nearest_supply_adj(dist)
            if q is not None and dist[q] <= 10:
                if q == me and st.codes and st.mega < MAX_MEGA:
                    text, s = self.decode(st.codes[0])
                    self.pending_g = (s, st.mega)
                    return f'G {text}'
                target_cell = q
        if target_cell is None:
            target_cell = self.hunt_cell(dist)
        if target_cell is None or target_cell == me:
            opts = self.lane_options(dist, st.X)
            if opts:
                target_cell = min(opts.values())[1]
        if target_cell is None or target_cell == me:
            return None
        step = self.first_step(parent, me, target_cell)
        return self.step_cmd(step) if step else None

    def supply_adj_cells(self):
        res = []
        for (fr, fc) in self.st.supplies:
            for dname in DIR_ORDER:
                dr, dc = DIR_VEC[dname]
                r, c = fr + dr, fc + dc
                if self.inb(r, c):
                    res.append((r, c))
        return res

    def nearest_supply_adj(self, dist):
        best = None
        for q in self.supply_adj_cells():
            if q in dist and (q == self.st.my_pos or self.cell(*q) in ('G', 'S', '')):
                if best is None or dist[q] < dist[best]:
                    best = q
        return best

    def mega_enabled(self):
        # 해독이 계속 실패하면(규칙을 못 찾으면) 시간 낭비 방지를 위해 메가 포기
        return self.shift is not None or self.g_fail < 4

    def between(self, a, b, target):
        """b가 a와 target 사이 직선 위에 있는지"""
        if a[0] == target[0] == b[0]:
            return min(a[1], target[1]) < b[1] < max(a[1], target[1])
        if a[1] == target[1] == b[1]:
            return min(a[0], target[0]) < b[0] < max(a[0], target[0])
        return False

    def mega_detour(self, dist, target, lane_cell):
        """보급시설 인접 칸 q를 경유해 1회 해독 후 레인으로 갈 때 총 비용"""
        best = None
        tries = 1.0 if self.shift is not None else 1.3
        for q in self.supply_adj_cells():
            if q not in dist:
                continue
            if not (q == self.st.my_pos or self.cell(*q) in ('G', 'S', '')):
                continue
            d2, _ = self.dijkstra(q, hp=self.st.hp, first_block_ally=False)
            opts = self.lane_options(d2, target)
            if not opts:
                continue
            lane_after = min(v[0] for v in opts.values())
            total = dist[q] + tries + lane_after
            if best is None or total < best[1]:
                best = (q, total)
        return best

    def hunt_cell(self, dist):
        """적 탱크를 쏠 수 있는 가장 가까운 위치 (우리 포탑에 가까운 적 우선)"""
        st = self.st
        best = None
        for name, pos in st.enemy_pos.items():
            hp = st.enemy_hp.get(name, 100)
            prio = 0
            if st.H is not None:
                prio = abs(pos[0] - st.H[0]) + abs(pos[1] - st.H[1]) * 1.0
                # 이미 우리 포탑을 쏠 수 있는 적(레인 점유자)은 최우선 제거 대상
                if self.can_hit_from(pos, st.H):
                    prio = -10
            for cellp, lane, trees, k in self.firing_cells(pos):
                if cellp not in dist:
                    continue
                cost = dist[cellp] + trees + prio * 0.3 + hp / 60.0
                if best is None or cost < best[0]:
                    best = (cost, cellp)
        return best[1] if best else None

    # ------------------------------------------------------- fallback
    def fallback(self):
        """어떤 경우에도 옐로카드를 피하는 안전 행동"""
        st = self.st
        me = st.my_pos
        rays = {d: self.ray(me, d) for d in DIR_ORDER}
        # 1) 적/포탑 사격
        for want in ('X', 'E'):
            for d in DIR_ORDER:
                if rays[d][0] == want:
                    if st.normal > 0:
                        return self.shot_cmd(d, False)
                    if st.mega > 0:
                        return self.shot_cmd(d, True)
        # 2) 목표 방향으로 가까워지는 이동
        goal = st.X if st.X is not None else (st.h // 2, st.w // 2)
        moves = []
        for d in DIR_ORDER:
            if self.can_move(d):
                dr, dc = DIR_VEC[d]
                nr, nc = me[0] + dr, me[1] + dc
                score = abs(nr - goal[0]) + abs(nc - goal[1])
                if self.cell(nr, nc) == 'S':
                    score += 0.5
                moves.append((score, d))
        # 3) 나무 사격 (유효한 행동)
        for d in DIR_ORDER:
            if rays[d][0] == 'T' and (st.normal > 0 or st.mega > 0):
                if not moves or moves[0][0] > 0:
                    pass
        if moves:
            moves.sort()
            return f'{moves[0][1]} A'
        for d in DIR_ORDER:
            if rays[d][0] == 'T':
                if st.normal > 0:
                    return self.shot_cmd(d, False)
                if st.mega > 0:
                    return self.shot_cmd(d, True)
        # 4) 정말 아무것도 못하면 (사방이 막힘) 보급시설 해독이라도 시도
        if st.codes and st.mega < MAX_MEGA:
            text, s = self.decode(st.codes[0])
            self.pending_g = (s, st.mega)
            return f'G {text}'
        # 5) 최후: 모래라도 이동
        for d in DIR_ORDER:
            dr, dc = DIR_VEC[d]
            nr, nc = me[0] + dr, me[1] + dc
            if self.inb(nr, nc) and self.cell(nr, nc) in ('G', 'S'):
                return f'{d} A'
        return 'S'


brain = Brain()

###################################
# 알고리즘 함수/메서드 부분 구현 끝
###################################
parse_data(game_data) if game_data else None

# 반복문: 메인 프로그램 <-> 클라이언트(이 코드) 간 순차로 데이터 송수신(동기 처리)
while game_data is not None:

    ###################################
    # 알고리즘 메인 부분 구현 시작
    ###################################

    # 파싱한 데이터를 화면에 출력하여 확인
    print_data()

    try:
        output = brain.decide(game_data)
    except Exception as e:
        print('[WARN] decide error', e)
        try:
            output = brain.fallback()
        except Exception:
            output = 'U A'
    print(f'[CMD] {output}')

    # 메인 프로그램에서 명령을 처리할 수 있도록 명령어를 submit()의 인자로 전달
    game_data = submit(output)

    # submit()의 리턴으로 받은 갱신된 데이터를 다시 파싱
    if game_data:
        parse_data(game_data)

    ###################################
    # 알고리즘 메인 부분 구현 끝
    ###################################

# 반복문을 빠져나왔을 때 메인 프로그램과의 연결을 완전히 해제하기 위해 close() 호출
close()
