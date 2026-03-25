import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { CampPage } from './pages/CampPage'
import { HackathonDetailPage } from './pages/HackathonDetailPage'
import { HackathonsPage } from './pages/HackathonsPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { RankingsPage } from './pages/RankingsPage'
import { AppDataProvider } from './store/AppDataContext'

function App() {
  return (
    <AppDataProvider>
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
    </AppDataProvider>
  )
}

export default App
