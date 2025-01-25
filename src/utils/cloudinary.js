import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();


// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUD_NAME, 
    api_key: process.env.CLOUD_API_KEY, 
    api_secret: process.env.CLOUD_API_SECRET 
});
  
//a function to handle Upload file to cloudinary
const handleUploadFile = async (filePath) => {
    try {

        // Check if file exists
        if (!filePath) return null;

        // upload file to cloudinary
        const response = await cloudinary.uploader.upload(filePath, {
            resource_type: 'auto',
        })

        // Delete file from local storage
        fs.unlinkSync(filePath);

        return response;

    } catch (error) {
        // Delete file from local storage
        fs.unlinkSync(filePath);

        // console.log("file upload error", error);
        return null;   

    } 
}

const deleteFileFromCloudinary = async (publicId) => {
    
    try {
        const publicUrl = publicId.split('/').pop().split('.')[0];
        // Delete the previous avatar from Cloudinary
        await cloudinary.uploader.destroy(publicUrl);
        return true;
    } catch (err) {
        return false;
    }
}


export {handleUploadFile, deleteFileFromCloudinary}




