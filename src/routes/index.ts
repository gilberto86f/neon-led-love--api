import { Router } from 'express';
import productRoutes from './product.routes';
import categoryRoutes from './category.routes';
import pricesRoutes from './prices.routes';
import tagRoutes from './tag.routes';
import slideRoutes from './slide.routes';
import imageRoutes from './image.routes';
import userRoutes from './user.routes';
import orderRoutes from './order.routes';

const router = Router();

router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/tags', tagRoutes);
router.use('/prices', pricesRoutes);
router.use('/slides', slideRoutes);
router.use('/images', imageRoutes);
router.use('/users', userRoutes);
router.use('/orders', orderRoutes);

export default router;
