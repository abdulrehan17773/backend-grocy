import connectDb from './db/db.js';
import dotenv from 'dotenv';
import { app } from './app.js';



dotenv.config({
    path: '.env'
});

const PORT = process.env.PORT || 5000;

connectDb()
.then( () => {

    // handle connection errors
    app.on('error', (err) => {
        console.error(err);
        throw err;
    });

    app.listen(PORT, () => {
        console.log(`Server is running on port http://127.0.0.1:${PORT}`);
    });
})
.catch((err) => console.log("connection failed",err));