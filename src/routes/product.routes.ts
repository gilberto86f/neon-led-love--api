import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { productCategoryController } from '../controllers/productCategory.controller';
import { productVariantController } from '../controllers/productVariant.controller';
import { productColorOptionController } from '../controllers/productColorOption.controller';
import { productTagController } from '../controllers/productTag.controller';
import { authorize } from '../middlewares/authGuard';

const router = Router();

// Reads are public (storefront); all writes require super/admin.
const staff = authorize('super', 'admin');

router.get('/', productController.list);
router.get('/related', productController.getRelated);
router.get('/:productId/related', productController.getRelated);
router.get('/:slug', productController.getBySlug);
router.post('/', staff, productController.create);
router.put('/:id', staff, productController.update);
router.delete('/:id', staff, productController.remove);

router.post('/:productId/categories/:categoryId', staff, productCategoryController.add);
router.delete('/:productId/categories/:categoryId', staff, productCategoryController.remove);

router.get('/:productId/variants', productVariantController.list);
router.post('/:productId/variants', staff, productVariantController.create);
router.put('/:productId/variants/:variantId', staff, productVariantController.update);
router.delete('/:productId/variants/:variantId', staff, productVariantController.remove);

router.get('/:productId/color-options', productColorOptionController.list);
router.post('/:productId/color-options', staff, productColorOptionController.create);
router.put('/:productId/color-options/:optionId', staff, productColorOptionController.update);
router.delete('/:productId/color-options/:optionId', staff, productColorOptionController.remove);

router.get('/:productId/tags', productTagController.list);
router.post('/:productId/tags/:tagId', staff, productTagController.add);
router.delete('/:productId/tags/:tagId', staff, productTagController.remove);

export default router;
