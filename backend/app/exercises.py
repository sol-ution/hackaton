# 부위(태그)별 운동 데이터 ── 지금은 규칙 기반 하드코딩
# subtitle / guide 는 4번(운동 상세) 화면용.
# 스쿼트만 상세하게, 나머지는 간단하게.
EXERCISES = [
    {
        "id": "squat", "abbrev": "SQ", "name": "스쿼트", "target": "하체",
        "sets": 3, "reps": "15회", "duration_min": 5, "correction": "관절 각도 교정",
        "subtitle": "하체·코어를 함께 단련하는 기본 운동",
        "guide": [
            "발을 어깨너비로 벌리고 섭니다",
            "무릎이 발끝을 넘지 않도록 앉습니다",
            "허벅지가 바닥과 평행이 될 때까지 내려갑니다",
            "천천히 일어서며 처음 자세로 돌아옵니다",
        ],
    },
    {
        "id": "lunge", "abbrev": "LG", "name": "런지", "target": "하체",
        "sets": 3, "reps": "12회", "duration_min": 5, "correction": "무릎 방향 교정",
        "subtitle": "하체 균형과 근력을 키우는 운동",
        "guide": ["한 발을 앞으로 내딛습니다", "앞 무릎을 90도로 굽힙니다", "처음 자세로 돌아옵니다"],
    },
    {
        "id": "bridge", "abbrev": "BR", "name": "브릿지", "target": "하체",
        "sets": 3, "reps": "15회", "duration_min": 4, "correction": "골반 정렬 교정",
        "subtitle": "둔근을 집중적으로 자극하는 운동",
        "guide": ["누워서 무릎을 세웁니다", "엉덩이를 들어 올립니다", "천천히 내려옵니다"],
    },
    {
        "id": "plank", "abbrev": "PL", "name": "플랭크", "target": "코어",
        "sets": 3, "reps": "30초", "duration_min": 4, "correction": "허리 정렬 교정",
        "subtitle": "코어를 안정적으로 잡아주는 정적 운동",
        "guide": ["팔꿈치를 어깨 아래에 둡니다", "몸을 일직선으로 유지합니다", "호흡하며 버팁니다"],
    },
    {
        "id": "crunch", "abbrev": "CR", "name": "크런치", "target": "코어",
        "sets": 3, "reps": "15회", "duration_min": 4, "correction": "목 긴장 교정",
        "subtitle": "상복부를 집중 자극하는 코어 운동",
        "guide": ["누워서 무릎을 세웁니다", "상체를 말아 올립니다", "천천히 내려옵니다"],
    },
    {
        "id": "pushup", "abbrev": "PU", "name": "푸시업", "target": "상체",
        "sets": 3, "reps": "12회", "duration_min": 4, "correction": "팔꿈치 각도 교정",
        "subtitle": "가슴·삼두를 단련하는 상체 운동",
        "guide": ["손을 어깨너비로 짚습니다", "가슴이 바닥에 닿기 직전까지 내려갑니다", "밀어 올라옵니다"],
    },
    {
        "id": "burpee", "abbrev": "BP", "name": "버피", "target": "전신",
        "sets": 3, "reps": "10회", "duration_min": 6, "correction": "착지 자세 교정",
        "subtitle": "전신을 태우는 고강도 운동",
        "guide": ["손을 바닥에 짚고 다리를 뒤로 뻗습니다", "다시 당겨 점프합니다", "반복합니다"],
    },
    {
        "id": "jumpingjack", "abbrev": "JJ", "name": "점핑잭", "target": "유산소",
        "sets": 3, "reps": "30초", "duration_min": 3, "correction": "팔 각도 교정",
        "subtitle": "심박을 올리는 전신 유산소",
        "guide": ["차렷 자세로 섭니다", "점프하며 팔다리를 벌립니다", "다시 모읍니다"],
    },
]