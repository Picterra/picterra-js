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
const RASTER_ID = '123e4567-e89b-12d3-a456-426655440000'
const RASTER_NAME = 'example_raster.tif'

// Comple object mockS
const mockRasterList = [{id: RASTER_ID, status: 'ready', name: 'a'}, {id: '2', status: 'ready', name: 'b'}]


describe('/rasters/ endpoints', async () => {
    // Prepare mock HTTP responses
    let scope = nock(TEST_API_URL,  {
        reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .post('/rasters/upload/file/', {name: RASTER_NAME})
        .reply(201, {
            'raster_id': RASTER_ID,
            'upload_url': TEST_STORAGE_URL
        })
        .log(console.log)
    scope = nock(TEST_STORAGE_URL).put('/').delay(1000).reply(201).log(console.log)
    scope = nock(TEST_API_URL,  {
        reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .post(`/rasters/${RASTER_ID}/commit/`)
        .reply(201, {'poll_interval': TEST_POLL_INTERVAL})
        .log(console.log)
    scope = nock(TEST_API_URL,  {
        reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .get(`/rasters/${RASTER_ID}/`)
        .times(4)
        .reply(200, {'status': 'processing'})
        .get(`/rasters/${RASTER_ID}/`)
        .reply(200, {'status': 'ready'})
        .log(console.log)
    scope = nock(TEST_API_URL,  {
        reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .get(`/rasters/`)
        .reply(200, mockRasterList)
        .log(console.log)
    scope = nock(TEST_API_URL,  {
        reqheaders: {'X-Api-Key': TEST_API_KEY}})
        .get(`/rasters/${RASTER_ID}/`)
        .reply(200, mockRasterList.find( r => r.id == RASTER_ID))
        .log(console.log)
    scope.defaultReplyHeaders({
        'content-type': 'application/json',
    })
    beforeEach(() => {
        // Create API client
        this.mockClient = new APIClient(TEST_API_KEY, TEST_API_URL)
    })
    afterEach(() => {
        this.tmp.removeCallback()
    })
    // Start testing
    it('Should upload a raster', async () => {
        // Create fake image file
        this.tmp = tmp.fileSync()
        const res = await this.mockClient.uploadRaster(this.tmp.name, RASTER_NAME)
        assert.ok(res)
    })
    it('Should get the list of rasters', async () => {
        const res = await this.mockClient.listRasters()
        assert.ok(res)
    })
    it('Should get one raster', async () => {
        const res = await this.mockClient.getRasterById(RASTER_ID)
        assert.ok(res)
    })
    
})
