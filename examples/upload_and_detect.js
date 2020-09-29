var APIClient = require('picterra').APIClient;

(async () => {
  // Replace this with the id of one of your detectors
  let detectorId = 'e4bcbb59-d70a-41c6-b17d-58230296b14e'

  // Set the PICTERRA_API_KEY environment variable to define your API key
  let client = new APIClient()
  console.log('Uploading raster...')
  let rasterId = await client.uploadRaster('data/raster1.tif', rasterName='a nice raster')
  console.log('Upload finished, starting detector...')
  let resultId = await client.runDetector(detectorId, rasterId)
  await client.downloadResultToFile(resultId, 'result.geojson')
  console.log('Detection finished, results are in result.geojson')
})();
