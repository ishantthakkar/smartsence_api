require('dotenv').config();

const express = require('express');

const bodyParser = require('body-parser');

const connectDB = require('./config/db');

const wecomRoutes = require('./routes/wecomRoutes');
const messageRoutes = require('./routes/messageRoutes');
const billRoutes = require('./routes/billRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const productRoutes = require('./routes/productRoutes');
const inquiryRoutes = require('./routes/inquiryRoutes');

const app = express();

// Connect MongoDB
connectDB();

// JSON
app.use(express.json());

// XML
app.use(bodyParser.text({
    type: '*/xml'
}));

// Routes
app.use('/api/wecom', wecomRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/catalogs', catalogRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inquiries', inquiryRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(`Server running on ${PORT}`);
});