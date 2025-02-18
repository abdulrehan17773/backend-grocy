import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import handleError from './middlewares/handleError.middleware.js';

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
import { unitRouter } from './routes/unit.routes.js';
import { catRouter } from './routes/category.routes.js';
import { productRouter } from './routes/product.routes.js'
import {orderRouter} from './routes/order.routes.js'
import { riderRouter } from './routes/rider.routes.js';


// define routes here
app.use("/api/v1/users", UserRouter);
app.use("/api/v1/address", addressRouter);
app.use("/api/v1/unit", unitRouter);
app.use("/api/v1/cat", catRouter);
app.use("/api/v1/pro", productRouter);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/rider", riderRouter);

app.use(handleError)

export { app };
