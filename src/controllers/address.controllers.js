import { asyncHandler } from "../utils/asyncHandler.js"
import { Useraddress } from "../models/userAddress.model.js"
import { City } from "../models/city.models.js"
import { SubCity } from "../models/subCity.models.js"
import { ApiError } from "../utils/ApiError.js"
import ApiResponse from "../utils/ApiResponse.js"


const getCity = asyncHandler( async (req, res) => {
        const city = await City.find({is_active: true}).select("-__v -is_active -createdAt -updatedAt -deletedAt");
        if(!city){
            res.status(404);
            throw new ApiError(404, "City not found")
        }

        res.status(200).json(
            new ApiResponse(200, city, "Cities fetched successfully")
        )
})

const getSubCity = asyncHandler( async (req, res) => {
    const {city_id} = req.body;
    const city = await SubCity.find({$and: [{city_id}, {is_active: true}]}).select("-__v -city_id -is_active -createdAt -updatedAt -deletedAt");
    if(!city){
        return res.status(200).json(
            new ApiResponse(200, city, "Sub Cities fetched successfully")
        )
    }

    res.status(200).json(
        new ApiResponse(200, city, "Sub Cities fetched successfully")
    )
})

const createUserAddress = asyncHandler( async (req, res) => {
    const {uid} = req.user;
    const {city_id, subCity_id, address} = req.body;

    if( !subCity_id || !address){
        res.status(400);
        throw new ApiError(400, "All fields are required")
    }

    const oldAddress = await Useraddress.find({ $and: [ {user_id:uid} , {deletedAt: null}]});
    if(oldAddress.length >= 3){
        res.status(400);
        throw new ApiError(400, "Address limit reached!")
    }

    const city = await City.findById(city_id);
    const subCity = await SubCity.findById(subCity_id);

    if( !city || !subCity){
        res.status(404);
        throw new ApiError(404)
    }

    if(!city.is_active || !subCity.is_active){
        res.status(400);
        throw new ApiError(400, "we're currently closed in this area");
    }

    const newAddress = await Useraddress.create({user_id:uid, subcity_id:subCity_id, address})
    
    if(!newAddress){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }

    res.status(200).json(
        new ApiResponse(200, newAddress, "Address saved successfully")
    )

})

const getAllUserAddress = asyncHandler( async (req, res) => {
    const {uid} = req.user;

    const address = await Useraddress.aggregate([
        {
          $match: {
            user_id: uid,
            deletedAt: null
          }
        },
        {
          $lookup: {
            from: "subcities",
            localField: "subcity_id",
            foreignField: "_id",
            as: "subcity"
          }
        },
        {
          $unwind: "$subcity"
        },
        {
          $lookup: {
            from: "cities",
            localField: "subcity.city_id",
            foreignField: "_id",
            as: "city"
          }
        },
        {
          $unwind: "$city"
        },
        {
          $addFields: {
            subcity: {
              _id: "$subcity._id",
              name: "$subcity.name",
              // Add other subcity fields here
            },
            city: {
              _id: "$city._id",
              name: "$city.name",
              // Add other city fields here
            },
            status: {
              $cond: [{ $and: ["$subcity.is_active", "$city.is_active"] }, true, false]
            }
          }
        },
        {
          $project: {
            _id: 1,
            address: 1,
            "subcity._id": 1, 
            "subcity.name": 1, 
            "city._id": 1, 
            "city.name": 1, 
            "status": 1 
          }
        }
      ]);

    if( !address){
        return res.status(200).json(
            new ApiResponse(200, address, "Address not found")
        )
    }
    
    res.status(200).json(
        new ApiResponse(200, address, "Address fetched successfully")
    )
})

const deleteUserAddress = asyncHandler( async (req, res) => {
    const {uid} = req.user;
    const {id} = req.body;

    if( !id){
        res.status(400);
        throw new ApiError(400, "All fields are required")
    }

    const address = await Useraddress.findOne({$and: [{_id:id}, {user_id:uid}, {deletedAt: null}]});

    if(!address){
        res.status(404);
        throw new ApiError(404, "Address not found")
    }

    address.deletedAt = Date.now();
    const deleted = await address.save({validateBeforeSave: false});

    if(!deleted){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }

    res.status(200).json(
        new ApiResponse(200, null, "Address deleted successfully")
    )

})

const updateUserAddress = asyncHandler( async (req, res) => {
    const {uid} = req.user;
    const {id, address} = req.body;

    const oldAddress = await Useraddress.findOne({$and: [{_id:id}, {user_id:uid}, {deletedAt: null}]});

    if(!oldAddress){
        res.status(404);
        throw new ApiError(404, "Address not found")
    }

    oldAddress.address = address;
    const updated = await oldAddress.save({validateBeforeSave: false});

    if(!updated){
        res.status(500);
        throw new ApiError(500, "Something went wrong")
    }
    
    res.status(200).json(
        new ApiResponse(200, updated, "Address updated successfully")
    )

})

export { createUserAddress, getCity, getSubCity, getAllUserAddress, deleteUserAddress, updateUserAddress }
