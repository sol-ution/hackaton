# 운동 완료 기록 ── 메모리에만 저장 (서버 끄면 사라짐. 데모용)
SESSIONS: list[dict] = []


def add_session(record: dict) -> dict:
    record["id"] = len(SESSIONS) + 1
    SESSIONS.append(record)
    return record


def make_feedback(accuracy: int) -> str:
    if accuracy >= 90:
        return "거의 완벽한 자세였어요! 이 강도를 유지해보세요."
    if accuracy >= 75:
        return "전반적으로 안정적인 자세였어요. 다만 하강 구간에서 조금 더 신경 써보세요."
    return "자세가 흔들린 구간이 있었어요. 다음엔 천천히 정확하게 해보세요."