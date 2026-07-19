import { useState, useRef } from "react";
import SquatCorrection from "./SquatCorrection";

// ============================================================
// 백엔드 실제 스펙 (localhost:8000/docs 기준 확정)
// POST http://localhost:8000/api/diagnose
// body: { height_cm: number, weight_kg: number, image?: string | null }
// response: {
//   "bmi": 26.1,
//   "category": "과체중",
//   "area": "코어·하체",
//   "comment": "체지방 비율이 높고 코어·하체 근력이 부족한 편이라...",
//   "tags": ["코어", "하체"]
// }
// ============================================================
const API_URL = "http://localhost:8000/api/diagnose";

// 백엔드 연결 실패 시 데모가 안 죽도록 쓰는 임시 응답
function mockAnalyze() {
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          bmi: 26.1,
          category: "과체중",
          area: "코어·하체",
          comment:
            "입력하신 정보를 분석했어요. 체지방 비율이 높고 코어·하체 근력이 부족한 편이라, 코어·하체 중심 운동을 추천드려요.",
          tags: ["코어", "하체"],
        }),
      900
    )
  );
}

async function analyzeInbody({ heightCm, weightKg, image }) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        height_cm: heightCm,
        weight_kg: weightKg,
        image: image || null,
      }),
    });
    if (!res.ok) throw new Error("서버 응답 실패");
    return await res.json();
  } catch (e) {
    console.warn("백엔드 연결 실패, 임시 응답으로 대체합니다:", e.message);
    return mockAnalyze();
  }
}

const EXERCISES = {
  "코어": [
    { key: "squat", name: "스쿼트", emoji: "🏋️", desc: "하체와 코어를 동시에 강화하는 대표 근력 운동", live: true },
    { key: "plank", name: "플랭크", emoji: "🧘", desc: "코어 안정성을 길러주는 등척성 운동", live: false },
  ],
  "하체": [
    { key: "squat", name: "스쿼트", emoji: "🏋️", desc: "하체 전체를 자극하는 기본 근력 운동", live: true },
    { key: "lunge", name: "런지", emoji: "🦵", desc: "하체 균형과 근력을 함께 키우는 운동", live: false },
  ],
  default: [
    { key: "squat", name: "스쿼트", emoji: "🏋️", desc: "전신 밸런스에 도움이 되는 기본 운동", live: true },
    { key: "bird_dog", name: "버드독", emoji: "🐕", desc: "척추 중립을 유지하며 코어와 등을 강화", live: false },
  ],
};

function pickExercises(tags) {
  const key = tags?.[0] in EXERCISES ? tags[0] : "default";
  return EXERCISES[key];
}

export default function BodyInfoForm() {
  const [step, setStep] = useState("upload"); // "upload" | "loading" | "result" | "recommend" | "squat"
  const [height, setHeight] = useState("172");
  const [weight, setWeight] = useState("76");
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    const h = Number(height);
    const w = Number(weight);
    if (!h || !w) return;

    setStep("loading");
    const data = await analyzeInbody({ heightCm: h, weightKg: w, image: preview });
    setResult(data);
    setStep("result");
  };

  // ---- 5. 스쿼트 실시간 자세교정 화면 ----
  if (step === "squat") {
    return <SquatCorrection onBack={() => setStep("recommend")} />;
  }

  // ---- 4. 운동 추천 화면 ----
  if (step === "recommend") {
    const exercises = pickExercises(result?.tags);
    return (
      <div className="max-w-sm mx-auto border-2 border-blue-400 rounded-3xl p-6 bg-white">
        <h1 className="text-xl font-bold mb-1">추천 운동</h1>
        <p className="text-gray-400 text-sm mb-6">{result?.area} 강화에 도움이 되는 운동이에요.</p>

        <div className="flex flex-col gap-3 mb-6">
          {exercises.map((ex) => (
            <div key={ex.key} className="border rounded-xl p-4 flex gap-4 items-center">
              <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-3xl shrink-0">
                {ex.emoji}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{ex.name}</p>
                  {ex.live && (
                    <span className="text-xs bg-black text-white px-2 py-0.5 rounded-full">실시간 교정</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">{ex.desc}</p>
              </div>
              {ex.live && (
                <button
                  onClick={() => setStep("squat")}
                  className="text-xs bg-black text-white rounded-lg px-3 py-2 shrink-0"
                >
                  시작
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={() => setStep("result")}
          className="w-full bg-gray-100 text-gray-700 rounded-xl py-4 font-medium"
        >
          이전으로
        </button>
      </div>
    );
  }

  // ---- 3. 진단 결과 화면 ----
  if (step === "result" && result) {
    return (
      <div className="max-w-sm mx-auto border-2 border-blue-400 rounded-3xl p-6 bg-white">
        <h1 className="text-xl font-bold mb-1">진단 결과</h1>
        <p className="text-gray-400 text-sm mb-6">AI가 인바디 결과를 분석했어요.</p>

        <div className="flex items-end gap-2 mb-1">
          <span className="text-4xl font-bold">{result.bmi}</span>
          <span className="text-gray-400 mb-1">BMI</span>
        </div>
        <span className="inline-block px-3 py-1 rounded-full bg-gray-100 text-sm mb-4">{result.category}</span>

        <p className="text-sm font-semibold text-gray-500 mb-2">AI 진단</p>
        <div className="bg-gray-50 rounded-xl p-4 mb-3">
          <p className="text-sm text-gray-600 leading-relaxed">{result.comment}</p>
        </div>

        <div className="flex gap-2 mb-6">
          {(result.tags || []).map((t) => (
            <span key={t} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full">
              #{t}
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setStep("upload");
              setPreview(null);
              setFileName("");
            }}
            className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-4 font-medium"
          >
            다시 진단하기
          </button>
          <button
            onClick={() => setStep("recommend")}
            className="flex-1 bg-black text-white rounded-xl py-4 font-medium"
          >
            운동 추천 보기
          </button>
        </div>
      </div>
    );
  }

  // ---- 2. 분석 중 화면 ----
  if (step === "loading") {
    return (
      <div className="max-w-sm mx-auto border-2 border-blue-400 rounded-3xl p-6 bg-white flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-4" />
        <p className="text-sm text-gray-500">AI가 인바디 결과를 분석하고 있어요...</p>
      </div>
    );
  }

  // ---- 1. 입력 화면 (키/몸무게 필수 + 사진 선택) ----
  return (
    <div className="max-w-sm mx-auto border-2 border-yellow-400 rounded-3xl p-6 bg-white">
      <h1 className="text-xl font-bold mb-1">AI 홈트 코치</h1>
      <p className="text-gray-400 text-sm mb-6">내 몸에 맞는 운동을 AI가 찾아드려요</p>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <label className="text-sm text-gray-600 block mb-1">키 (cm)</label>
          <input
            className="w-full border rounded-xl px-3 py-3 text-center text-lg"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="text-sm text-gray-600 block mb-1">몸무게 (kg)</label>
          <input
            className="w-full border rounded-xl px-3 py-3 text-center text-lg"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-2">BMI · 인바디 결과 사진 <span className="text-gray-400">(선택)</span></p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {!preview ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl py-8 text-gray-400 text-sm mb-6"
        >
          사진을 선택해주세요 (없어도 진단 가능)
        </button>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full border rounded-xl p-3 mb-6 flex items-center gap-3 cursor-pointer"
        >
          <img src={preview} alt="업로드된 인바디 결과" className="w-10 h-10 object-cover rounded-lg" />
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{fileName}</p>
            <p className="text-xs text-gray-400">선택 완료</p>
          </div>
          <span className="text-xs text-indigo-500 shrink-0">변경</span>
        </div>
      )}

      <button
        onClick={handleAnalyze}
        disabled={!height || !weight}
        className={`w-full rounded-xl py-4 font-medium ${
          height && weight ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-400"
        }`}
      >
        AI 진단 받기
      </button>
    </div>
  );
}