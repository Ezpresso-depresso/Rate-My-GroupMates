import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ReviewProvider } from './context/ReviewProvider';
import { AwardsPage } from './pages/AwardsPage';
import { RatePage } from './pages/RatePage';

export default function App() {
  return (
    <ReviewProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<RatePage />} />
            <Route path="awards" element={<AwardsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ReviewProvider>
  );
}
