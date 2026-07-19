from fastapi import APIRouter, Query, HTTPException

from app.schemas import (
    DiagnoseRequest, DiagnoseResponse,
    Exercise, ExerciseResponse, ExerciseDetail,
)
from app.exercises import EXERCISES

router = APIRouter(prefix="/api", tags=["diagnosis"])

RULES: dict[str, tuple[list[str], str]] = {
    "저체중": (["전신", "상체"], "근육량이 부족한 편이라, 전신·상체 근력 운동을 추천드려요."),
    "정상":   (["전신", "코어"], "균형 잡힌 편이에요. 컨디션 유지용 전신·코어 운동을 추천드려요."),
    "과체중": (["코어", "하체"], "체지방 비율이 높고 코어·하체 근력이 부족한 편이라, 코어·하체 중심 운동을 추천드려요."),
    "비만":   (["유산소", "하체"], "체지방 비율이 높은 편이라, 유산소와 하체 운동을 함께 추천드려요."),
}


def classify_bmi(bmi: float) -> str:
    if bmi < 18.5:
        return "저체중"
    if bmi < 25:
        return "정상"
    if bmi < 30:
        return "과체중"
    return "비만"


def generate_diagnosis(category: str, image: str | None) -> tuple[list[str], str]:
    return RULES.get(category, RULES["정상"])


@router.post("/diagnose", response_model=DiagnoseResponse)
def diagnose(req: DiagnoseRequest) -> DiagnoseResponse:
    bmi = round(req.weight_kg / ((req.height_cm / 100) ** 2), 1)
    category = classify_bmi(bmi)
    tags, comment = generate_diagnosis(category, req.image)
    return DiagnoseResponse(
        bmi=bmi, category=category, area="·".join(tags), comment=comment, tags=tags,
    )


@router.get("/exercises", response_model=ExerciseResponse)
def exercises(tags: str = Query(..., description="콤마로 구분된 부위 태그 (예: 코어,하체)")) -> ExerciseResponse:
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]
    found = [e for e in EXERCISES if e["target"] in tag_list]
    return ExerciseResponse(tags=tag_list, exercises=found)


@router.get("/exercises/{exercise_id}", response_model=ExerciseDetail)
def exercise_detail(exercise_id: str) -> ExerciseDetail:
    for e in EXERCISES:
        if e["id"] == exercise_id:
            return ExerciseDetail(**e)
    raise HTTPException(status_code=404, detail="운동을 찾을 수 없어요.")