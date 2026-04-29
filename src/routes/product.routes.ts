import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { productCategoryController } from '../controllers/productCategory.controller';

const router = Router();

router.get('/', productController.list);
router.get('/:slug', productController.getBySlug);
router.post('/', productController.create);
router.put('/:id', productController.update);
router.delete('/:id', productController.remove);

router.post('/:productId/categories/:categoryId', productCategoryController.add);
router.delete('/:productId/categories/:categoryId', productCategoryController.remove);

export default router;
