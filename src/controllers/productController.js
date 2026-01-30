import Product from '../models/Product.js';

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res) => {
    try {
        const { category, zodiacSign, minPrice, maxPrice, search, sort } = req.query;

        const filters = {};
        if (category) filters.category = category;
        if (zodiacSign) filters.zodiacSign = zodiacSign;
        if (minPrice) filters.minPrice = Number(minPrice);
        if (maxPrice) filters.maxPrice = Number(maxPrice);
        if (search) filters.search = search;
        if (sort) filters.sort = sort;

        const products = await Product.findAll(filters);

        res.json({
            success: true,
            count: products.length,
            data: products
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
export const getProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'מוצר לא נמצא'
            });
        }

        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Create product (Admin)
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req, res) => {
    try {
        const product = await Product.create(req.body);

        res.status(201).json({
            success: true,
            data: product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Update product (Admin)
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = async (req, res) => {
    try {
        const product = await Product.update(req.params.id, req.body);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'מוצר לא נמצא'
            });
        }

        res.json({
            success: true,
            data: product
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Delete product (Admin)
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = async (req, res) => {
    try {
        const success = await Product.delete(req.params.id);

        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'מוצר לא נמצא'
            });
        }

        res.json({
            success: true,
            message: 'מוצר נמחק בהצלחה'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Add review
// @route   POST /api/products/:id/reviews
// @access  Private
export const addReview = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'מוצר לא נמצא'
            });
        }

        // Check if user already reviewed
        const alreadyReviewed = product.reviews?.find(
            review => review.user === req.user.id
        );

        if (alreadyReviewed) {
            return res.status(400).json({
                success: false,
                message: 'כבר הוספת ביקורת למוצר זה'
            });
        }

        const review = {
            user: req.user.id,
            name: req.user.name,
            rating: Number(rating),
            comment
        };

        await Product.addReview(req.params.id, review);

        res.status(201).json({
            success: true,
            message: 'הביקורת נוספה בהצלחה'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
