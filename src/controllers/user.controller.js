import { asyncHandler } from "../utlis/asyncHandler.js";
import {ApiError} from "../utlis/ApiError.js";
import {User} from "../models/user.models.js";
import {uploadOnCloudinary} from "../utlis/cloudinary.js";
import { ApiResponse } from "../utlis/ApiResponse.js";

const registerUser = asyncHandler(async (req, res)=>{
    //get user details from frontend
    //validation - if empty
    //check if user already exists - email or username
    //check for images, check for avatar
    //upload them to cloudinary ,avatar
    //create user object - create entry in db
    //remove password and refresh token from the response
    //check for user creation
    //return response

    const {fullName, email, password, username} = req.body;
    console.log('Email :' , email);

    // if(fullName === ""){
    //     throw new ApiError(400, "fullName is required")
    // }

    if(
        [fullName, email, password, username].some((field) => field?.trim() === "") //new logic
    ){
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or : [{ email }, { username }]
    })

    if(existedUser){
        throw new ApiError(409, "User already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImageLocalPath.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(500, "Error uploading avatar")
    }

    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "", //coverimage hai ki nhi uske liye use kiya hai 
        email,
        password,
        username : username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500, "Error creating user")
    }

    return res.status(201).json(
        new ApiResponse(200, "User registered successfully", createdUser)
    )

    
})

export {registerUser}