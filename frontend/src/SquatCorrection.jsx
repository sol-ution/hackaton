import { useEffect, useRef, useState } from "react";
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

// 세 점(엉덩이-무릎-발목) 사이의 무릎 각도를 계산 (도 단위)
function calcKneeAngle(hip, knee, ankle) {
  const v1 = { x: hip.x - knee.x, y: hip.y - knee.y };
  const v2 = { x: ankle.x - knee.x, y: ankle.y - knee.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);
  const cos = dot / (mag1 * mag2);
  const angleRad = Math.acos(Math.min(1, Math.max(-1, cos)));
  return (angleRad * 180) / Math.PI;
}

// 어깨-엉덩이 라인이 수직선(바닥과 수직)에서 얼마나 앞으로 기울었는지 계산 (도 단위)
// 값이 클수록 상체가 앞으로 많이 숙여진(가슴이 말린) 상태
function calcTorsoLean(shoulder, hip) {
  const v = { x: shoulder.x - hip.x, y: shoulder.y - hip.y };
  const vertical = { x: 0, y: -1 }; // 화면 좌표는 y가 아래로 갈수록 커짐
  const dot = v.x * vertical.x + v.y * vertical.y;
  const mag = Math.sqrt(v.x ** 2 + v.y ** 2);
  const angleRad = Math.acos(Math.min(1, Math.max(-1, dot / mag)));
  return (angleRad * 180) / Math.PI;
}

// 무릎 각도 기준 스쿼트 깊이 판정 (규칙 기반 임계값)
function judgeDepth(kneeAngle) {
  if (kneeAngle > 160) return { status: "standing", label: "서 있는 자세", message: "천천히 앉아보세요" };
  if (kneeAngle > 100) return { status: "shallow", label: "얕음", message: "조금 더 앉아보세요" };
  if (kneeAngle >= 80) return { status: "good", label: "좋아요!", message: "완벽한 깊이예요" };
  return { status: "deep", label: "너무 깊음", message: "무릎에 무리가 갈 수 있어요, 살짝 올라오세요" };
}

// 상체 기울기 기준 가슴/허리 자세 판정 (규칙 기반 임계값)
// 서 있을 때는 기울기가 거의 0, 스쿼트 시엔 어느 정도 앞으로 기우는 게 정상이라
// 45도를 넘어가면 "가슴이 말리고 허리가 굽었다"고 판단
function judgeTorso(torsoLean) {
  if (torsoLean > 45) {
    return { ok: false, message: "가슴을 펴고 허리를 곧게 세워보세요" };
  }
  return { ok: true, message: "가슴·허리 자세 좋아요" };
}

// MediaPipe Pose 랜드마크 인덱스 (왼쪽/오른쪽, 어깨-엉덩이-무릎-발목)
const LEFT = { shoulder: 11, hip: 23, knee: 25, ankle: 27 };
const RIGHT = { shoulder: 12, hip: 24, knee: 26, ankle: 28 };

// 카메라에 더 또렷하게 잡힌 쪽을 자동으로 선택 (visibility 점수 비교)
function pickVisibleSide(lm) {
  const score = (s) =>
    (lm[s.shoulder].visibility ?? 0) + (lm[s.hip].visibility ?? 0) + (lm[s.knee].visibility ?? 0) + (lm[s.ankle].visibility ?? 0);
  return score(LEFT) >= score(RIGHT) ? LEFT : RIGHT;
}

export default function SquatCorrection({ onBack }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [kneeAngle, setKneeAngle] = useState(null);
  const [torsoLean, setTorsoLean] = useState(null);
  const [depth, setDepth] = useState(judgeDepth(180));
  const [torso, setTorso] = useState(judgeTorso(0));
  const [repCount, setRepCount] = useState(0);
  const wasDeepRef = useRef(false);

  useEffect(() => {
    let stream;

    async function setup() {
      try {
        // 1) 모델 로드 (CDN에서 wasm + 모델 파일 가져옴, 첫 로딩만 몇 초 걸림)
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });

        // 2) 웹캠 켜기
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        setReady(true);
        loop();
      } catch (e) {
        console.error(e);
        setError("웹캠 또는 모델 로드에 실패했어요. 카메라 권한을 확인해주세요.");
      }
    }

    function loop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !landmarkerRef.current) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");

      const result = landmarkerRef.current.detectForVideo(video, performance.now());
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (result.landmarks && result.landmarks.length > 0) {
        const lm = result.landmarks[0];
        const side = pickVisibleSide(lm);
        const shoulder = lm[side.shoulder];
        const hip = lm[side.hip];
        const knee = lm[side.knee];
        const ankle = lm[side.ankle];

        // 관절 점 그리기 (어깨-엉덩이-무릎-발목)
        ctx.fillStyle = "#4F46E5";
        [shoulder, hip, knee, ankle].forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 8, 0, 2 * Math.PI);
          ctx.fill();
        });
        // 연결선 그리기
        ctx.strokeStyle = "#4F46E5";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(shoulder.x * canvas.width, shoulder.y * canvas.height);
        ctx.lineTo(hip.x * canvas.width, hip.y * canvas.height);
        ctx.lineTo(knee.x * canvas.width, knee.y * canvas.height);
        ctx.lineTo(ankle.x * canvas.width, ankle.y * canvas.height);
        ctx.stroke();

        const kAngle = calcKneeAngle(hip, knee, ankle);
        const tLean = calcTorsoLean(shoulder, hip);
        const dResult = judgeDepth(kAngle);
        const tResult = judgeTorso(tLean);

        setKneeAngle(Math.round(kAngle));
        setTorsoLean(Math.round(tLean));
        setDepth(dResult);
        setTorso(tResult);

        // 깊게 앉았다가 다시 섰을 때 1회 카운트 (SHOULD 항목 겸용, 있으면 좋고 없어도 무방)
        if (dResult.status === "good" || dResult.status === "deep") {
          wasDeepRef.current = true;
        } else if (dResult.status === "standing" && wasDeepRef.current) {
          wasDeepRef.current = false;
          setRepCount((c) => c + 1);
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    setup();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      landmarkerRef.current?.close();
    };
  }, []);

  // 무릎 깊이가 우선, 거기에 상체(가슴/허리) 문제가 있으면 같이 경고
  const depthColor =
    depth.status === "good" ? "text-green-500" : depth.status === "deep" ? "text-red-500" : depth.status === "shallow" ? "text-yellow-500" : "text-gray-400";

  return (
    <div className="max-w-sm mx-auto border-2 border-blue-400 rounded-3xl p-6 bg-white">
      <h1 className="text-xl font-bold mb-1">스쿼트 실시간 자세 교정</h1>
      <p className="text-gray-400 text-sm mb-4">카메라 앞에서 옆모습으로 서주세요</p>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-xl p-4 mb-4">{error}</div>
      )}

      <div className="relative rounded-xl overflow-hidden bg-black mb-4 aspect-[3/4]">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full scale-x-[-1]"
        />
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
            카메라 준비 중...
          </div>
        )}
      </div>

      {ready && (
        <div className="text-center mb-4">
          <p className={`text-2xl font-bold ${depthColor}`}>{depth.label}</p>
          <p className="text-sm text-gray-500 mt-1">{depth.message}</p>

          {!torso.ok && (
            <p className="text-sm text-red-500 mt-2 font-medium">⚠ {torso.message}</p>
          )}

          <div className="flex justify-center gap-4 mt-3 text-xs text-gray-400 flex-wrap">
            <span>무릎 각도 {kneeAngle ?? "-"}°</span>
            <span>상체 기울기 {torsoLean ?? "-"}°</span>
            <span>완료 횟수 {repCount}회</span>
          </div>
        </div>
      )}

      <button
        onClick={onBack}
        className="w-full bg-gray-100 text-gray-700 rounded-xl py-4 font-medium"
      >
        운동 목록으로
      </button>
    </div>
  );
}