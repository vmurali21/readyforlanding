import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const AVIATION_API_KEY = '7500bfb2606f5b1c617898b7e5ec3f5e';
const GOOGLE_MAPS_API_KEY = 'AIzaSyAFdVZeOyI04ntHEUqVsYqx7lRcXGLSsLg';

interface FlightInfo {
  destination: string;
  destinationCode: string;
  arrivalTime: Date;
  historicalData: {
    totalFlights: number;
    delayPercentage: string;
    averageDelay: string;
  };
}

function App() {
  const [flightNumber, setFlightNumber] = useState('');
  const [address, setAddress] = useState('');
  const [bufferTime, setBufferTime] = useState('90');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = initAutocomplete;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const initAutocomplete = () => {
    if (inputRef.current) {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, { types: ['address'] });
    }
  };

  const getFlightInfo = async (flightNumber: string): Promise<FlightInfo> => {
    const currentDate = new Date().toISOString().split('T')[0];
    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const url = `http://api.aviationstack.com/v1/flights?access_key=${AVIATION_API_KEY}&flight_iata=${flightNumber}&date_from=${threeMonthsAgo}&date_to=${currentDate}`;

    try {
      const response = await axios.get(url);
      const flights = response.data.data;

      if (flights && flights.length > 0) {
        const latestFlight = flights[0];
        const historicalData = analyzeHistoricalData(flights);
        
        return {
          destination: latestFlight.arrival.airport,
          destinationCode: latestFlight.arrival.iata,
          arrivalTime: new Date(latestFlight.arrival.scheduled),
          historicalData: historicalData
        };
      } else {
        throw new Error('Flight not found or no information available.');
      }
    } catch (error) {
      throw new Error('Error fetching flight data: ' + (error as Error).message);
    }
  };

  const analyzeHistoricalData = (flights: any[]) => {
    let totalFlights = flights.length;
    let delayedFlights = 0;
    let totalDelayMinutes = 0;

    flights.forEach(flight => {
      if (flight.arrival.delay) {
        delayedFlights++;
        totalDelayMinutes += flight.arrival.delay;
      }
    });

    return {
      totalFlights: totalFlights,
      delayPercentage: (delayedFlights / totalFlights * 100).toFixed(2),
      averageDelay: (totalDelayMinutes / delayedFlights).toFixed(2)
    };
  };

  const getTravelTime = (origin: google.maps.LatLng, destination: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const service = new google.maps.DistanceMatrixService();
      service.getDistanceMatrix(
        {
          origins: [origin],
          destinations: [destination],
          travelMode: google.maps.TravelMode.DRIVING,
          unitSystem: google.maps.UnitSystem.METRIC,
        },
        (response, status) => {
          if (status === 'OK' && response) {
            resolve(response.rows[0].elements[0].duration.value);
          } else {
            reject('Error calculating travel time');
          }
        }
      );
    });
  };

  const planTravel = async () => {
    setIsLoading(true);
    setResult('Planning your travel...');

    try {
      if (!flightNumber || !autocompleteRef.current || !autocompleteRef.current.getPlace() || isNaN(parseInt(bufferTime)) || parseInt(bufferTime) < 0) {
        throw new Error('Please fill in all fields correctly.');
      }

      const selectedPlace = autocompleteRef.current.getPlace();
      if (!selectedPlace.geometry || !selectedPlace.geometry.location) {
        throw new Error('Please select a valid address from the dropdown.');
      }

      const flightInfo = await getFlightInfo(flightNumber);
      const travelTimeInSeconds = await getTravelTime(
        selectedPlace.geometry.location,
        `${flightInfo.destinationCode} Airport`
      );

      const currentTime = new Date();
      const travelTimeInMinutes = Math.ceil(travelTimeInSeconds / 60);

      let historyHtml = `
        <h3>Flight History (Last 3 Months)</h3>
        <p>Total Flights: ${flightInfo.historicalData.totalFlights}</p>
        <p>Percentage of Delayed Flights: ${flightInfo.historicalData.delayPercentage}%</p>
        <p>Average Delay: ${flightInfo.historicalData.averageDelay} minutes</p>
      `;

      if (currentTime >= flightInfo.arrivalTime) {
        setResult(`
          <p><strong>Alert:</strong> Flight ${flightNumber} has already landed at ${flightInfo.destination} (${flightInfo.destinationCode}).</p>
          <p>The flight was scheduled to arrive at ${flightInfo.arrivalTime.toLocaleString()}.</p>
          <p>Your address: ${selectedPlace.formatted_address}</p>
          <p>Estimated travel time to the airport: ${travelTimeInMinutes} minutes.</p>
          <p><strong>Recommendation:</strong> Leave immediately if you need to pick someone up from this flight.</p>
          ${historyHtml}
        `);
      } else {
        const departureTime = new Date(flightInfo.arrivalTime.getTime() - (travelTimeInMinutes + parseInt(bufferTime)) * 60000);
        setResult(`
          <p>Flight ${flightNumber} is scheduled to arrive at ${flightInfo.destination} (${flightInfo.destinationCode}) at ${flightInfo.arrivalTime.toLocaleString()}.</p>
          <p>Your address: ${selectedPlace.formatted_address}</p>
          <p>Estimated travel time from your address to the airport: ${travelTimeInMinutes} minutes.</p>
          <p>With your preferred buffer time of ${bufferTime} minutes, you should leave by ${departureTime.toLocaleString()}.</p>
          ${historyHtml}
        `);
      }
    } catch (error) {
      setResult(`Error: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Flight Travel Planner</h1>
      <div className="input-group">
        <label htmlFor="flightNumber">Flight Number:</label>
        <input
          id="flightNumber"
          type="text"
          value={flightNumber}
          onChange={(e) => setFlightNumber(e.target.value)}
          placeholder="e.g., AA123"
        />
      </div>
      <div className="input-group">
        <label htmlFor="address">Starting Address:</label>
        <input
          id="address"
          ref={inputRef}
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter your address"
        />
      </div>
      <div className="input-group">
        <label htmlFor="bufferTime">Buffer Time (minutes):</label>
        <input
          id="bufferTime"
          type="number"
          value={bufferTime}
          onChange={(e) => setBufferTime(e.target.value)}
          placeholder="e.g., 90"
          min="0"
        />
      </div>
      <button onClick={planTravel} disabled={isLoading}>
        {isLoading ? 'Planning...' : 'Plan My Travel'}
      </button>
      <div className="result" dangerouslySetInnerHTML={{ __html: result }} />
    </div>
  );
}

export default App;