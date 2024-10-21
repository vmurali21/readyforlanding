function getAirportCoordinates(icaoCode) {
  icaoCode = icaoCode.toUpperCase();
  return new Promise((resolve, reject) => {
    fs.createReadStream('airportdataset.csv')
      .pipe(csv())
      .on('data', (row) => {
        if (row.icao === icaoCode) {
          resolve([parseFloat(row.latitude), parseFloat(row.longitude)]);
        }
      })
      .on('end', () => {
        reject(new Error('Airport not found'));
      });
  });
}

export default getAirportCoordinates;