import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/ProtectedRoute';
import { AppShell } from '@/layouts/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { MatchesPage } from '@/pages/MatchesPage';
import { MatchCreatePage } from '@/pages/MatchCreatePage';
import { MatchEditPage } from '@/pages/MatchEditPage';
import { MatchDetailPage } from '@/pages/MatchDetailPage';
import { LiveScoringPage } from '@/pages/LiveScoringPage';
import { ScorecardPage } from '@/pages/ScorecardPage';
import { PublicLivePage, PublicScorecardPage } from '@/pages/PublicLivePage';
import { TeamsPage } from '@/pages/TeamsPage';
import { TeamFormPage } from '@/pages/TeamFormPage';
import { TeamDetailPage } from '@/pages/TeamDetailPage';
import { PlayersPage } from '@/pages/PlayersPage';
import { PlayerFormPage } from '@/pages/PlayerFormPage';
import { PlayerProfilePage } from '@/pages/PlayerProfilePage';
import { StatisticsPage } from '@/pages/StatisticsPage';
import { LiveMatchesPage } from '@/pages/LiveMatchesPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ProfilePage } from '@/pages/ProfilePage';

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnlyRoute>
              <ForgotPasswordPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicOnlyRoute>
              <ResetPasswordPage />
            </PublicOnlyRoute>
          }
        />

        <Route path="/live/:publicMatchId/scorecard" element={<PublicScorecardPage />} />
        <Route path="/live/:publicMatchId" element={<PublicLivePage />} />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/matches/create" element={<MatchCreatePage />} />
          <Route path="/matches/:id" element={<MatchDetailPage />} />
          <Route path="/matches/:id/edit" element={<MatchEditPage />} />
          <Route path="/matches/:id/live" element={<LiveScoringPage />} />
          <Route path="/matches/:id/scorecard" element={<ScorecardPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/new" element={<TeamFormPage mode="create" />} />
          <Route path="/teams/:id" element={<TeamDetailPage />} />
          <Route path="/teams/:id/edit" element={<TeamFormPage mode="edit" />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/players/new" element={<PlayerFormPage mode="create" />} />
          <Route path="/players/:id" element={<PlayerProfilePage />} />
          <Route path="/players/:id/edit" element={<PlayerFormPage mode="edit" />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/live" element={<LiveMatchesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
