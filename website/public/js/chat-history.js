// Deliberately in memory: no account messages, transcripts or device state are
// written to browser storage. Retain a bounded log during this home session.
export function syncChat(conversation) {
  conversation.turns ||= [];
  if (!conversation.transcript && !conversation.response) return conversation.turns;
  if (!conversation.transcript && !conversation.error) return conversation.turns;
  conversation.chatId ||= 1;
  const value = { id: conversation.chatId, transcript: conversation.transcript || '', response: conversation.response || '', language: conversation.replyLanguage || 'en', resultId: conversation.resultId || null, securityLink: !!conversation.securityLink };
  const index = conversation.turns.findIndex(turn => turn.id === value.id);
  if (index < 0) conversation.turns.push(value); else conversation.turns[index] = value;
  if (conversation.turns.length > 40) conversation.turns.splice(0, conversation.turns.length - 40);
  return conversation.turns;
}
export function beginChatTurn(conversation) {
  syncChat(conversation); conversation.chatId = (conversation.chatId || 0) + 1;
  conversation.transcript = ''; conversation.response = ''; conversation.resultId = null; conversation.securityLink = false; conversation.error = false;
}
