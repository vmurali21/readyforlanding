import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import './App.css';


interface FlightInfo {
  destIcao: string;
  eta: Date;
}

interface TravelInfo {
  duration: string;
  durationValue: number;
  distance: string;
}

const API_KEY = 'AIzaSyAFdVZeOyI04ntHEUqVsYqx7lRcXGLSsLg';
const FR24_TOKEN = '9d4956f4-e80d-4739-8a5a-4268542b21bc|rJ1Zw91FB0gwPVQfwcUboZq4p99MpZARFAVvHpBhc1bb24f7';

const App: React.FC = () => {
  const [flightNumber, setFlightNumber] = useState('');
  const [address, setAddress] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral | null>(null);

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: API_KEY,
    libraries: ['places']
  });

  useEffect(() => {
    if (isLoaded) {
      const input = document.getElementById('address-input') as HTMLInputElement;
      autocompleteRef.current = new window.google.maps.places.Autocomplete(input, {
        types: ['address'],
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (place && place.formatted_address) {
          setAddress(place.formatted_address);
        }
      });
    }
  }, [isLoaded]);

  

  const fetchData = async (url: string, headers = {}) => {
    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      console.error(`Error fetching data from ${url}:`, error);
      return null;
    }
  };

  const getFlightInfo = async (flightNumber: string): Promise<FlightInfo | null> => {
    const url = `https://fr24api.flightradar24.com/api/live/flight-positions/full?flights=${flightNumber}`;
    const headers = {
      'Accept': 'application/json',
      'Accept-Version': 'v1',
      'Authorization': `Bearer ${FR24_TOKEN}`
    };
    const data = await fetchData(url, headers);
    if (data && data.data[0] && data.data[0].dest_icao && data.data[0].eta) {
      return {
        destIcao: String(data.data[0].dest_icao),
        eta: new Date(data.data[0].eta)
      };
    }
    return null;
  };

  const getHistoricFlightInfo = async (flightNumber: string): Promise<string | null> => {
    const twelveHoursAgo = Math.floor(Date.now() / 1000) - (12 * 60 * 60);
    const url = `https://fr24api.flightradar24.com/api/historic/flight-positions/full?flights=${flightNumber}&timestamp=${twelveHoursAgo}`;
    const headers = {
      'Accept': 'application/json',
      'Accept-Version': 'v1',
      'Authorization': `Bearer ${FR24_TOKEN}`
    };
    const data = await fetchData(url, headers);
    return data && data.data[0] && data.data[0].dest_icao ? String(data.data[0].dest_icao) : null;
  };

  const getAirportCoordinates = async (icaoCode: string): Promise<[number, number] | null> => {
    const data = await fetchData('/airportdataset.json');
    const airport = data?.find((row: any) => row.icao.toUpperCase() === icaoCode.toUpperCase());
    return airport ? [parseFloat(airport.latitude), parseFloat(airport.longitude)] : null;
  };

  const getTravelTime = async (origin: string, destination: string): Promise<TravelInfo | null> => {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${API_KEY}`;
    const data = await fetchData(url);
    const result = data?.rows[0]?.elements[0];
    return result?.status === 'OK' ? {
      duration: result.duration.text,
      durationValue: result.duration.value,
      distance: result.distance.text
    } : null;
  };

  useEffect(() => {
    if (window.google && window.google.maps) {
      const autocomplete = new window.google.maps.places.Autocomplete(
        document.getElementById('address-input') as HTMLInputElement,
        { types: ['address'] }
      );

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.formatted_address) {
          setAddress(place.formatted_address);
        }
      });

      autocompleteRef.current = autocomplete;
    }
  }, []);

  const getFlightAndTravelInfo = async () => {
    setOutput([]);
    try {
      let flightInfo = await getFlightInfo(flightNumber);
      if (!flightInfo) {
        setOutput(prev => [...prev, 'Flight information not found in live data. Trying historic data...']);
        const destIcao = await getHistoricFlightInfo(flightNumber);
        if (destIcao) flightInfo = { destIcao, eta: new Date() };
      }
      
      if (flightInfo) {
        const coordinates = await getAirportCoordinates(flightInfo.destIcao);
        if (coordinates) {
          const roundedCoordinates = coordinates.map(coord => Number(coord.toFixed(3)));
          setMapCenter({ lat: roundedCoordinates[0], lng: roundedCoordinates[1] });
          setOutput(prev => [...prev, `Coordinates for flight ${flightNumber} (Destination ICAO: ${flightInfo.destIcao}): ${roundedCoordinates}`]);
          
          const destination = roundedCoordinates.join(',');
          const travelInfo = await getTravelTime(address, destination);
          
          
          if (travelInfo) {
            const currentTime = new Date();
            const eta = flightInfo.eta;
            const requiredDepartureTime = new Date(eta.getTime() - (travelInfo.durationValue * 1000));

            setOutput(prev => [
              ...prev,
              `Flight ETA: ${eta.toLocaleString()}`,
              `Travel time to airport: ${travelInfo.duration}`,
              `Distance to airport: ${travelInfo.distance}`,
              `Recommended departure time: ${requiredDepartureTime.toLocaleString()}`
            ]);

            if (currentTime >= eta) {
              setOutput(prev => [...prev, "The flight has already landed. If you haven't left yet, you should go immediately."]);
            } else if (requiredDepartureTime <= currentTime) {
              setOutput(prev => [
                ...prev,
                "You should leave as soon as possible to try get there on time!",
                `The plane is scheduled to land in ${((eta.getTime() - currentTime.getTime()) / 60000).toFixed(0)} minutes, ` +
                `but it will take you ${(travelInfo.durationValue / 60).toFixed(0)} minutes to reach the airport.`
              ]);
            } else {
              const timeUntilDeparture = ((requiredDepartureTime.getTime() - currentTime.getTime()) / 60000).toFixed(0);
              setOutput(prev => [
                ...prev,
                `You have about ${timeUntilDeparture} minutes before you need to leave.`,
                "This recommendation includes time to park and walk to the arrival area."
              ]);
            }
          } else {
            setOutput(prev => [...prev, 'Unable to calculate travel time. This route may not be accessible by car.']);
          }
        } else {
          setOutput(prev => [...prev, 'Unable to find airport coordinates.']);
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
      <h1>Just Landed</h1>
      <div className="input-container">
        <input
          type="text"
          value={flightNumber}
          onChange={(e) => setFlightNumber(e.target.value)}
          placeholder="Enter flight number"
        />
        <input
          id="address-input"
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
      {isLoaded && (
        <div 
          style={{ 
            height: '600px', 
            width: '100%', 
            transform: 'translate(750px, -420px)', 
            position: 'relative' 
          }}
        >
          <GoogleMap
            mapContainerStyle={{ height: '100%', width: '100%' }}
            center={mapCenter || { lat: 0, lng: 0 }}
            zoom={10}
          >
            {mapCenter && <Marker position={mapCenter} />}
          </GoogleMap>
        </div>
      )}
    </div>
  );
};

export default App;