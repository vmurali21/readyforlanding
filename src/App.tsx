import React, { useState } from 'react';
import axios from 'axios';
import './App.css';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';

interface FlightInfo {
  destIcao: string;
  eta: Date;
}

interface TravelInfo {
  duration: string;
  durationValue: number;
  distance: string;
}

const App: React.FC = () => {
  const [flightNumber, setFlightNumber] = useState('');
  const [address, setAddress] = useState('');
  const [output, setOutput] = useState<string[]>([]);

  const getFlightInfo = async (flightNumber: string): Promise<FlightInfo | null> => {
    const config = {
      method: 'get',
      url: `https://fr24api.flightradar24.com/api/live/flight-positions/full?flights=${flightNumber}`,
      headers: {
        'Accept': 'application/json',
        'Accept-Version': 'v1',
        'Authorization': 'Bearer 9d4956f4-e80d-4739-8a5a-4268542b21bc|rJ1Zw91FB0gwPVQfwcUboZq4p99MpZARFAVvHpBhc1bb24f7'
      }
    };

    try {
      const response = await axios.request(config);
      const flightData = response.data.data[0];
      if (flightData && flightData.dest_icao && flightData.eta) {
        return {
          destIcao: String(flightData.dest_icao),
          eta: new Date(flightData.eta)
        };
      } else {
        throw new Error('Invalid flight data');
      }
    } catch (error) {
      console.error("Error fetching flight info: This flight likely isn't airborne right now", error);
      return null;
    }
  };

  const getHistoricFlightInfo = async (flightNumber: string): Promise<string | null> => {
    const currentTime = Math.floor(Date.now() / 1000);
    const twelveHoursAgo = currentTime - (12 * 60 * 60);
    
    const config = {
      method: 'get',
      url: `https://fr24api.flightradar24.com/api/historic/flight-positions/full?flights=${flightNumber}&timestamp=${twelveHoursAgo}`,
      headers: {
        'Accept': 'application/json',
        'Accept-Version': 'v1',
        'Authorization': 'Bearer 9d4956f4-e80d-4739-8a5a-4268542b21bc|rJ1Zw91FB0gwPVQfwcUboZq4p99MpZARFAVvHpBhc1bb24f7'
      }
    };

    try {
      const response = await axios.request(config);
      const flightData = response.data.data[0];
      if (flightData && flightData.dest_icao) {
        return String(flightData.dest_icao);
      } else {
        throw new Error('Invalid dest_icao in historic data');
      }
    } catch (error) {
      console.error('Error fetching historic flight info:', error);
      return null;
    }
  };

  const getAirportCoordinates = async (icaoCode: string): Promise<[number, number]> => {
    try {
      const response = await axios.get('/airportdataset.json');
      const airports = response.data;
      const airport = airports.find((row: any) => row.icao.toUpperCase() === icaoCode.toUpperCase());
      if (airport) {
        return [parseFloat(airport.latitude), parseFloat(airport.longitude)];
      } else {
        throw new Error('Airport not found');
      }
    } catch (error) {
      console.error('Error getting airport coordinates:', error);
      throw error;
    }
  };

  const getTravelTime = async (origin: string, destination: string): Promise<TravelInfo | null> => {
    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
        params: {
          origins: origin,
          destinations: destination,
          key: 'AIzaSyAFdVZeOyI04ntHEUqVsYqx7lRcXGLSsLg'
        }
      });

      const result = response.data.rows[0].elements[0];
      if (result.status === 'OK') {
        return {
          duration: result.duration.text,
          durationValue: result.duration.value,
          distance: result.distance.text
        };
      } else {
        throw new Error("Error fetching travel time");
      }
    } catch (error) {
      console.error('Error fetching travel time:', error);
      return null;
    }
  };

  const getFlightAndTravelInfo = async () => {
    setOutput([]);
    try {
      let flightInfo = await getFlightInfo(flightNumber);
      if (!flightInfo) {
        setOutput(prev => [...prev, 'Flight information not found in live data. Trying historic data...']);
        const destIcao = await getHistoricFlightInfo(flightNumber);
        if (destIcao) {
          flightInfo = { destIcao, eta: new Date() };
        }
      }
      
      if (flightInfo) {
        const coordinates = await getAirportCoordinates(flightInfo.destIcao);
        setOutput(prev => [...prev, `Coordinates for flight ${flightNumber} (Destination ICAO: ${flightInfo.destIcao}): ${coordinates}`]);
        
        const destination = `${coordinates[0]},${coordinates[1]}`;
        const travelInfo = await getTravelTime(address, destination);
        
        if (travelInfo) {
          setOutput(prev => [
            ...prev,
            `Travel time from your address to the airport: ${travelInfo.duration}`,
            `Distance: ${travelInfo.distance}`
          ]);

          const currentTime = new Date();
          const eta = flightInfo.eta;

          if (currentTime >= eta) {
            setOutput(prev => [...prev, "The flight has landed. You must go immediately."]);
          } else {
            const requiredDepartureTime = new Date(eta.getTime() - (travelInfo.durationValue * 1000));
            setOutput(prev => [...prev, `The eta is ${eta.toUTCString()} You should leave by: ${requiredDepartureTime.toUTCString()}`]);
          }
        } else {
          setOutput(prev => [...prev, 'Unable to calculate travel time.']);
        }
      } else {
        setOutput(prev => [...prev, "Failed to retrieve flight information. This flight likely isn't airborne."]);
      }
    } catch (error) {
      setOutput(prev => [...prev, `Error: ${error instanceof Error ? error.message : String(error)}`]);
    }
  };

  return (
    <div className="App">
      <h1>Flight and Travel Information</h1>
      <div className="input-container">
        <input
          type="text"
          value={flightNumber}
          onChange={(e) => setFlightNumber(e.target.value)}
          placeholder="Enter flight number"
        />
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter your address"
        />
        <button onClick={getFlightAndTravelInfo}>Get Information</button>
      </div>
      <div className="output-container">
        {output.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>
    </div>
  );
};

export default App;