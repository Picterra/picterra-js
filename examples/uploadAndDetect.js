var APIClient = require('picterra').APIClient;

(async () => {
  // Replace this with the id of one of your detectors
  let detectorId = 'e4bcbb59-d70a-41c6-b17d-58230296b14e'

  // Set the PICTERRA_API_KEY environment variable to define your API key
  const client = new APIClient()
  console.log('Uploading raster...')
  const rasterId = await client.uploadRaster('data/raster1.tif', 'a nice raster')
  console.log('Upload finished, setting detection area...')
  await client.setRasterDetectionAreaFromFile('data/detection_area1.geojson', rasterId)
  console.log('Detection area set, starting detector...')
  const resultId = await client.runDetector(detectorId, rasterId)
  await client.downloadResultToFile(resultId, 'result.geojson')
  console.log('Detection finished, results are in result.geojson')
})();
