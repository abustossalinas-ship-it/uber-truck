'use strict';

const repo = require('./repository');
const { getMatchParties } = require('./match-parties');
const { enableMatchFreeChat } = require('./match-chat');

const STATUSES = ['open', 'in_review', 'resolved', 'closed'];

async function userCanAccessMatch(user, match) {
  if (!user?.sub || !match) return false;
  if (user.role === 'admin') return true;
  const load = await repo.getById('load_requests', match.load_request_id);
  const offer = await repo.getById('capacity_offers', match.capacity_offer_id);
  if (user.role === 'shipper' && load?.shipper_user_id === user.sub) return true;
  if (user.role === 'carrier' && offer?.carrier_user_id === user.sub) return true;
  return false;
}

async function listCasesForUser(user) {
  const all = await repo.list('support_cases', {});
  const out = [];
  for (const c of all) {
    const match = await repo.getById('matches', c.match_id);
    if (!match) continue;
    if (c.opened_by_user_id === user.sub || (await userCanAccessMatch(user, match))) {
      out.push(c);
    }
  }
  return out.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
}

async function findOpenCaseForMatch(matchId) {
  const rows = await repo.list('support_cases', { match_id: matchId });
  return (
    rows.find((c) => c.status === 'open' || c.status === 'in_review') || null
  );
}

async function createCase({ match_id, user, subject, initial_message, auto }) {
  const match = await repo.getById('matches', match_id);
  if (!match) throw Object.assign(new Error('Emparejamiento no encontrado'), { statusCode: 404 });
  if (!(await userCanAccessMatch(user, match))) {
    throw Object.assign(new Error('No participas en este emparejamiento'), { statusCode: 403 });
  }
  const existing = await findOpenCaseForMatch(match_id);
  if (existing) return { case: existing, created: false };

  const parties = await getMatchParties(repo, match);
  const now = new Date().toISOString();
  const row = await repo.insert('support_cases', {
    match_id,
    opened_by_user_id: user.sub,
    opened_by_role: user.role === 'carrier' ? 'carrier' : 'shipper',
    subject: subject?.trim() || `Revisión — ${parties?.short || 'Emparejamiento'}`,
    status: 'open',
    auto_opened: Boolean(auto),
    created_at: now,
    updated_at: now,
  });

  if (initial_message?.trim()) {
    await addMessage({
      case_id: row.id,
      user,
      body: initial_message.trim(),
      as_moderator: false,
    });
  }

  return { case: row, created: true };
}

async function addMessage({ case_id, user, body, as_moderator }) {
  const supportCase = await repo.getById('support_cases', case_id);
  if (!supportCase) throw Object.assign(new Error('Caso no encontrado'), { statusCode: 404 });
  const match = await repo.getById('matches', supportCase.match_id);
  const isMod = user.role === 'admin' && as_moderator;
  if (!isMod && !(await userCanAccessMatch(user, match))) {
    throw Object.assign(new Error('Sin acceso al caso'), { statusCode: 403 });
  }
  const sender_role = isMod ? 'moderator' : user.role === 'carrier' ? 'carrier' : 'shipper';
  const msg = await repo.insert('support_messages', {
    case_id,
    sender_role,
    sender_user_id: user.sub,
    body: body.trim(),
    created_at: new Date().toISOString(),
  });
  await repo.update('support_cases', case_id, {
    status: isMod && supportCase.status === 'open' ? 'in_review' : supportCase.status,
    updated_at: new Date().toISOString(),
  });
  if (isMod && match?.id) {
    await enableMatchFreeChat(match.id);
  }
  return msg;
}

async function listMessages(case_id, user) {
  const supportCase = await repo.getById('support_cases', case_id);
  if (!supportCase) throw Object.assign(new Error('Caso no encontrado'), { statusCode: 404 });
  const match = await repo.getById('matches', supportCase.match_id);
  if (!(await userCanAccessMatch(user, match))) {
    throw Object.assign(new Error('Sin acceso'), { statusCode: 403 });
  }
  const rows = await repo.list('support_messages', { case_id });
  return rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

async function updateCaseStatus(case_id, user, status) {
  if (user.role !== 'admin') {
    throw Object.assign(new Error('Solo moderador (admin)'), { statusCode: 403 });
  }
  if (!STATUSES.includes(status)) {
    throw Object.assign(new Error('Estado inválido'), { statusCode: 400 });
  }
  const updated = await repo.update('support_cases', case_id, {
    status,
    updated_at: new Date().toISOString(),
  });
  if (status === 'in_review') {
    const supportCase = await repo.getById('support_cases', case_id);
    if (supportCase?.match_id) await enableMatchFreeChat(supportCase.match_id);
  }
  return updated;
}

async function openCaseForCancelledMatch(match, actorRole, penalty) {
  if (penalty?.type !== 'fee_suggested' || !penalty?.amount_clp) return null;
  const parties = await getMatchParties(repo, match);
  const subject = `Multa sugerida — ${parties?.short || match.id}`;
  const body =
    `Cancelación registrada con multa sugerida de $${Number(penalty.amount_clp).toLocaleString('es-CL')} CLP. ` +
    `Plazo ${process.env.PENALTY_DUE_DAYS || 7} días. Ambas partes pueden aportar antecedentes; un moderador revisará el caso.`;
  try {
    const user = { sub: null, role: 'admin' };
    const existing = await findOpenCaseForMatch(match.id);
    if (existing) {
      await repo.insert('support_messages', {
        case_id: existing.id,
        sender_role: 'moderator',
        sender_user_id: null,
        body,
        created_at: new Date().toISOString(),
      });
      return existing;
    }
    const row = await repo.insert('support_cases', {
      match_id: match.id,
      opened_by_user_id: null,
      opened_by_role: actorRole || 'system',
      subject,
      status: 'open',
      auto_opened: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await repo.insert('support_messages', {
      case_id: row.id,
      sender_role: 'moderator',
      sender_user_id: null,
      body,
      created_at: new Date().toISOString(),
    });
    return row;
  } catch (e) {
    console.error('support case auto-open failed', e);
    return null;
  }
}

module.exports = {
  STATUSES,
  listCasesForUser,
  createCase,
  addMessage,
  listMessages,
  updateCaseStatus,
  findOpenCaseForMatch,
  openCaseForCancelledMatch,
  userCanAccessMatch,
};
