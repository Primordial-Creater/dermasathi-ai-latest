import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppModeProvider } from "./context/AppModeContext";
import { AuthProvider } from "./context/AuthContext";
import { ClinicalProvider } from "./context/ClinicalContext";
import { ToastProvider } from "./context/ToastContext";
import { AppLayout } from "./layouts/AppLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import { LandingPage } from "./pages/LandingPage";
import { SkinAssessmentPage } from "./pages/SkinAssessmentPage";
import { SymptomsPage } from "./pages/SymptomsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { RemindersPage } from "./pages/RemindersPage";
import { VisitSummaryPage } from "./pages/VisitSummaryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LifestylePage } from "./pages/LifestylePage";
import { NearbyCarePage } from "./pages/NearbyCarePage";
import { HealthHistoryPage } from "./pages/HealthHistoryPage";
import { SignInPage } from "./pages/auth/SignInPage";
import { SignUpPage } from "./pages/auth/SignUpPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export const App: React.FC = () => {
  return (
    <AppModeProvider>
      <AuthProvider>
      <ClinicalProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AppLayout />}>
                <Route index element={<LandingPage />} />
                <Route path="skin-assessment" element={<SkinAssessmentPage />} />
                <Route path="symptoms" element={<SymptomsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="reminders" element={<RemindersPage />} />
                <Route path="visit-summary" element={<VisitSummaryPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="language-settings" element={<SettingsPage />} />
                <Route path="lifestyle" element={<LifestylePage />} />
                <Route path="nearby-care" element={<NearbyCarePage />} />
                <Route path="health-history" element={<HealthHistoryPage />} />
              </Route>
              <Route element={<AuthLayout />}>
                <Route path="login" element={<SignInPage />} />
                <Route path="signup" element={<SignUpPage />} />
                <Route path="forgot-password" element={<ForgotPasswordPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ClinicalProvider>
      </AuthProvider>
    </AppModeProvider>
  );
};

export default App;
