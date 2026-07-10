import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import TrainerPage from '@/pages/TrainerPage';
import TrainerDetailPage from '@/pages/TrainerDetailPage';
import KurseinheitenPage from '@/pages/KurseinheitenPage';
import KurseinheitenDetailPage from '@/pages/KurseinheitenDetailPage';
import PublicFormTrainer from '@/pages/public/PublicForm_Trainer';
import PublicFormKurseinheiten from '@/pages/public/PublicForm_Kurseinheiten';
// <public:imports>
// </public:imports>
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/6a509f73416a75cf1f7d44e6" element={<PublicFormTrainer />} />
              <Route path="public/6a509f750863413a12d7681c" element={<PublicFormKurseinheiten />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="trainer" element={<TrainerPage />} />
                <Route path="trainer/:id" element={<TrainerDetailPage />} />
                <Route path="kurseinheiten" element={<KurseinheitenPage />} />
                <Route path="kurseinheiten/:id" element={<KurseinheitenDetailPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
