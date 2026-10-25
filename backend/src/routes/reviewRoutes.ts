import { Router } from 'express';
import { listReviews, submitReviews } from '../controllers/reviewController';
import { validateReviewSubmission } from '../middleware/validate';

// Mounted at /teams/:teamId/reviews
const router = Router({ mergeParams: true });

router.get('/', listReviews);
router.post('/', validateReviewSubmission, submitReviews);

export default router;
