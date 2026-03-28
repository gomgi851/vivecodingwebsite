export type HackathonStatus = 'upcoming' | 'ongoing' | 'ended' | string

export interface Hackathon {
  slug: string
  title: string
  status: HackathonStatus
  tags?: string[]
  thumbnailUrl?: string
  period?: {
    timezone?: string
    startAt?: string
    submissionDeadlineAt?: string
    endAt?: string
  }
  links?: {
    detail?: string
    rules?: string
    faq?: string
  }
}

export interface Team {
  teamCode: string
  hackathonSlug: string
  name: string
  isOpen: boolean
  currentMemberCount: number
  totalMemberCount: number
  memberCount?: number
  lookingFor?: string[]
  intro: string
  contact?: {
    type?: string
    url?: string
  }
  ownerId?: string
  createdAt?: string
  updatedAt?: string
}

export interface DirectMessage {
  id: string
  senderId: string
  recipientId: string
  content: string
  createdAt: string
  readAt?: string
  teamCode?: string
  teamName?: string
  hackathonSlug?: string
}

export interface Submission {
  id: string
  hackathonSlug: string
  teamName: string
  planTitle: string
  webUrl: string
  pdfUrl: string
  notes: string
  status: 'draft' | 'submitted'
  submittedAt: string
  scoreBreakdown?: {
    participant: number
    judge: number
  }
}

export interface LeaderboardEntry {
  rank?: number
  teamName: string
  score: number
  submittedAt: string
  scoreBreakdown?: {
    participant: number
    judge: number
  }
  artifacts?: {
    webUrl?: string
    pdfUrl?: string
    planTitle?: string
  }
}

export interface Leaderboard {
  hackathonSlug: string
  updatedAt?: string
  entries: LeaderboardEntry[]
}

export interface HackathonSectionOverview {
  summary?: string
  teamPolicy?: {
    allowSolo?: boolean
    maxTeamSize?: number
  }
}

export interface HackathonDetail {
  slug: string
  title?: string
  sections?: {
    overview?: HackathonSectionOverview
    info?: {
      notice?: string[]
      links?: {
        rules?: string
        faq?: string
      }
    }
    eval?: {
      metricName?: string
      description?: string
      scoreDisplay?: {
        label?: string
        breakdown?: Array<{
          key: string
          label: string
          weightPercent: number
        }>
      }
    }
    schedule?: {
      timezone?: string
      milestones?: Array<{
        name: string
        at: string
      }>
    }
    prize?: {
      items?: Array<{
        place: string
        amountKRW?: number
      }>
    }
    teams?: {
      campEnabled?: boolean
      listUrl?: string
    }
    submit?: {
      allowedArtifactTypes?: string[]
      submissionUrl?: string
      guide?: string[]
      submissionItems?: Array<{
        key: string
        title: string
        format: string
      }>
    }
    leaderboard?: {
      publicLeaderboardUrl?: string
      note?: string
    }
  }
}
