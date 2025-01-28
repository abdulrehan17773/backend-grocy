import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Unit } from "../models/unit.models.js";
import ApiResponse from "../utils/ApiResponse.js";

const getAllUnit = asyncHandler( async (req, res) => {
    
    const units = await Unit.find({deletedAt: null}).select( "-__v -createdAt -updatedAt -deletedAt");

    if(units < 1){
        return res.status(404).json(
            new ApiResponse(404, units, "Units not found")
        )
    }

    res.status(200).json(
        new ApiResponse(200, units, "Units fetched successfully")
    )
})

const createUnit = asyncHandler( async (req, res) => {
    
    const {name} = req.body;

    if(!name){
        res.status(400);
        throw new ApiError(400, "name is required")
    }

    const oldUnit = await Unit.findOne({$and: [{name}, {deletedAt:null}]});

    if(oldUnit){
        res.status(400);
        throw new ApiError(400, "Unit already exists")
    }

    const unit = await Unit.create({name});

    if(!unit){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }

    res.status(200).json(
        new ApiResponse(200, unit, "Unit created successfully")
    )
})

const delUnit = asyncHandler( async (req, res) => {

    const {id} = req.body;

    if(!id){
        res.status(400);
        throw new ApiError(400, "id is required")
    }

    const unit = await Unit.findOne({$and: [{_id:id}, {deletedAt: null}]});

    if(!unit){
        res.status(404);
        throw new ApiError(404, "Unit not found")
    }

    unit.deletedAt = Date.now();
    const deleted = await unit.save({validateBeforeSave: false});

    if(!deleted){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }

    res.status(200).json(
        new ApiResponse(200, null, "Unit deleted successfully")
    )

})

const updateUnit = asyncHandler( async (req, res) => {

    const {id, name} = req.body;

    if(!id || !name){
        res.status(400);
        throw new ApiError(400, "All fields is required")
    }

    const unit = await Unit.findOne({$and: [{_id:id}, {deletedAt: null}]}).select( "-__v -createdAt -updatedAt -deletedAt");

    if(!unit){
        res.status(404);
        throw new ApiError(404, "Unit not found")
    }

    if(unit.name == name){
        res.status(400);
        throw new ApiError(400, "Please enter different name")
    }

    unit.name = name;
    const deleted = await unit.save({validateBeforeSave: false});

    if(!deleted){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }

    res.status(200).json(
        new ApiResponse(200, unit, "Unit deleted successfully")
    )

})

export { getAllUnit, createUnit, delUnit, updateUnit }