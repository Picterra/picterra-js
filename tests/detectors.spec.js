// Imports
const nock = require('nock')  // // https://github.com/nock/nock
const assert = require('assert').strict  // https://nodejs.org/api/assert.html
const tmp = require('tmp')

const APIClient = require("../dist/index.js").default

// CONSTANTS
const TEST_API_URL = 'http://example.com/public/api/v1'
const TEST_API_KEY = '123456'
const TEST_POLL_INTERVAL = 0.1
const TEST_STORAGE_URL = 'http://storage.example.com'
const DETECTOR_ID = 'ce2eb567-d304-411d-b430-5d76a0d597ac'
const RASTER_ID = '123e4567-e89b-12d3-a456-426655440000'
const RESULT_ID = 'a4b2e2d0-c263-4763-999f-89c027e155a2'
// Comple object mockS
const mockDetectorsList = [{id: DETECTOR_ID, name: 'a'}, {id: '2', name: 'b'}]

describe('/detectors/ endpoint', async () => {
    // Prepare mock HTTP responses
    let scope = nock(TEST_API_URL,  {
        reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .get(`/detectors/`)
        .reply(200, mockDetectorsList)
        .log(console.log)
    scope = nock(TEST_API_URL,  {
        reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .get(`/detectors/${DETECTOR_ID}/`)
        .reply(200, mockDetectorsList.find( d => d.id == DETECTOR_ID))
        .log(console.log)
    scope = nock(TEST_API_URL,  {
        reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .post(`/detectors/${DETECTOR_ID}/run/`, {raster_id: RASTER_ID})
        .reply(201, {result_id: RESULT_ID, poll_interval: TEST_POLL_INTERVAL})
        .log(console.log)
    scope = nock(TEST_API_URL,  {
        reqheaders: {'X-Api-Key': TEST_API_KEY}})
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
    it('Should run one detector', async () => {
        const res = await this.mockClient.runDetectorOnRaster(DETECTOR_ID, RASTER_ID)
        assert.ok(res)
    })
})
