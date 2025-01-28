import {asyncHandler} from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import {Category} from "../models/category.models.js"
import { handleUploadFile, deleteFileFromCloudinary } from "../utils/cloudinary.js";

const getAllCategory = asyncHandler( async (req, res) => {

    const category = await Category.find({deletedAt: null}).select( "-__v -createdAt -updatedAt -deletedAt");

    if(category < 1){
        return res.status(404).json(
            new ApiResponse(404, category, "Category not found")
        )
    }

    res.status(200).json(
        new ApiResponse(200, category, "Category fetched successfully")
    )

})

const createCategory = asyncHandler( async (req, res) => {
    const {name} = req.body;
    const img = req.file;


    if(!name || !img){
        res.status(400);
        throw new ApiError(400, "All fields are required")
    }

    const oldCategory = await Category.findOne({$and: [{name}, {deletedAt:null}]});

    if(oldCategory){
        res.status(400);
        throw new ApiError(400, "Category already exists")
    }

    const uploadedImg = await handleUploadFile(img?.path);

    if(!uploadedImg){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }

    const category = await Category.create({name, img:uploadedImg.url});

    if(!category){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }

    res.status(200).json(
        new ApiResponse(200, category, "Category created successfully")
    )

})

const deleteCategory = asyncHandler( async (req, res) => {
    const {id} = req.body;

    const category = await Category.findOne({$and: [{_id:id}, {deletedAt: null}]});

    if(!category){
        res.status(404);
        throw new ApiError(404, "Category not found")
    }

    category.deletedAt = Date.now();
    const deleted = await category.save({validateBeforeSave: false});

    if(!deleted){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }

    res.status(200).json(
        new ApiResponse(200, null, "Category deleted successfully")
    )

})

const updateCategory = asyncHandler( async (req, res) => {
    const {id, name} = req.body;
    const img = req.file;

    if(!id || !name){
        res.status(400);
        throw new ApiError(400, "All fields is required")
    }

    const oldCategory = await Category.findOne({$and: [{_id:id}, {deletedAt: null}]}).select( "-__v -createdAt -updatedAt -deletedAt");

    if(!oldCategory){
        res.status(404);
        throw new ApiError(404, "Category not found")
    }
    
    const oldImg = oldCategory.img;
    if( img ){

        const uploadedImg = await handleUploadFile(img?.path);
        if( !uploadedImg){
            res.status(500);
            throw new ApiError(500, "Something went wrong")
        }
        oldCategory.img = uploadedImg.url;
    }   
    
    oldCategory.name = name;
    await oldCategory.save({validateBeforeSave: false});

    if( img ){
        await deleteFileFromCloudinary(oldImg);
    }

    res.status(200).json(
        new ApiResponse(200, oldCategory, "Category updated successfully")
    )
    
})

export { getAllCategory, createCategory, deleteCategory, updateCategory }