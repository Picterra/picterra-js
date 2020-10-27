const APIClient = require('picterra').APIClient;

(async () => {
  // Set the PICTERRA_API_KEY environment variable to define your API key
  const client = new APIClient()

  console.log('Creating detector...')
  const detectorId = await client.createDetector('My first Picterra detector', 'segmentation')

  console.log('Editing detector...')
  await client.editDetector(detectorId, 'My renamed detector', null, 'bbox', 1000)

  console.log('Listing detectors...')
  const detectors = await client.listDetectors()
  detectors.forEach(r => {
    console.log(`detector id=${r.id}, name=${r.name}, detection type=${r.detector_type}, output type=${r.output_type}, steps=${r.training_steps}`)
  })
})()