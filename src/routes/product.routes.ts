import { Router } from 'express';
import { productController } from '../controllers/product.controller';

const router = Router();

router.get('/', productController.list);
router.get('/:slug', productController.getBySlug);
router.post('/', productController.create);
router.put('/:id', productController.update);
router.delete('/:id', productController.remove);

export default router;
