var APIClient = require('picterra').APIClient;

(async () => {
  // Set the PICTERRA_API_KEY environment variable to define your API key
  const client = new APIClient()
  console.log('Uploading raster...')
  const rasterId = await client.uploadRaster('data/raster1.tif', 'a nice raster')
  console.log('Upload finished, listing rasters...')
  const rasters = await client.listRasters()
  rasters.forEach(r => {
    console.log(`raster id=${r.id}, name=${r.name}, status=${r.status}`)
  })
  console.log('Rasters listed, getting most recent details')
  await client.getRasterById(rasterId)
  console.log('Raster detail got, deleting most recent...')
  await client.deleteRasterById(rasterId)
  console.log('Raster was deleted')
})();
