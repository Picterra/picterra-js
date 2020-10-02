const {readFileSync} = require('fs')

const APIClient = require('picterra').APIClient;

(async () => {
  // Set the PICTERRA_API_KEY environment variable to define your API key
  const client = new APIClient('59c4715cee86d854e233739260fdfd8373f13fc393ee66ca389b04bc40e80472', 'https://app-testing.picterra.ch/public/api/v1/')

  console.log('Creating detector...')
  const detectorId = await client.createDetector('My first Picterra detector')

  console.log('Uploading raster...')
  const rasterId = await client.uploadRaster('data/raster1.tif', 'a nice raster')

  console.log('Adding raster to detector...')
  await client.addRasterToDetector(rasterId, detectorId)

  console.log('Adding annotations')
  let data = readFileSync('data/outline1.geojson'/*,  {encoding: 'utf8'} */)
  await client.setAnnotations(detectorId, rasterId, 'outline', JSON.parse(data))
  data = readFileSync('data/training_area1.geojson'/*,  {encoding: 'utf8'} */)
  await client.setAnnotations(detectorId, rasterId, 'training_area', JSON.parse(data))
  data = readFileSync('data/validation_area1.geojson'/* , {encoding: 'utf8'} */)
  await client.setAnnotations(detectorId, rasterId, 'validation_area', JSON.parse(data))

  console.log('Training detector...')
  await client.trainDetector(detectorId)
})()
