// Imports
const nock = require('nock') // // https://github.com/nock/nock
const assert = require('assert').strict // https://nodejs.org/api/assert.html

const APIClient = require('../dist/index.js').APIClient

// CONSTANTS
const TEST_API_URL = 'http://example.com/public/api/v2'
const TEST_API_KEY = '123456'
const TEST_POLL_INTERVAL = 0.1
const TEST_STORAGE_URL = 'http://storage.example.com'
const DETECTOR_ID = 'ce2eb567-d304-411d-b430-5d76a0d597ac'
const RASTER_ID = '123e4567-e89b-12d3-a456-426655440000'
const RESULT_ID = 'a4b2e2d0-c263-4763-999f-89c027e155a2'
// Complex object mocks
const mockDetectorsList1 = [
  {id: 'a', name: 'a', configuration: {detection_type: 'count', output_type: 'polygon', training_steps: 1000}},
  {id: 'b', name: 'b', configuration: {detection_type: 'segmentation', output_type: 'bbox', training_steps: 2000}}
]
const mockDetectorsList2 = [
  {id: 'c', name: 'c', configuration: {detection_type: 'count', output_type: 'polygon', training_steps: 1000}},
  {id: 'd', name: 'd', configuration: {detection_type: 'segmentation', output_type: 'bbox', training_steps: 2000}}
]
const mockDetectorsList = [
  {
    'count': 4,
    'next': `${TEST_API_URL}/detectors/?page_number=2`,
    'previous': null,
    'results': mockDetectorsList1,
    'page_size': 2
  },
  {
    'count': 4,
    'next': null,
    'previous': `${TEST_API_URL}/detectors/?page_number=1`,
    'results': mockDetectorsList2,
    'page_size': 2
  }
]

describe('/detectors/ endpoint', async () => {
  // listDetectors
  let scope = nock(TEST_API_URL, {reqheaders: {'X-Api-Key': TEST_API_KEY}})
    .get('/detectors/?page_number=1')
    .reply(200, mockDetectorsList)
    .log(console.log)
  scope = nock(TEST_API_URL, {reqheaders: {'X-Api-Key': TEST_API_KEY}})
    .get('/detectors/?page_number=2')
    .reply(200, mockDetectorsList)
    .log(console.log)
  // getDetectorById
  scope = nock(TEST_API_URL, {reqheaders: {'X-Api-Key': TEST_API_KEY}})
    .get(`/detectors/${DETECTOR_ID}/`)
    .reply(200, mockDetectorsList1[0])
    .log(console.log)
  // createDetector
  scope = nock(TEST_API_URL, {reqheaders: {'X-Api-Key': TEST_API_KEY}})
    .post('/detectors/', {name: 'spam', configuration: {detection_type: 'segmentation', output_type: 'polygon', training_steps: 500}})
    .reply(201, {id: DETECTOR_ID})
    .log(console.log)
  // editDetector
  scope = nock(TEST_API_URL, {reqheaders: {'X-Api-Key': TEST_API_KEY}})
    .put(`/detectors/${DETECTOR_ID}/`, {name: 'spam', configuration: {output_type: 'bbox'}})
    .reply(204)
    .log(console.log)
  // runDetector
  scope = nock(TEST_API_URL, {reqheaders: {'X-Api-Key': TEST_API_KEY}})
    .post(`/detectors/${DETECTOR_ID}/run/`, {raster_id: RASTER_ID})
    .reply(201, {result_id: RESULT_ID, poll_interval: TEST_POLL_INTERVAL})
    .log(console.log)
  scope = nock(TEST_API_URL, {reqheaders: {'X-Api-Key': TEST_API_KEY}})
    .get(`/results/${RESULT_ID}/`)
    .times(4)
    .reply(200, {ready: false})
    .get(`/results/${RESULT_ID}/`)
    .reply(200, {ready: true, result_url: TEST_STORAGE_URL})
    .log(console.log)
  scope.defaultReplyHeaders({
    'content-type': 'application/json',
  })
  beforeEach(() => {
    // Create API client
    this.mockClient = new APIClient(TEST_API_KEY, TEST_API_URL)
  })
  // Start testing
  it('Should get the list of detectors', async () => {
    const res = await this.mockClient.listDetectors()
    assert.ok(res)
  })
  it('Should get one detector', async () => {
    const res = await this.mockClient.getDetectorById(DETECTOR_ID)
    assert.ok(res)
  })
  it('Should create one detector', async () => {
    const res = await this.mockClient.createDetector('spam', 'segmentation')
    assert.ok(res)
  })
  it('Should edit one detector', async () => {
    const res = await this.mockClient.editDetector(DETECTOR_ID, 'spam', null, 'bbox')
    assert.ok(res)
  })
  it('Should raise errors while creating a detector if settings are wrong', async () => {
    [
      ['', 'spam', null, 2000], // detection
      ['', null, 'spam', 2000], // output
      ['', null, undefined, 10 ** 9], // steps 1
      ['', null, null, null, 0] // steps 2

    ].forEach(o => assert.rejects(async () => this.mockClient.createDetector(...o)))
  })
  it('Should raise errors while editing a detector if settings are wrong', async () => {
    [
      ['', 'segmentation', null, 2000], // detection
      ['', null, 'spam', 2000], // output
      ['', null, undefined, 10 ** 9], // steps 1
      ['', null, null, null, 0] // steps 2

    ].forEach(o => assert.rejects(async () => this.mockClient.editDetector('spamId', ...o)))
  })
  it('Should run one detector', async () => {
    const res = await this.mockClient.runDetector(DETECTOR_ID, RASTER_ID)
    assert.ok(res)
  })
})

process.on("unhandledRejection", (reason) => {
	console.log("unhandled rejection:", reason);
	unhandledRejectionExitCode = 1;
	throw reason;
});