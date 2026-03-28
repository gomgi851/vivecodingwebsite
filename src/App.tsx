import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AppDataProvider } from './store/AppDataContext'

const HomePage = lazy(() => import('./pages/HomePage').then((mod) => ({ default: mod.HomePage })))
const HackathonsPage = lazy(() =>
  import('./pages/HackathonsPage').then((mod) => ({ default: mod.HackathonsPage })),
)
const HackathonDetailPage = lazy(() =>
  import('./pages/HackathonDetailPage').then((mod) => ({ default: mod.HackathonDetailPage })),
)
const CampPage = lazy(() => import('./pages/CampPage').then((mod) => ({ default: mod.CampPage })))
const RankingsPage = lazy(() =>
  import('./pages/RankingsPage').then((mod) => ({ default: mod.RankingsPage })),
)
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage').then((mod) => ({ default: mod.NotFoundPage })),
)

function App() {
  return (
    <AppDataProvider>
      <Suspense fallback={<div className="panel">페이지를 불러오는 중입니다...</div>}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/hackathons" element={<HackathonsPage />} />
            <Route path="/hackathons/:slug" element={<HackathonDetailPage />} />
            <Route path="/camp" element={<CampPage />} />
            <Route path="/rankings" element={<RankingsPage />} />
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </AppDataProvider>
  )
}

export default App
