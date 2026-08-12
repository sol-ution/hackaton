"""
프론트-백엔드 데이터 계약 (Pydantic v2).

frontend/src/types/cafe.ts 를 1:1로 옮긴 것.
이 파일이 바뀌면 반드시 프론트(태영)와 같이 바꿔야 함.

- JSON 키는 전부 camelCase (TS와 동일)
- crowdLevel 0/1/2/3, id는 정수
- 시각은 ISO 8601 + 09:00 문자열
"""

from enum import Enum, IntEnum
from typing import Optional

from pydantic import BaseModel, Field


# ─────────────────────────────────────────────
# Enums  (TS의 union 타입들 → Python Enum)
# ─────────────────────────────────────────────

class CrowdLevel(IntEnum):
    """혼잡도 4단계. LightGBM 모델의 target(crowd_level)과 숫자가 동일해야 함."""
    FREE = 0      # 여유
    NORMAL = 1    # 보통
    CROWDED = 2   # 혼잡
    FULL = 3      # 만석


class CrowdSource(str, Enum):
    """혼잡도 값의 출처."""
    OWNER = "owner"          # 등록 카페, 사장님 실시간 좌석
    REPORT = "report"        # 미등록 카페, 최근 제보 기반
    PREDICTED = "predicted"  # 미등록 카페, AI 예측만
    NONE = "none"            # 데이터 없음 (회색 마커)


class Confidence(str, Enum):
    """예측 신뢰도. 최근 2시간 제보 3건 이상이면 high, 아니면 low."""
    HIGH = "high"
    LOW = "low"


class CafeTag(str, Enum):
    """카테고리 필터 태그."""
    STUDY = "study"
    TALK = "talk"
    OUTLET = "outlet"
    QUIET = "quiet"
    WIDE_TABLE = "wide-table"
    LATE_NIGHT = "late-night"


class OutletLevel(str, Enum):
    """콘센트 여유 정도. 제보 폼(WF06) 3단계와 동일."""
    MANY = "many"
    NORMAL = "normal"
    NONE = "none"


class SmokingRoomType(str, Enum):
    """흡연실 형태. 제보 폼(WF06) 3단계와 동일."""
    INDOOR = "indoor"
    OUTDOOR = "outdoor"
    NONE = "none"


class VisitCount(str, Enum):
    """방문 인원. 제보 폼에서만 씀 — Cafe엔 저장 안 함."""
    SOLO = "solo"
    TWO = "two"
    THREE_FOUR = "three-four"
    FIVE_PLUS = "five-plus"


# ─────────────────────────────────────────────
# Cafe  (GET /cafes, GET /cafes/{id} 응답)
# ─────────────────────────────────────────────

class Cafe(BaseModel):
    """
    지도 마커 / 상세 패널이 쓰는 카페 한 개.
    TS의 interface Cafe 와 1:1 대응.
    """
    id: int
    name: str
    address: str
    lat: float                          # 위도 (WGS84)
    lng: float                          # 경도
    isRegistered: bool                  # 사장님 계정 연결 여부

    crowdLevel: Optional[CrowdLevel]    # 데이터 없으면 None → 회색 마커
    crowdSource: CrowdSource
    confidence: Confidence

    occupancyPercent: Optional[float]   # 좌석 점유율 %. 없으면 None
    totalSeats: Optional[int]           # 등록 카페만 값 있음
    emptySeats: Optional[int]

    tags: list[CafeTag] = []

    hasSmokingRoom: bool
    restroomScore: Optional[int] = Field(default=None, ge=1, le=5)  # 화장실 청결도 1~5
    quietScore: Optional[int] = Field(default=None, ge=1, le=5)     # 조용함 1~5
    outletLevel: Optional[OutletLevel]                              # 콘센트 여유

    reportCount24h: int = 0             # 최근 24시간 제보 수
    updatedAt: str                      # ISO 8601, 예: 2026-08-06T15:04:00+09:00

    # WF04 상세 화면용 (등록 카페만 값 있음, 미등록은 None)
    structureNote: Optional[str] = None      # 예: "1층·2층 좌석 분리, 계단 있음"
    seatsSolo: Optional[int] = None          # 1인석 수
    seatsPair: Optional[int] = None          # 2인석 수
    seatsGroup: Optional[int] = None         # 단체석 수

    isFavorite: bool = False                 # 즐겨찾기 여부 (별 아이콘)


# ─────────────────────────────────────────────
# 제보 요청/응답  (POST /reports)
# ─────────────────────────────────────────────

class CrowdReportRequest(BaseModel):
    """
    사용자 제보 body 전체 (WF06 폼과 1:1).
    요일/시간/날씨/공휴일은 서버가 자동으로 채우므로 여기 없음.
    """
    cafeId: int
    crowdLevel: CrowdLevel
    quietScore: int = Field(ge=1, le=5)
    restroomScore: int = Field(ge=1, le=5)
    outletLevel: OutletLevel
    smokingRoom: SmokingRoomType
    visitCount: VisitCount
    note: str = Field(default="", max_length=100)   # 한줄 후기, 선택, 최대 100자
    userLat: float                                  # GPS 검증용
    userLng: float


class CrowdReportResponse(BaseModel):
    """제보 성공 응답."""
    success: bool
    distanceMeters: float


# ─────────────────────────────────────────────
# 사장님 좌석 갱신  (POST /owner/seats, 인증 필요)
# ─────────────────────────────────────────────

class OwnerSeatUpdateRequest(BaseModel):
    """
    사장님 좌석 상태 갱신 (WF11).
    v3: 정확한 좌석 수가 아니라 4단계 버튼(여유/보통/혼잡/만석) 중 하나만 고르므로
    emptySeats가 아니라 crowdLevel(0~3)을 받는다.
    """
    cafeId: int
    crowdLevel: CrowdLevel


# ─────────────────────────────────────────────
# 리뷰 (WF19)
# ─────────────────────────────────────────────

class ReviewCreate(BaseModel):
    """리뷰 작성 body."""
    cafeId: int
    rating: int = Field(ge=1, le=5)                  # 별점 1~5
    content: str = Field(default="", max_length=200)  # 한줄평
    tags: list[str] = []                              # 해시태그 (# 제외한 텍스트)


class ReviewUpdate(BaseModel):
    """리뷰 수정 body. 보낸 필드만 바뀐다."""
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    content: Optional[str] = Field(default=None, max_length=200)
    tags: Optional[list[str]] = None


class InquiryCreate(BaseModel):
    """문의하기 body (WF15)."""
    name: str = Field(min_length=1, max_length=30)      # 신청자 이름
    content: str = Field(min_length=1, max_length=1000)  # 문의 내용


# ─────────────────────────────────────────────
# 사장님 기능 (WF10~12)
# ─────────────────────────────────────────────

class Amenities(BaseModel):
    outlet: Optional[bool] = None
    wifi: Optional[bool] = None
    quiet: Optional[bool] = None
    noTimeLimit: Optional[bool] = None
    smokingRoom: Optional[bool] = None
    parking: Optional[bool] = None


class SeatComposition(BaseModel):
    total: Optional[int] = Field(default=None, ge=0)
    solo: Optional[int] = Field(default=None, ge=0)
    pair: Optional[int] = Field(default=None, ge=0)
    group: Optional[int] = Field(default=None, ge=0)


class StoreInfoUpdate(BaseModel):
    """매장 정보 저장 body (WF12). 보낸 필드만 반영."""
    weekdayHours: Optional[str] = None       # "08:00-22:00"
    weekendHours: Optional[str] = None
    holiday: Optional[str] = None            # "매주 월요일"
    structureNote: Optional[str] = Field(default=None, max_length=300)
    amenities: Optional[Amenities] = None
    seats: Optional[SeatComposition] = None


class StampSettingsUpdate(BaseModel):
    """스탬프·쿠폰 발행 조건 (사장님 쿠폰 관리)."""
    reward: Optional[str] = Field(default=None, max_length=50)
    goal: Optional[int] = Field(default=None, ge=1, le=50)
    dailyLimit: Optional[int] = Field(default=None, ge=1, le=10)
    radiusMeters: Optional[int] = Field(default=None, ge=10, le=1000)
    validDays: Optional[int] = Field(default=None, ge=1, le=365)
    ownerPin: Optional[str] = Field(default=None, min_length=4, max_length=6)


class CafeRegistrationRequest(BaseModel):
    """새 카페 등록 신청 (WF10)."""
    cafeName: str = Field(min_length=1, max_length=50)
    address: str = Field(default="", max_length=100)
    method: str = Field(default="business")   # business | phone
    value: str = Field(min_length=1, max_length=30)   # 사업자번호 또는 전화번호


class ReplyCreate(BaseModel):
    """제보 답글(신뢰도 투표)."""
    agree: bool                                        # 동의 여부
    content: str = Field(default="", max_length=100)


class KakaoLoginRequest(BaseModel):
    """카카오 로그인 (WF07). 프론트가 받은 인가 코드를 넘긴다."""
    code: str = Field(min_length=1)
    redirectUri: str = Field(min_length=1)
