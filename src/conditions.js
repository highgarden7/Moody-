export const CONDITIONS = [
  { key: 'spark',   label: '설렘',     emoji: '🥰',    color: '#F2A63C', cue: '사랑한다고 말해주기 딱 좋은 날' },
  { key: 'warm',    label: '다정',     emoji: '🤗',    color: '#F2BE53', cue: '지금 톡 보내면 엄청 좋아할걸' },
  { key: 'miss',    label: '보고싶음', emoji: '🥹',    color: '#EBC97E', cue: '보고 싶대, 얼굴 보자고 해줘' },
  { key: 'good',    label: '좋음',     emoji: '😀',    color: '#E0C088', cue: '편하게 평소처럼 함께해줘' },
  { key: 'pat',     label: '토닥 필요', emoji: '🥺',   color: '#CEC8AE', cue: '오늘은 좀 더 다정하게 안아줘' },
  { key: 'drained', label: '방전',     emoji: '🫠',    color: '#B8B4A4', cue: '무리 말고 푹 쉬게 해줘' },
  { key: 'alone',   label: '혼자모드', emoji: '😶‍🌫️', color: '#A4A8A2', cue: '잠깐 혼자 둘게, 곧 돌아올게' },
  { key: 'down',    label: '다운',     emoji: '🌧️',   color: '#8E94A0', cue: '말 없이 옆에만 있어줘' },
];

export function conditionByKey(key) {
  return CONDITIONS.find((c) => c.key === key) ?? null;
}
