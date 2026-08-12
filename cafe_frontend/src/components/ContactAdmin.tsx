import { useState } from 'react';
import { BRAND } from '../constants/theme';
import { postInquiry } from '../api/client';
import { PrimaryButton, ScreenContainer, ScreenHeader } from './ScreenChrome';

interface ContactAdminProps {
  onBack: () => void;
}

/** WF20 운영자 제보(문의하기). POST /api/inquiries 로 실제 접수된다. */
export default function ContactAdmin({ onBack }: ContactAdminProps) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await postInquiry({ name, content });
      setSubmitted(true);
      setTimeout(onBack, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : '접수에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenContainer>
      <ScreenHeader title="문의하기" onBack={onBack} />
      <div style={{ padding: 20 }}>
        <label style={{ fontSize: 12, color: BRAND.textSub, display: 'block', marginBottom: 6 }}>신청자 이름</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름을 입력해주세요"
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 10,
            border: `1px solid ${BRAND.border}`,
            fontSize: 14,
            marginBottom: 16,
            boxSizing: 'border-box',
          }}
        />

        <label style={{ fontSize: 12, color: BRAND.textSub, display: 'block', marginBottom: 6 }}>문의 글 작성</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="문의 내용을 자세히 적어주시면 빨리 도와드릴 수 있어요"
          rows={8}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 10,
            border: `1px solid ${BRAND.border}`,
            fontSize: 14,
            marginBottom: 16,
            resize: 'vertical',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />

        <label style={{ fontSize: 12, color: BRAND.textSub, display: 'block', marginBottom: 6 }}>그림 추가</label>
        <button
          onClick={() => alert('이 데모에서는 이미지 첨부가 비활성화되어 있어요.')}
          style={{
            width: 64,
            height: 64,
            borderRadius: 10,
            border: `1px dashed ${BRAND.border}`,
            background: '#fff',
            fontSize: 22,
            color: BRAND.textSub,
            cursor: 'pointer',
            marginBottom: 24,
          }}
        >
          +
        </button>

        <PrimaryButton disabled={content.trim() === '' || submitting} onClick={submit}>
          {submitting ? '접수 중…' : '글 작성하기'}
        </PrimaryButton>
        {error && <p style={{ color: BRAND.danger, fontSize: 13, marginTop: 8 }}>{error}</p>}
        {submitted && (
          <div style={{ textAlign: 'center', fontSize: 12, color: BRAND.primary, marginTop: 10 }}>
            문의가 접수됐어요. 확인 후 답변 드릴게요.
          </div>
        )}
      </div>
    </ScreenContainer>
  );
}
