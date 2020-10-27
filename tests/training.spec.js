// Imports
const nock = require('nock')  // // https://github.com/nock/nock
const assert = require('assert').strict  // https://nodejs.org/api/assert.html
const tmp = require('tmp')

const APIClient = require("../dist/index.js").APIClient

// CONSTANTS
const TEST_API_URL = 'http://example.com/public/api/v2'
const TEST_API_KEY = '123456'
const TEST_POLL_INTERVAL = 0.1
const TEST_STORAGE_URL = 'http://storage.example.com'
const DETECTOR_ID = '123e4567-e89b-12d3-a456-426655440000'
const OPERATION_ID = '7fa216e4-12ea-4bc3-bc58-0cc72c0187c9'
const RASTER_ID = 'f1de9a34-07f3-4ebc-989b-fe1e8e140183'
const RASTER_NAME = 'example_raster.tif'
const UPLOAD_URL = 'https://www.upload.example.com'
const UPLOAD_ID = 'spam'

describe('Training endpoints', async () => {
    // Detector creation
    let scope = nock(TEST_API_URL, {reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .post('/detectors/', {name: '', configuration: {detection_type: 'count', output_type: 'polygon', training_steps: 500}})
        .reply(201, {'id': DETECTOR_ID })
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
        .get(`/operations/${OPERATION_ID}/`)
        .reply(200, {'status': 'success'})
    // Annotations
    scope = nock(TEST_API_URL, { reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .post(`/detectors/${DETECTOR_ID}/training_rasters/${RASTER_ID}/outline/upload/bulk/`)
        .reply(201, {'upload_url': UPLOAD_URL, 'upload_id': UPLOAD_ID})
        .log(console.log)
    scope = nock(UPLOAD_URL).put('/').reply(200)
    scope = nock(TEST_API_URL, { reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .post(`/detectors/${DETECTOR_ID}/training_rasters/${RASTER_ID}/outline/upload/bulk/${UPLOAD_ID}/commit/`)
        .reply(201, {'operation_id': OPERATION_ID, 'poll_interval': TEST_POLL_INTERVAL})
        .get(`/operations/${OPERATION_ID}/`)
        .reply(200, {'status': 'success'})
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
        const res = await this.mockClient.uploadRaster(this.tmp.name, RASTER_NAME)
        assert.ok(res)
    })
    it('Should add a raster to a detector', async () => {
        const res = await this.mockClient.addRasterToDetector(RASTER_ID, DETECTOR_ID)
        assert.ok(res)
    })
    it('Should annotate a raster of a detector', async () => {
        const res = await this.mockClient.setAnnotations(DETECTOR_ID, RASTER_ID, 'outline', {})
        assert.ok(res)
    })
    it('Should train a detector', async () => {
        const res = await this.mockClient.trainDetector(DETECTOR_ID)
        assert.ok(res)
    })
})

process.on("unhandledRejection", (reason) => {
	console.log("unhandled rejection:", reason);
	unhandledRejectionExitCode = 1;
	throw reason;
});