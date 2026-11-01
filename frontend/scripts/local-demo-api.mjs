/** Development-only API fixture for exercising the ORIGINAL app end to end.
 * Installed only by the preview launcher, never imported by production code.
 */
import { randomUUID } from 'node:crypto';
import { valid, MAX_COMMENT_LENGTH } from '../src/lib/ratingCore.ts';

export const DEMO_TEAM_ID = 'local-full-flow-demo';
export const DEMO_API_PATH = '/__local_demo/api';

export function localDemoPlugin() {
  const colors = ['#ac6b10', '#5762c6', '#338d84', '#a95782', '#4a7fb5', '#6b8e23'];
  const team = { id: DEMO_TEAM_ID, name: 'Local Demo Team', course: 'DEMO',
    members: ['Alex', 'Jordan', 'Sam', 'Riley'].map((name, i) => ({ id: `demo-member-${i}`, name, color: colors[i] })) };
  const reviews = [];
  const send = (res, code, body) => {
    res.statusCode = code; res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body));
  };
  const body = async req => {
    let value = '';
    for await (const chunk of req) {
      value += chunk;
      if (value.length > 100_000) throw new Error('Request is too large.');
    }
    return JSON.parse(value || '{}');
  };
  const visibleReviews = viewer => reviews.map(review => {
    const copy = { ...review };
    if (copy.anonymous && copy.reviewerId !== viewer) delete copy.reviewerId;
    return copy;
  });

  return {
    name: 'local-full-flow-demo',
    transformIndexHtml: {
      order: 'pre',
      handler(_html, context) {
        if (context.path !== '/index.html') return;
        return [
          { tag: 'script', injectTo: 'head-prepend', children: `
            if (new URLSearchParams(location.search).get('start') === '1') {
              try { localStorage.removeItem(${JSON.stringify(`rmg-member-v1:${DEMO_TEAM_ID}`)}); } catch {}
              history.replaceState(null, '', '/');
            }
          ` },
          { tag: 'aside', injectTo: 'body-prepend', attrs: { 'aria-label': 'Local demo notice',
            style: 'padding:10px 18px;background:#fff1bc;color:#4b3c16;font:13px/1.5 system-ui;display:flex;gap:18px;flex-wrap:wrap;justify-content:space-between;' },
            children: '<span>本地完整演示 · 模拟成员和评分 · 不连接真实数据库 · 重启服务后演示评分清空</span><a href="/?start=1" style="color:#483b9c;font-weight:600">从选择成员重新开始</a>' },
        ];
      },
    },
    configureServer(server) {
      server.middlewares.use(DEMO_API_PATH, async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const path = url.pathname;
          const teamPath = `/teams/${DEMO_TEAM_ID}`;
          if (req.method === 'GET' && path === '/health') return send(res, 200, { status: 'ok', db: 'local demo memory' });
          if (req.method === 'GET' && path === '/teams') return send(res, 200, [team]);
          if (req.method === 'GET' && path === teamPath) return send(res, 200, team);
          if (req.method === 'GET' && path === `${teamPath}/reviews`) return send(res, 200, visibleReviews(url.searchParams.get('viewerId')));
          if (req.method === 'POST' && path === `${teamPath}/members`) {
            const data = await body(req);
            const name = typeof data.name === 'string' ? data.name.trim() : '';
            if (!name || name.length > 40) return send(res, 400, { message: 'Name must be 1–40 characters' });
            if (team.members.some(m => m.name.toLowerCase() === name.toLowerCase())) return send(res, 409, { message: 'This name is already on the team. Pick it from the list.' });
            const member = { id: `demo-${randomUUID()}`, name, color: colors[team.members.length % colors.length] };
            team.members.push(member); return send(res, 201, member);
          }
          if (req.method === 'POST' && path === `${teamPath}/reviews`) {
            const data = await body(req);
            if (!team.members.some(m => m.id === data.reviewerId) || !Array.isArray(data.reviews)) return send(res, 400, { message: 'Choose a valid team member.' });
            const targets = new Set();
            for (const review of data.reviews) {
              if (!valid(review) || !team.members.some(m => m.id === review.targetId) || review.targetId === data.reviewerId || targets.has(review.targetId)) {
                return send(res, 400, { message: 'Choose valid scores for every teammate.' });
              }
              targets.add(review.targetId);
            }
            if (targets.size !== team.members.length - 1) return send(res, 400, { message: 'Rate every teammate before submitting.' });
            for (const value of data.reviews) {
              const index = reviews.findIndex(r => r.reviewerId === data.reviewerId && r.targetId === value.targetId);
              const review = { id: index >= 0 ? reviews[index].id : randomUUID(), teamId: DEMO_TEAM_ID,
                reviewerId: data.reviewerId, targetId: value.targetId, rating: value.rating,
                scores: { participation: value.scores.participation, communication: value.scores.communication, quality: value.scores.quality },
                text: String(value.text ?? '').trim().slice(0, MAX_COMMENT_LENGTH), anonymous: value.anonymous === true, submittedAt: new Date().toISOString() };
              if (index < 0) reviews.push(review); else reviews[index] = review;
            }
            return send(res, 200, visibleReviews(data.reviewerId));
          }
          return send(res, 404, { message: 'This endpoint is not part of the local demo.' });
        } catch (error) { return send(res, 400, { message: error.message || 'Invalid demo request.' }); }
      });
    },
  };
}
