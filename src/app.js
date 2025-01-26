import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

// create express app
const app = express();

// define cors middleware here
app.use(cors({
    origin: [process.env.CLIENT_URL],  // Ensure CLIENT_URL is correctly set in your environment variables
    credentials: true  // This ensures cookies can be sent with cross-origin requests
}));

// define json middleware here
app.use(express.json({ limit: '50mb' }));  // This is good for handling large JSON payloads

// define urlencoded middleware here
app.use(express.urlencoded({ extended: true, limit: '50mb' }));  // To handle form submissions

// define static middleware here
app.use(express.static('public'));  // This serves static files from the "public" directory

// define cookie parser middleware here
app.use(cookieParser());  // This parses cookies for access to req.cookies

// import routes here
import { UserRouter } from './routes/user.routes.js';
import { addressRouter } from './routes/userAddress.routes.js';

// define routes here
app.use("/api/v1/users", UserRouter);
app.use("/api/v1/address", addressRouter);

export { app };
