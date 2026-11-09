/*
 * Groups and invitations.
 *
 *   create (owner + invited emails) → invitees sign in with that email, enter the
 *   group's code and accept → once everyone has accepted, reviews start and
 *   membership is locked.
 *
 * Membership changes use single atomic updates whose filters re-check the rules
 * (still waiting, still invited, right code…), so two people acting at the same
 * moment can't corrupt a group. When an update matches nothing, `explain`
 * reloads the group to say exactly why.
 */
import type { Request, Response } from 'express';
import { isValidObjectId, Types } from 'mongoose';
import { MAX_NAME_LENGTH, MIN_GROUP_SIZE } from '../config/constants';
import { avatarPath, colorFor, emailName, isEmail, newInviteCode, normalizeCode, normalizeEmail } from '../lib/util';
import { authedUser } from '../middleware/auth';
import { HttpError } from '../middleware/errorHandler';
import { Review } from '../models/Review';
import { Team, type MemberDoc, type TeamDoc } from '../models/Team';
import { User, type UserDoc } from '../models/User';

type TeamParams = { teamId: string };
type MemberParams = TeamParams & { memberId: string };

// ---------- helpers ----------

/** The viewer's own entry: by account once accepted, by email while invited. */
export function findViewer(team: TeamDoc, user: UserDoc): MemberDoc | undefined {
  return (
    team.members.find((m) => m.user && String(m.user) === String(user._id)) ??
    team.members.find((m) => m.email === user.email)
  );
}

/** What a member's account adds to the group view: a picture link, and (for invitees) their username. */
type AccountInfo = { avatar: string; accountName?: string };
type AccountInfoMap = Map<string, AccountInfo>;

/**
 * memberId → account info. Joined members use their account; invited ones are matched by email,
 * so someone who already signed up shows their picture and username from the moment they're
 * invited. Pictures are links (not the images), which keeps group responses small; the `?v=`
 * changes whenever the account does, so browsers can cache the image forever.
 */
async function accountInfo(teams: TeamDoc[]): Promise<AccountInfoMap> {
  const members = teams.flatMap((t) => t.members);
  const userIds = members.flatMap((m) => (m.user ? [m.user] : []));
  const emails = members.flatMap((m) => (m.user ? [] : [m.email]));
  // Project a hasAvatar flag instead of loading the (large) image data itself.
  const users = await User.aggregate<{ _id: Types.ObjectId; email: string; name: string; updatedAt?: Date; hasAvatar: boolean }>([
    { $match: { $or: [{ _id: { $in: userIds } }, { email: { $in: emails } }] } },
    { $project: { email: 1, name: 1, updatedAt: 1, hasAvatar: { $gt: [{ $strLenCP: { $ifNull: ['$avatar', ''] } }, 0] } } },
  ]);
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const byEmail = new Map(users.map((u) => [u.email, u]));

  const info: AccountInfoMap = new Map();
  for (const m of members) {
    const u = m.user ? byId.get(String(m.user)) : byEmail.get(m.email);
    if (!u) continue;
    info.set(String(m._id), {
      avatar: u.hasAvatar ? avatarPath(u._id, u.updatedAt) : '',
      ...(!m.user && { accountName: u.name }),
    });
  }
  return info;
}

/** Team JSON for this viewer; the invite code is only shown to members who have accepted. */
async function toPublic(team: TeamDoc, user: UserDoc, accounts?: AccountInfoMap) {
  const info = accounts ?? (await accountInfo([team]));
  const json = team.toJSON() as unknown as Record<string, unknown> & { members: { id: string }[] };
  json.members = json.members.map((m) => ({ ...m, avatar: '', ...info.get(m.id) }));
  if (findViewer(team, user)?.status === 'accepted') json.inviteCode = team.inviteCode;
  return json;
}

async function loadTeam(teamId: string): Promise<TeamDoc> {
  const team = await Team.findById(teamId);
  if (!team) throw new HttpError(404, 'This group doesn’t exist (it may have been deleted)');
  return team;
}

/** Loads the group and checks the viewer is on it (invited or accepted). */
async function loadForViewer(teamId: string, user: UserDoc) {
  const team = await loadTeam(teamId);
  const viewer = findViewer(team, user);
  if (!viewer) throw new HttpError(403, `This group didn’t invite ${user.email}. Signed in with the wrong account?`);
  return { team, viewer };
}

function requireOwner(team: TeamDoc, user: UserDoc) {
  if (String(team.owner) !== String(user._id)) throw new HttpError(403, 'Only the person who created this group can do that');
}

function requireWaiting(team: TeamDoc, action: string) {
  if (team.reviewsStartedAt) throw new HttpError(409, `Reviews have already started, so you can’t ${action} anymore`);
}

/** Parses, normalizes and de-duplicates an `emails` array from the body. */
function parseEmails(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new HttpError(400, 'emails must be a list');
  const emails = raw.map((e) => (typeof e === 'string' ? normalizeEmail(e) : '')).filter(Boolean);
  const bad = emails.find((e) => !isEmail(e));
  if (bad) throw new HttpError(400, `“${bad}” isn’t a valid email address`);
  return [...new Set(emails)];
}

function inviteEntry(email: string) {
  return { _id: new Types.ObjectId(), email, name: emailName(email), color: colorFor(email), status: 'invited' as const };
}

/** Opens reviews if everyone has accepted and there are enough people. Safe to call any time. */
async function startIfReady(teamId: Types.ObjectId | string) {
  await Team.updateOne(
    {
      _id: teamId,
      reviewsStartedAt: null,
      'members.status': { $ne: 'invited' },
      [`members.${MIN_GROUP_SIZE - 1}`]: { $exists: true },
    },
    { $set: { reviewsStartedAt: new Date() } },
  );
}

async function respond(res: Response, teamId: Types.ObjectId | string, user: UserDoc, status = 200) {
  const team = await loadTeam(String(teamId));
  res.status(status).json(await toPublic(team, user));
}

// ---------- handlers ----------

/** Every group you're on or invited to, plus a `todo` hint for the home page. */
export async function listTeams(req: Request, res: Response) {
  const user = authedUser(req);
  const teams = await Team.find({ $or: [{ 'members.user': user._id }, { 'members.email': user.email }] }).sort({
    createdAt: -1,
  });

  // How many teammates you've reviewed in each group that is reviewing.
  const myMemberIds = teams.flatMap((t) => {
    const viewer = findViewer(t, user);
    return t.reviewsStartedAt && viewer ? [viewer._id] : [];
  });
  const counts = await Review.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { reviewerId: { $in: myMemberIds } } },
    { $group: { _id: '$team', n: { $sum: 1 } } },
  ]);
  const reviewed = new Map(counts.map((c) => [String(c._id), c.n]));
  const accounts = await accountInfo(teams); // one lookup for every group

  res.json(
    await Promise.all(
      teams.map(async (team) => {
        const viewer = findViewer(team, user)!;
        const hasSubmitted = (reviewed.get(String(team._id)) ?? 0) >= team.members.length - 1;
        const todo = viewer.status === 'invited' ? 'accept' : team.reviewsStartedAt && !hasSubmitted ? 'review' : null;
        return { ...(await toPublic(team, user, accounts)), todo };
      }),
    ),
  );
}

export async function getTeam(req: Request<TeamParams>, res: Response) {
  const user = authedUser(req);
  const { team } = await loadForViewer(req.params.teamId, user);
  res.json(await toPublic(team, user));
}

/** Body: { name, course, emails: string[] }. The creator joins automatically. */
export async function createTeam(req: Request, res: Response) {
  const user = authedUser(req);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const course = typeof req.body?.course === 'string' ? req.body.course.trim() : '';
  if (!name) throw new HttpError(400, 'Give your group a name');
  if (!course) throw new HttpError(400, 'Which course is this for?');
  if (name.length > MAX_NAME_LENGTH || course.length > MAX_NAME_LENGTH)
    throw new HttpError(400, `Group name and course must be at most ${MAX_NAME_LENGTH} characters`);

  const emails = parseEmails(req.body?.emails).filter((e) => e !== user.email);
  if (emails.length < MIN_GROUP_SIZE - 1) throw new HttpError(400, 'Invite at least one teammate (not counting yourself)');

  const team = await Team.create({
    name,
    course,
    owner: user._id,
    inviteCode: newInviteCode(),
    members: [
      { email: user.email, user: user._id, name: user.name, color: user.color, status: 'accepted', joinedAt: new Date() },
      ...emails.map(inviteEntry),
    ],
  });
  res.status(201).json(await toPublic(team, user));
}

/** Body: { code }. Accepts your invitation. Accepting twice is harmless. */
export async function acceptInvite(req: Request<TeamParams>, res: Response) {
  const user = authedUser(req);
  const code = typeof req.body?.code === 'string' ? normalizeCode(req.body.code) : '';
  if (!code) throw new HttpError(400, 'Enter the group’s invite code');

  const { team, viewer } = await loadForViewer(req.params.teamId, user);
  if (viewer.status === 'accepted') return res.json(await toPublic(team, user));
  requireWaiting(team, 'join');
  if (normalizeCode(team.inviteCode) !== code)
    throw new HttpError(400, 'That code doesn’t match. Check with whoever invited you (codes can be changed)');

  const updated = await Team.updateOne(
    {
      _id: team._id,
      reviewsStartedAt: null,
      inviteCode: team.inviteCode,
      members: { $elemMatch: { _id: viewer._id, status: 'invited' } },
    },
    {
      $set: {
        'members.$.status': 'accepted',
        'members.$.user': user._id,
        'members.$.name': user.name,
        'members.$.color': user.color,
        'members.$.joinedAt': new Date(),
      },
    },
  );
  if (updated.matchedCount === 0) {
    // Something changed between loading and updating: re-run the checks for a precise message.
    const fresh = await loadForViewer(req.params.teamId, user);
    if (fresh.viewer.status === 'accepted') return res.json(await toPublic(fresh.team, user));
    requireWaiting(fresh.team, 'join');
    throw new HttpError(409, 'The invite code was just changed. Ask for the new one');
  }
  await startIfReady(team._id);
  await respond(res, team._id, user);
}

/**
 * Removes your own entry: declining an invitation, or leaving a group that is
 * still waiting. The creator can't leave; they delete the group instead.
 */
export async function leaveTeam(req: Request<TeamParams>, res: Response) {
  const user = authedUser(req);
  const { team, viewer } = await loadForViewer(req.params.teamId, user);
  if (String(team.owner) === String(user._id))
    throw new HttpError(400, 'You created this group, so you can’t leave it. Delete the group instead');
  requireWaiting(team, viewer.status === 'invited' ? 'decline' : 'leave');

  const updated = await Team.updateOne(
    { _id: team._id, reviewsStartedAt: null },
    { $pull: { members: { _id: viewer._id } } },
  );
  if (updated.matchedCount === 0) requireWaiting(await loadTeam(req.params.teamId), 'leave');
  // If you were the last one who hadn't accepted, everyone else can start now.
  await startIfReady(team._id);
  res.status(204).end();
}

/** Owner only, while waiting. Body: { emails: string[] }. Already-listed emails are skipped. */
export async function addInvites(req: Request<TeamParams>, res: Response) {
  const user = authedUser(req);
  const team = await loadTeam(req.params.teamId);
  requireOwner(team, user);
  requireWaiting(team, 'invite people');

  const existing = new Set(team.members.map((m) => m.email));
  const emails = parseEmails(req.body?.emails).filter((e) => !existing.has(e));
  if (emails.length === 0) throw new HttpError(400, 'Everyone you listed is already in this group');

  const updated = await Team.updateOne(
    { _id: team._id, reviewsStartedAt: null, 'members.email': { $nin: emails } },
    { $push: { members: { $each: emails.map(inviteEntry) } } },
  );
  if (updated.matchedCount === 0) {
    requireWaiting(await loadTeam(req.params.teamId), 'invite people');
    throw new HttpError(409, 'Someone else just changed this group. Refresh and try again');
  }
  await respond(res, team._id, user, 201);
}

/** Owner only, while waiting: cancel an invitation nobody has accepted yet. */
export async function removeMember(req: Request<MemberParams>, res: Response) {
  const user = authedUser(req);
  if (!isValidObjectId(req.params.memberId)) throw new HttpError(400, 'Invalid memberId');
  const team = await loadTeam(req.params.teamId);
  requireOwner(team, user);
  requireWaiting(team, 'cancel invites');

  const target = team.members.find((m) => String(m._id) === req.params.memberId);
  if (!target) throw new HttpError(404, 'That person isn’t in this group anymore');
  if (target.status !== 'invited') throw new HttpError(400, `${target.name} already joined, so their invite can’t be cancelled`);

  const updated = await Team.updateOne(
    { _id: team._id, reviewsStartedAt: null, members: { $elemMatch: { _id: target._id, status: 'invited' } } },
    { $pull: { members: { _id: target._id } } },
  );
  if (updated.matchedCount === 0) {
    const fresh = await loadTeam(req.params.teamId);
    requireWaiting(fresh, 'cancel invites');
    const now = fresh.members.find((m) => String(m._id) === req.params.memberId);
    if (now) throw new HttpError(409, `${now.name} just joined, so their invite can’t be cancelled`);
  }
  await startIfReady(team._id);
  await respond(res, team._id, user);
}

/** Owner only, while waiting. The old code stops working immediately. */
export async function regenerateCode(req: Request<TeamParams>, res: Response) {
  const user = authedUser(req);
  const team = await loadTeam(req.params.teamId);
  requireOwner(team, user);
  requireWaiting(team, 'change the code');

  let code = newInviteCode();
  while (code === team.inviteCode) code = newInviteCode();
  const updated = await Team.updateOne({ _id: team._id, reviewsStartedAt: null }, { $set: { inviteCode: code } });
  if (updated.matchedCount === 0) requireWaiting(await loadTeam(req.params.teamId), 'change the code');
  await respond(res, team._id, user);
}

/** Owner only, while waiting (once reviews exist, deleting would destroy other people's work). */
export async function deleteTeam(req: Request<TeamParams>, res: Response) {
  const user = authedUser(req);
  const team = await loadTeam(req.params.teamId);
  requireOwner(team, user);
  requireWaiting(team, 'delete the group');

  const deleted = await Team.deleteOne({ _id: team._id, reviewsStartedAt: null });
  if (deleted.deletedCount === 0) requireWaiting(await loadTeam(req.params.teamId), 'delete the group');
  await Review.deleteMany({ team: team._id }); // none expected before reviews start; just in case
  res.status(204).end();
}
