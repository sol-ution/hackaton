import { useState } from "react";

const GOALS = ["근력 강화", "체지방 감량", "자세 개선"];

export default function BodyInfoForm() {
  const [height, setHeight] = useState("172");
  const [weight, setWeight] = useState("76");
  const [selectedGoal, setSelectedGoal] = useState("자세 개선");

  const handleAnalyze = () => {
    // TODO: 여기서 백엔드 API 호출 (예: POST /api/analyze)
    // fetch("/api/analyze", { method: "POST", body: JSON.stringify({ height, weight, goal: selectedGoal }) })
    console.log({ height, weight, goal: selectedGoal });
  };

  return (
    <div className="max-w-sm mx-auto border-2 border-blue-400 rounded-3xl p-6 bg-white">
      <h1 className="text-xl font-bold mb-1">1. 신체 정보 입력</h1>
      <p className="text-gray-400 text-sm mb-6">
        키와 몸무게를 입력하면 BMI와 운동 우선순위를 계산합니다.
      </p>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <label className="text-sm text-gray-600 block mb-1">키</label>
          <input
            className="w-full border rounded-xl px-3 py-3 text-center text-lg"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="text-sm text-gray-600 block mb-1">몸무게</label>
          <input
            className="w-full border rounded-xl px-3 py-3 text-center text-lg"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
      </div>

      <label className="text-sm text-gray-600 block mb-2">운동 목표</label>
      <div className="flex gap-2 mb-6 flex-wrap">
        {GOALS.map((goal) => (
          <button
            key={goal}
            onClick={() => setSelectedGoal(goal)}
            className={`px-4 py-2 rounded-full text-sm ${
              selectedGoal === goal
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {goal}
          </button>
        ))}
      </div>

      <button
        onClick={handleAnalyze}
        className="w-full bg-black text-white rounded-xl py-4 font-medium"
      >
        AI 분석하기
      </button>
    </div>
  );
}