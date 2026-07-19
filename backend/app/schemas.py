from pydantic import BaseModel, Field


class DiagnoseRequest(BaseModel):
    height_cm: float = Field(..., gt=0, le=250, description="키 (cm)")
    weight_kg: float = Field(..., gt=0, le=300, description="몸무게 (kg)")
    image: str | None = Field(None, description="인바디 사진 (base64 또는 data URL, 선택)")


class DiagnoseResponse(BaseModel):
    bmi: float
    category: str
    area: str
    comment: str
    tags: list[str]


class Exercise(BaseModel):
    # 2번(운동 추천) 리스트용 요약 정보
    id: str
    abbrev: str
    name: str
    target: str
    sets: int
    reps: str
    correction: str


class ExerciseResponse(BaseModel):
    tags: list[str]
    exercises: list[Exercise]


class ExerciseDetail(BaseModel):
    # 4번(운동 상세)용 전체 정보
    id: str
    abbrev: str
    name: str
    target: str
    subtitle: str
    sets: int
    reps: str
    duration_min: int
    correction: str
    guide: list[str]