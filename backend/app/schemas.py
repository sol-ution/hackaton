from pydantic import BaseModel, Field


class DiagnoseRequest(BaseModel):
    height_cm: float = Field(..., gt=0, le=250, description="키 (cm)")
    weight_kg: float = Field(..., gt=0, le=300, description="몸무게 (kg)")
    image: str | None = Field(None, description="인바디 사진 (base64 또는 data URL, 선택)")


class DiagnoseResponse(BaseModel):
    bmi: float
    category: str          # 저체중 / 정상 / 과체중 / 비만
    area: str              # 예: "코어·하체"
    comment: str           # AI 진단 코멘트
    tags: list[str]        # 예: ["코어", "하체"]

class Exercise(BaseModel):
    abbrev: str        # 약자 (예: SQ)
    name: str          # 운동 이름
    target: str        # 부위 태그 (예: 하체)
    sets: int          # 세트 수
    reps: str          # 반복 (예: 15회 / 30초)
    correction: str    # 교정 포인트 (예: 관절 각도 교정)


class ExerciseResponse(BaseModel):
    tags: list[str]              # 요청한 부위 태그
    exercises: list[Exercise]    # 추천 운동 목록