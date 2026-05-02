import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { productCategoryController } from '../controllers/productCategory.controller';
import { productVariantController } from '../controllers/productVariant.controller';

const router = Router();

router.get('/', productController.list);
router.get('/:slug', productController.getBySlug);
router.post('/', productController.create);
router.put('/:id', productController.update);
router.delete('/:id', productController.remove);

router.post('/:productId/categories/:categoryId', productCategoryController.add);
router.delete('/:productId/categories/:categoryId', productCategoryController.remove);

router.get('/:productId/variants', productVariantController.list);
router.post('/:productId/variants', productVariantController.create);
router.put('/:productId/variants/:variantId', productVariantController.update);
router.delete('/:productId/variants/:variantId', productVariantController.remove);

export default router;
