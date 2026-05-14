import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { productCategoryController } from '../controllers/productCategory.controller';
import { productVariantController } from '../controllers/productVariant.controller';
import { productColorOptionController } from '../controllers/productColorOption.controller';
import { productTagController } from '../controllers/productTag.controller';

const router = Router();

router.get('/', productController.list);
router.get('/related', productController.getRelated);
router.get('/:productId/related', productController.getRelated);
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

router.get('/:productId/color-options', productColorOptionController.list);
router.post('/:productId/color-options', productColorOptionController.create);
router.put('/:productId/color-options/:optionId', productColorOptionController.update);
router.delete('/:productId/color-options/:optionId', productColorOptionController.remove);

router.get('/:productId/tags', productTagController.list);
router.post('/:productId/tags/:tagId', productTagController.add);
router.delete('/:productId/tags/:tagId', productTagController.remove);

export default router;
