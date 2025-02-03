import { asyncHandler } from "../utils/asyncHandler.js"
import { Product } from "../models/product.models.js"
import { Category } from "../models/category.models.js"
import { Unit } from "../models/unit.models.js"
import { ApiError } from "../utils/ApiError.js"
import ApiResponse from "../utils/ApiResponse.js"
import { handleUploadFile, deleteFileFromCloudinary } from "../utils/cloudinary.js";


const getAll = asyncHandler(async (req, res) => {
    const { featured, page = 1 } = req.body; // Get page and limit from query parameters
    
    let limit = 12

    let is_f = {};
    if (featured === 'true') { // Important: Check for the string "true"
        is_f = { is_featured: true };
        limit = 6;
    }

    const aggregate = Product.aggregate([ // Your aggregation pipeline
        {
            $match: {
                $and: [
                    { is_active: true },
                    { deletedAt: null },
                    is_f
                ],
            },
        },
        {
            $lookup: {
                from: "categories",
                localField: "cat_id",
                foreignField: "_id",
                as: "category",
            },
        },
        {
            $unwind: "$category",
        },
        {
            $lookup: {
                from: "units",
                localField: "unit_id",
                foreignField: "_id",
                as: "unit",
            },
        },
        {
            $unwind: "$unit",
        },
        {
            $addFields: {
                category_name: "$category.name",
                unit_name: "$unit.name",
            },
        },
        {
            $project: {
                unit: 0,
                category: 0,
                seller_id: 0,
                __v: 0,
                createdAt: 0,
                updatedAt: 0,
                deletedAt: 0,
                is_active: 0,
                is_featured: 0,
                unit_id: 0,
                qty: 0,
                cost: 0,
            },
        },
    ]);

    const options = {
        page: parseInt(page), // Parse page and limit to integers
        limit: parseInt(limit),
    };

    try {
        const result = await Product.aggregatePaginate(aggregate, options); // Use aggregatePaginate

        const newData = {
            totalDocs: result.totalDocs,
            limit: result.limit,
            page: result.page,
            totalPages: result.totalPages,
            pagingCounter: result.pagingCounter,
            hasPrevPage: result.hasPrevPage,
            hasNextPage: result.hasNextPage,
            prevPage: result.prevPage,
            nextPage: result.nextPage
        }

        res.status(200).json(
            new ApiResponse(200, {data: result.docs, newData}, "Products fetched successfully")
        );
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json(new ApiResponse(500, null, "Error fetching products"));
    }
});

const getAllAdmin = asyncHandler(async (req, res) => {
    const { featured,active, page = 1 } = req.body; // Get page and limit from query parameters
    
    let limit = 10

    let is_f = {};
    let is_a = {};
    if (featured === 'true') { // Important: Check for the string "true"
        is_f = { is_featured: true };
    }
    if (active === 'true') { // Important: Check for the string "true"
        is_a = { is_active: true };
    }

    const aggregate = Product.aggregate([ // Your aggregation pipeline
        {
            $match: {
                $and: [
                    { deletedAt: null },
                    is_f,
                    is_a
                ],
            },
        },
        {
            $lookup: {
                from: "categories",
                localField: "cat_id",
                foreignField: "_id",
                as: "category",
            },
        },
        {
            $unwind: "$category",
        },
        {
            $lookup: {
                from: "units",
                localField: "unit_id",
                foreignField: "_id",
                as: "unit",
            },
        },
        {
            $unwind: "$unit",
        },
        {
            $addFields: {
                category_name: "$category.name",
                unit_name: "$unit.name",
            },
        },
        {
            $project: {
                unit: 0,
                category: 0,
                seller_id: 0,
                __v: 0,
                createdAt: 0,
                updatedAt: 0,
                deletedAt: 0,
                unit_id: 0,
                qty: 0,
                cost: 0,
            },
        },
    ]);

    const options = {
        page: parseInt(page), // Parse page and limit to integers
        limit: parseInt(limit),
    };

    try {
        const result = await Product.aggregatePaginate(aggregate, options); // Use aggregatePaginate

        const newData = {
            totalDocs: result.totalDocs,
            limit: result.limit,
            page: result.page,
            totalPages: result.totalPages,
            pagingCounter: result.pagingCounter,
            hasPrevPage: result.hasPrevPage,
            hasNextPage: result.hasNextPage,
            prevPage: result.prevPage,
            nextPage: result.nextPage
        }

        res.status(200).json(
            new ApiResponse(200, {data: result.docs, newData}, "Products fetched successfully")
        );
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json(new ApiResponse(500, null, "Error fetching products"));
    }
});

const createProduct = asyncHandler ( async (req, res) => {
    const { name, cost, price, discount, discount_price, cat_id, unit_id, qty, description } = req.body;

    if([name, cost, price, discount_price, cat_id, unit_id, description].some(item => !item)){
        res.status(400);
        throw new ApiError(400, "All fields are required")
    }

    const { _id } = req.user;

    const oldProduct = await Product.findOne({$and: [{name}, {deletedAt: null}]});

    if(oldProduct){
        res.status(400);
        throw new ApiError(400, "Product already exists")
    }

    const category = await Category.findById(cat_id);
    const unit = await Unit.findById(unit_id);

    if( !category || !unit){
        res.status(404);
        throw new ApiError(404, "Category or Unit not found")
    }

    const images = req.files;

    if (!images || images.length === 0) {
        res.status(400);
        throw new ApiError(400, "Please upload at least one image");
    }

    const uploadedImages = [];

    try {
        for (const image of images) {
            const uploadedImage = await handleUploadFile(image.path);
            uploadedImages.push(uploadedImage.secure_url);
        }
    } catch (error) {
        console.error("Error uploading images:", error);
        for (const imageUrl of uploadedImages) {
            await deleteFileFromCloudinary(imageUrl); 
        }
        res.status(500)
        throw new ApiError(500, "Something went wrong");
    }
    
    const product = await Product.create({name, cost, price, discount, discount_price, cat_id, unit_id, seller_id: _id, qty, description, img: uploadedImages })

    if( !product){
        res.status(500);
        throw new ApiError(500)
    }

    res.status(200).json(
        new ApiResponse(200, product, "Product created successfully")
    )
})

const updateProduct = asyncHandler ( async (req, res) => {
    const {id, name, cost, price, discount, discount_price, cat_id, unit_id, qty, description } = req.body;

    if([id, name, cost, price, discount_price, cat_id, unit_id, description].some(item => !item)){
        res.status(400);
        throw new ApiError(400, "All fields are required")
    }

    const { _id } = req.user;

    const oldProduct = await Product.findById(id);

    if(!oldProduct || oldProduct.deletedAt){
        res.status(404);
        throw new ApiError(404, "Product not found")
    }

    const category = await Category.findById(cat_id);
    const unit = await Unit.findById(unit_id);

    if( !category || !unit){
        res.status(404);
        throw new ApiError(404, "Category or Unit not found")
    }

    const existingImg = oldProduct.img;
    const images = req.files;
    const uploadedImages = [];

    if (images || images.length >= 1) {
        try {
            for( const img of images){
                const upload = await handleUploadFile(img.path);
                uploadedImages.push(upload.url);
            }
        } catch (error) {
            for( const img of uploadedImages){
                await deleteFileFromCloudinary(img);
            }
            console.log(error);
            res.status(500);
            throw new ApiError(500, "Something went wrong")
        }
        const newImgArr = [...existingImg, ...uploadedImages];
        oldProduct.img = newImgArr;
    }


    oldProduct.name = name;
    oldProduct.cost = cost;
    oldProduct.price = price;
    oldProduct.discount = discount;
    oldProduct.discount_price = discount_price;
    oldProduct.cat_id = cat_id;
    oldProduct.unit_id = unit_id
    oldProduct.seller_id = _id;
    oldProduct.qty = qty;
    oldProduct.description = description;
    const updated = await oldProduct.save({validateBeforeSave: false});

    if( !updated){
        res.status(500);
        throw new ApiError(500)
    }

    res.status(200).json(
        new ApiResponse(200, updated, "Product updated successfully")
    )

})

const updateImg = asyncHandler ( async (req, res) => {
    const {id, url } = req.body;

    if(!id || !url){
        res.status(400);
        throw new ApiError(400, "All fields are required")
    }

    const oldProduct = await Product.findById(id);

    if(!oldProduct || oldProduct.deletedAt){
        res.status(404);
        throw new ApiError(404, "Product not found")
    }

    const indexImg = oldProduct.img.indexOf(url);
    if(indexImg < 0){
        res.status(404);
        throw new ApiError(404, "Image not found")
    }

    oldProduct.img.splice(indexImg, 1);
    const image = req.file;

    const upload = await handleUploadFile(image.path);
    if( !upload){
        res.status(500);
        throw new ApiError(500)
    }

    oldProduct.img.push(upload.url);
    const updated = await oldProduct.save({validateBeforeSave: false});

    if( !updated){
        res.status(500);
        throw new ApiError(500)
    }

    await deleteFileFromCloudinary(url);

    res.status(200).json(
        new ApiResponse(200, updated, "Image updated successfully")
    )

})

const deleteImg = asyncHandler ( async (req, res) => {
    const {id, url} = req.body;

    if( !id || !url){
        res.status(400);
        throw new ApiError(400, "All fields are required")
    }

    const product = await Product.findOne({$and: [{_id:id}, {deletedAt: null}]});

    if(!product){
        res.status(404);
        throw new ApiError(404, "Product not found")
    }

    if (product.img.length === 1) {
        res.status(400);
        throw new ApiError(400, "Cannot delete the last image of the product");
    }

    const index = product.img.indexOf(url);

    if(!index || index < 0){
        res.status(404);
        throw new ApiError(404, "Image not found")
    }
    
    product.img.splice(index, 1);
    const deleted = await product.save({validateBeforeSave: false});

    if(!deleted){
        res.status(500);
        throw new ApiError(500)
    }

    await deleteFileFromCloudinary(url);

    res.status(200).json(
        new ApiResponse(200, null, "Image deleted successfully")
    )

})

const deleteProduct = asyncHandler ( async (req, res) => {
    const {id} = req.body;

    if(!id){
        res.status(400);
        throw new ApiError(400, "All fields are required")
    }

    const oldProduct = await Product.findOne({$and: [{_id:id}, {deletedAt: null}]});

    if( !oldProduct){
        res.status(404);
        throw new ApiError(404, "Product not found")
    }

    oldProduct.deletedAt = Date.now();
    oldProduct.is_active = false;
    const deleted = await oldProduct.save({validateBeforeSave: false});

    if( !deleted){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }

    res.status(200).json(
        new ApiResponse(200, null, "Product deleted successfully")
    )
})

const activeProduct = asyncHandler ( async (req, res) => {
    const {id} = req.body;

    if(!id){
        res.status(400);
        throw new ApiError(400, "All fields are required")
    }

    const oldProduct = await Product.findOne({$and: [{_id:id}, {deletedAt: null}]});

    if( !oldProduct){
        res.status(404);
        throw new ApiError(404, "Product not found")
    }

    let status = true;
    let final = "Product activated successfully";
    if(oldProduct.is_active){
        status = false;
        final = "Product deactivated successfully";
    }

    oldProduct.is_active = status;
    const updated = await oldProduct.save({validateBeforeSave: false});

    if( !updated){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }   

    res.status(200).json(
        new ApiResponse(200, null, final)
    )
})

const featureProduct = asyncHandler ( async (req, res) => {
    const {id} = req.body;

    if(!id){
        res.status(400);
        throw new ApiError(400, "All fields are required")
    }

    const oldProduct = await Product.findOne({$and: [{_id:id}, {deletedAt: null}]});

    if(!oldProduct){
        res.status(404);
        throw new ApiError(404, "Product not found")
    }

    let status = true;
    let final = "Product is featured";
    if(oldProduct.is_featured){
        status = false;
        final = "Product is unfeatured";
    }

    oldProduct.is_featured = status;
    const updated = await oldProduct.save({validateBeforeSave: false});

    if( !updated){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }

    res.status(200).json(
        new ApiResponse(200, null, final)
    )
})

export { getAll, createProduct, updateProduct, deleteProduct, activeProduct, featureProduct, deleteImg, updateImg, getAllAdmin }