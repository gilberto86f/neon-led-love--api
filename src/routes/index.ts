import { Router } from 'express';
import productRoutes from './product.routes';
import categoryRoutes from './category.routes';
import pricesRoutes from './prices.routes';

const router = Router();

router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/prices', pricesRoutes);

export default router;
