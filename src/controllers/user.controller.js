import { asyncHandler } from "../utlis/asyncHandler.js";
import {ApiError} from "../utlis/ApiError.js";
import {User} from "../models/user.models.js";
import {uploadOnCloudinary} from "../utlis/cloudinary.js";
import { ApiResponse } from "../utlis/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async(userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave : false});

        return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500, "Error generating tokens")
    }
} 

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

const loginUser = asyncHandler(async (req,res)=>{
    //req body -> data
    //username or email
    //find the user 
    //password check
    //accessToken and refreshToken
    //send secure cookies

    const {email, username, password} = req.body;

    if(!(username || email)){
        throw new ApiError(400, "Username or email is required")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User not found")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid credentials")
    }
    
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken , options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200,{
            user : loggedInUser,accessToken, refreshToken
        }, "User logged in successfully")
    )


})

const logoutUser = asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id, 
        {
            $set:{
                refreshToken :undefined
            }
        },{
            new : true
        }
    )
    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, {}, "User logged out successfully")
    )

    

})

const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized Request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user= await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(404, "Invalid refresh token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh Token is expired or used")
        }
        
        const options = {
            httpOnly : true,
            secure : true
        }
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken , options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(200,{
                accessToken, refreshToken :newRefreshToken
            },"Access Token refreshed successfully")
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}