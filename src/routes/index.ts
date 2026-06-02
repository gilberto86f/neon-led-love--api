import { Router } from 'express';
import productRoutes from './product.routes';
import categoryRoutes from './category.routes';
import pricesRoutes from './prices.routes';
import tagRoutes from './tag.routes';
import slideRoutes from './slide.routes';
import imageRoutes from './image.routes';
import userRoutes from './user.routes';
import orderRoutes from './order.routes';
import cartRoutes from './cart.routes';
import authRoutes from './auth.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/tags', tagRoutes);
router.use('/prices', pricesRoutes);
router.use('/slides', slideRoutes);
router.use('/images', imageRoutes);
router.use('/users', userRoutes);
router.use('/orders', orderRoutes);
router.use('/cart', cartRoutes);

export default router;
