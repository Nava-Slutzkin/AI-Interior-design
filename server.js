require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const renderRoutes = require('./routes/render.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/renders', renderRoutes);

app.get('/', (req, res) => {
  res.send('Server is running successfully!');
});
