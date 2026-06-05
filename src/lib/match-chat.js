'use strict';

const repo = require('./repository');

async function hasModeratorOnSupportCase(matchId) {
  const { findOpenCaseForMatch } = require('./support-cases');
  const supportCase = await findOpenCaseForMatch(matchId);
  if (!supportCase) return false;
  if (supportCase.status === 'in_review') return true;
  const msgs = await repo.list('support_messages', { case_id: supportCase.id });
  return msgs.some((m) => m.sender_role === 'moderator');
}

async function isMatchChatFree(match) {
  if (!match) return false;
  if (match.status === 'in_progress') return true;
  if (match.chat_human_at) return true;
  return hasModeratorOnSupportCase(match.id);
}

async function enableMatchFreeChat(matchId) {
  const match = await repo.getById('matches', matchId);
  if (!match) return null;
  if (match.chat_human_at) return match;
  return repo.update('matches', matchId, {
    chat_human_at: new Date().toISOString(),
  });
}

module.exports = {
  isMatchChatFree,
  enableMatchFreeChat,
  hasModeratorOnSupportCase,
};
