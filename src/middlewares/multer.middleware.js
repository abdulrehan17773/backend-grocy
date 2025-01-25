import multer from "multer";

// handle upload temperory file
const storage = multer.diskStorage(
    {
        // Destination to store image
        destination: (req, file, cb)=>{
            cb(null, "./public/temp");
        },
        // Set filename
        filename: (req, file, cb) => {
            cb(null, file.originalname);
        }
    }
)

export const upload = multer({ storage });