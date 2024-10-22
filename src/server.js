// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// FlightRadar24 proxy endpoint
app.get('/api/flight/:type', async (req, res) => {
  const { type } = req.params;
  const { flightNumber, timestamp } = req.query;
  
  try {
    const baseUrl = 'https://fr24api.flightradar24.com/api';
    const endpoint = type === 'live' 
      ? `${baseUrl}/live/flight-positions/full?flights=${flightNumber}`
      : `${baseUrl}/historic/flight-positions/full?flights=${flightNumber}&timestamp=${timestamp}`;

    const response = await axios.get(endpoint, {
      headers: {
        'Accept': 'application/json',
        'Accept-Version': 'v1',
        'Authorization': `Bearer ${process.env.FR24_TOKEN}`
      }
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Google Distance Matrix proxy endpoint
app.get('/api/distance', async (req, res) => {
  const { origin, destination } = req.query;
  
  try {
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/distancematrix/json`,
      {
        params: {
          origins: origin,
          destinations: destination,
          key: process.env.GOOGLE_MAPS_API_KEY
        }
      }
    );
    
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});