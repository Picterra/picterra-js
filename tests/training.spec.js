// Imports
const nock = require('nock')  // // https://github.com/nock/nock
const assert = require('assert').strict  // https://nodejs.org/api/assert.html
const tmp = require('tmp')

const APIClient = require("../dist/index.js").APIClient

// CONSTANTS
const TEST_API_URL = 'http://example.com/public/api/v1'
const TEST_API_KEY = '123456'
const TEST_POLL_INTERVAL = 0.1
const TEST_STORAGE_URL = 'http://storage.example.com'
const DETECTOR_ID = '123e4567-e89b-12d3-a456-426655440000'
const OPERATION_ID = '7fa216e4-12ea-4bc3-bc58-0cc72c0187c9'
const RASTER_ID = 'f1de9a34-07f3-4ebc-989b-fe1e8e140183'

describe('Training endpoints', async () => {
    // Detector creation
    let scope = nock(TEST_API_URL, {reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .post('/detectors/')
        .reply(201, {'detector_id': DETECTOR_ID })
        .log(console.log)
    // Raster upload, commit and status poll
    scope = nock(TEST_API_URL, { reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .post('/rasters/upload/file/', {name: RASTER_NAME})
        .reply(201, {'raster_id': RASTER_ID, 'upload_url': TEST_STORAGE_URL})
        .log(console.log)
    scope = nock(TEST_STORAGE_URL).put('/').delay(1000).reply(201).log(console.log)
    scope = nock(TEST_API_URL,  {
        reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .post(`/rasters/${RASTER_ID}/commit/`)
        .reply(201, {'poll_interval': TEST_POLL_INTERVAL})
        .log(console.log)
    scope = nock(TEST_API_URL, { reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .get(`/rasters/${RASTER_ID}/`)
        .times(4)
        .reply(200, {'status': 'processing'})
        .get(`/rasters/${RASTER_ID}/`)
        .reply(200, {'status': 'ready'})
        .log(console.log)
    // Raster addition to detector
    scope = nock(TEST_API_URL, { reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .post(`/detectors/${DETECTOR_ID}/training_rasters/`, {raster_id: RASTER_ID})
        .reply(201)
    // Detector training
    scope = nock(TEST_API_URL, { reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .post(`/detectors/${DETECTOR_ID}/train/`)
        .reply(201, {'operation_id': OPERATION_ID, 'poll_interval': TEST_POLL_INTERVAL})
        .log(console.log)
    scope.defaultReplyHeaders({'content-type': 'application/json'})
    beforeEach(() => { this.mockClient = new APIClient(TEST_API_KEY, TEST_API_URL) }) // Creates API client
    afterEach(() => { if (this.tmp) this.tmp.removeCallback() })
    // Start testing
    it('Should create a detector', async () => {
        const res = await this.mockClient.createDetector()
        assert.ok(res)
    })
    it('Should upload a raster', async () => {
        this.tmp = tmp.fileSync()
        const res = await this.mockClient.uploadRaster(this.tmp.name, 'Spam image')
        assert.ok(res)
    })
    it('Should add a raster to a detector', async () => {
        const res = await this.mockClient.addRasterToDetector(RASTER_ID, DETECTOR_ID)
        assert.ok(res)
    })
    it('Should train a detector', async () => {
        const res = await this.mockClient.trainDetector(DETECTOR_ID)
        assert.ok(res)
    })
})
