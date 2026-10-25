import { useContext } from 'react';
import { ReviewContext } from '../context/reviewContext';

export function useReviews() {
  const ctx = useContext(ReviewContext);
  if (!ctx) throw new Error('useReviews must be used inside <ReviewProvider>');
  return ctx;
}
