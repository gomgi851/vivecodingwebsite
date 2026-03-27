import type { Hackathon, HackathonDetail, Leaderboard, Team, Submission } from '../types'

interface LeaderboardSeed {
  hackathonSlug?: string
  updatedAt?: string
  entries?: Leaderboard['entries']
  extraLeaderboards?: Leaderboard[]
}

interface DetailSeed extends HackathonDetail {
  extraDetails?: HackathonDetail[]
}

export const STORAGE_KEYS = {
  hackathons: 'hackathons',
  teams: 'teams',
  submissions: 'submissions',
  leaderboards: 'leaderboards',
  detailsBySlug: 'details_by_slug',
} as const

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

function readJson<T>(key: StorageKey, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(key: StorageKey, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value))
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    throw new Error(`Failed to load ${path}`)
  }
  return (await res.json()) as T
}

function normalizeLeaderboards(raw: LeaderboardSeed): Leaderboard[] {
  const boards: Leaderboard[] = []
  if (raw?.hackathonSlug && Array.isArray(raw.entries)) {
    boards.push({
      hackathonSlug: raw.hackathonSlug,
      updatedAt: raw.updatedAt,
      entries: raw.entries,
    })
  }
  for (const extra of raw?.extraLeaderboards || []) {
    boards.push(extra)
  }
  return boards
}

function normalizeDetails(raw: DetailSeed): Record<string, HackathonDetail> {
  const bySlug: Record<string, HackathonDetail> = {}
  if (raw?.slug) {
    bySlug[raw.slug] = raw
  }
  for (const extra of raw?.extraDetails || []) {
    if (extra?.slug) bySlug[extra.slug] = extra
  }
  return bySlug
}

function sanitizePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.trunc(parsed))
}

function normalizeTeam(team: Team): Team {
  const legacyCount = sanitizePositiveInt(team.memberCount, 1)
  const currentMemberCount = sanitizePositiveInt(team.currentMemberCount, legacyCount)
  const totalMemberCount = Math.max(sanitizePositiveInt(team.totalMemberCount, currentMemberCount), currentMemberCount)
  return {
    ...team,
    currentMemberCount,
    totalMemberCount,
    memberCount: currentMemberCount,
  }
}

function normalizeTeams(raw: Team[]): Team[] {
  return (raw || []).map(normalizeTeam)
}

function isAnySeedMissing(): boolean {
  return (
    !window.localStorage.getItem(STORAGE_KEYS.hackathons) ||
    !window.localStorage.getItem(STORAGE_KEYS.teams) ||
    !window.localStorage.getItem(STORAGE_KEYS.leaderboards) ||
    !window.localStorage.getItem(STORAGE_KEYS.submissions)
  )
}

export async function bootstrapStore(): Promise<{
  detailsBySlug: Record<string, HackathonDetail>
  snapshot: ReturnType<typeof readSnapshot>
}> {
  const missingSeed = isAnySeedMissing()
  const cachedDetails = readJson(
    STORAGE_KEYS.detailsBySlug,
    {} as Record<string, HackathonDetail>,
  )
  const hasCachedDetails = Object.keys(cachedDetails).length > 0
  const detailPromise = hasCachedDetails
    ? null
    : fetchJson<DetailSeed>('/data/public_hackathon_detail.json')

  if (missingSeed) {
    const [hackathons, teamsRaw, leaderboardRaw] = await Promise.all([
      fetchJson<Hackathon[]>('/data/public_hackathons.json'),
      fetchJson<Team[]>('/data/public_teams.json'),
      fetchJson<LeaderboardSeed>('/data/public_leaderboard.json'),
    ])

    let detailsBySlug = cachedDetails
    if (!hasCachedDetails) {
      const detailRaw = await detailPromise
      detailsBySlug = normalizeDetails(detailRaw as DetailSeed)
      writeJson(STORAGE_KEYS.detailsBySlug, detailsBySlug)
    }

    writeJson(STORAGE_KEYS.hackathons, hackathons)
    writeJson(STORAGE_KEYS.teams, normalizeTeams(teamsRaw))
    writeJson(STORAGE_KEYS.submissions, [] as Submission[])
    writeJson(STORAGE_KEYS.leaderboards, normalizeLeaderboards(leaderboardRaw))

    return {
      detailsBySlug,
      snapshot: readSnapshot(),
    }
  }

  if (hasCachedDetails) {
    return {
      detailsBySlug: cachedDetails,
      snapshot: readSnapshot(),
    }
  }

  const detailRaw = await detailPromise
  const detailsBySlug = normalizeDetails(detailRaw as DetailSeed)
  writeJson(STORAGE_KEYS.detailsBySlug, detailsBySlug)

  return {
    detailsBySlug,
    snapshot: readSnapshot(),
  }
}

export function readSnapshot(): {
  hackathons: Hackathon[]
  teams: Team[]
  submissions: Submission[]
  leaderboards: Leaderboard[]
} {
  return {
    hackathons: readJson(STORAGE_KEYS.hackathons, [] as Hackathon[]),
    teams: normalizeTeams(readJson(STORAGE_KEYS.teams, [] as Team[])),
    submissions: readJson(STORAGE_KEYS.submissions, [] as Submission[]),
    leaderboards: readJson(STORAGE_KEYS.leaderboards, [] as Leaderboard[]),
  }
}

export function persistHackathons(value: Hackathon[]): void {
  writeJson(STORAGE_KEYS.hackathons, value)
}

export function persistTeams(value: Team[]): void {
  writeJson(STORAGE_KEYS.teams, normalizeTeams(value))
}

export function persistSubmissions(value: Submission[]): void {
  writeJson(STORAGE_KEYS.submissions, value)
}

export function persistLeaderboards(value: Leaderboard[]): void {
  writeJson(STORAGE_KEYS.leaderboards, value)
}
