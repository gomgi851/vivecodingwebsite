/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  bootstrapStore,
  persistHackathons,
  persistLeaderboards,
  persistSubmissions,
  persistTeams,
  readSnapshot,
} from './dataStore'
import type { Hackathon, HackathonDetail, Leaderboard, Submission, Team } from '../types'

interface AppDataContextValue {
  loading: boolean
  error: string | null
  detailsBySlug: Record<string, HackathonDetail>
  hackathons: Hackathon[]
  teams: Team[]
  submissions: Submission[]
  leaderboards: Leaderboard[]
  refresh: () => void
  setHackathons: (next: Hackathon[]) => void
  setTeams: (next: Team[]) => void
  setSubmissions: (next: Submission[]) => void
  setLeaderboards: (next: Leaderboard[]) => void
}

const AppDataContext = createContext<AppDataContextValue | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailsBySlug, setDetailsBySlug] = useState<Record<string, HackathonDetail>>({})
  const [hackathons, setHackathonsState] = useState<Hackathon[]>([])
  const [teams, setTeamsState] = useState<Team[]>([])
  const [submissions, setSubmissionsState] = useState<Submission[]>([])
  const [leaderboards, setLeaderboardsState] = useState<Leaderboard[]>([])

  useEffect(() => {
    let active = true

    async function load() {
      try {
        setLoading(true)
        setError(null)
        const { detailsBySlug: details, snapshot } = await bootstrapStore()
        if (!active) return
        setDetailsBySlug(details)
        setHackathonsState(snapshot.hackathons)
        setTeamsState(snapshot.teams)
        setSubmissionsState(snapshot.submissions)
        setLeaderboardsState(snapshot.leaderboards)
      } catch (err) {
        if (!active) return
        setError(err instanceof Error ? err.message : '데이터를 불러오지 못했습니다.')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  function refresh() {
    const snapshot = readSnapshot()
    setHackathonsState(snapshot.hackathons)
    setTeamsState(snapshot.teams)
    setSubmissionsState(snapshot.submissions)
    setLeaderboardsState(snapshot.leaderboards)
  }

  function setHackathons(next: Hackathon[]) {
    persistHackathons(next)
    setHackathonsState(next)
  }

  function setTeams(next: Team[]) {
    persistTeams(next)
    setTeamsState(next)
  }

  function setSubmissions(next: Submission[]) {
    persistSubmissions(next)
    setSubmissionsState(next)
  }

  function setLeaderboards(next: Leaderboard[]) {
    persistLeaderboards(next)
    setLeaderboardsState(next)
  }

  const value: AppDataContextValue = {
    loading,
    error,
    detailsBySlug,
    hackathons,
    teams,
    submissions,
    leaderboards,
    refresh,
    setHackathons,
    setTeams,
    setSubmissions,
    setLeaderboards,
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) {
    throw new Error('useAppData must be used inside AppDataProvider')
  }
  return ctx
}
