"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.APIError = void 0;

require("core-js/modules/web.dom.iterable");

/**
 * @file Wrapper around the basic functions offered by the Public API
 * @see https://app.picterra.ch/public/apidocs/v1/
 */
const {
  createReadStream,
  createWriteStream
} = require('fs');

const util = require('util');

const streamPipeline = util.promisify(require('stream').pipeline);
/**
 * Sleep for a given amount of seconds
 * @param {Number} s Seconds to wait
 */

const sleep = s => new Promise(resolve => setTimeout(resolve, s * 1000));
/**
 * Errors returned by the API server
 */


class APIError extends Error {
  constructor(message, body = '') {
    super(message);
    this.name = 'ApiError';
    this.body = body;
  }

}
/**
 * Check the response returned a successful HTTP code, otherwise raise APIError
 */


exports.APIError = APIError;

async function checkResponse(response) {
  if (!response.ok) {
    const text = await response.text();
    throw new APIError(`Error from API: status code ${response.status}`, text);
  }
}
/**
 * The Client for the Picterra Public API
 */


class APIClient {
  /**
     * @constructor
     * @param {String} apiKey API key for the account to use for accessing the Picterra server
     * @param {String} baseUrl URL of the Picterra Public API endpoint
     * @param {Number} timeoutSeconds Max number of seconds after which an operation times out
     */
  constructor(apiKey, baseUrl, timeoutSeconds = 300) {
    // Setup API key
    if (!apiKey) {
      if (!process.env.PICTERRA_API_KEY) {
        throw APIError('apiKey is undefined and PICTERRA_API_KEY environment variable is not defined');
      } else {
        apiKey = process.env.PICTERRA_API_KEY;
      }
    }

    this.apiKey = apiKey;
    let fetch, Headers;

    if (typeof window === 'undefined') {
      fetch = require('node-fetch'); // https://www.npmjs.com/package/node-fetch

      Headers = fetch.Headers;
    } else {
      fetch = window.fetch; // https://caniuse.com/#feat=fetch, https://github.com/github/fetch

      Headers = window.Headers; // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
    }

    this._fetch = fetch;
    this._headers = Headers;
    this._timeout = timeoutSeconds * 60 * 1000; // Setup endpoint

    if (!baseUrl) {
      baseUrl = process.env.PICTERRA_BASE_URL || 'https://app.picterra.ch/public/api/v1/';
    }

    this.baseUrl = baseUrl;
  }
  /**
     * @function _request
     * @private
     * @summary Raw wrapper around the fetch API
     * @description The rationale is to have a wrapper around the fetch API
     * that can both send requests to the Picterra Public API endpoints (for
     * which it stores the API key) but also generic HTTP request, with
     * customizable headers, body and method
     * @param {String} path Relative of absolute URI
     * @param {Strin} method One of 'GET', 'POST', 'PUT', 'DELETE'
     * @param {Object} headers HTTP headers to set as key-value pairs
     * @param {*} body
     * @param {Boolean} internal Whether or not the path URI refers to an endpoint
     * relative to the root API one
     */


  async _request(path, method = 'GET', headers = {}, body = null, internal = true) {
    const fetchHeaders = new this._headers({});
    let response;

    if (internal) {
      fetchHeaders.set('X-Api-Key', this.apiKey);
    }

    for (let [key, value] of Object.entries(headers)) {
      fetchHeaders.set(key, value);
    }

    const fetchOptions = {
      method: method,
      headers: fetchHeaders,
      body: body
    };
    response = await this._fetch(internal ? this.baseUrl + path : path, fetchOptions);
    return response;
  }
  /**
     * @async
     * @function uploadRaster
     * @summary Uploads a local file as a new raster on Picterra
     * @param {Number} fileName name of the local file to upload
     * @param {String} rasterName Name
     * @returns {Promise} A promise that resolves to the rasterId (String)
     *   once the raster is ready on Picterra
     * @throws {APIError} Containing error code and text
     */


  async uploadRaster(fileName, rasterName) {
    const stream = createReadStream(fileName);
    let response, data;
    response = await this._request( // Get upload URL
    '/rasters/upload/file/', 'POST', {
      'content-type': 'application/json'
    }, JSON.stringify({
      'name': rasterName // name of the image to upload

    })); // Get parameters for blobstore upload

    data = await response.json();
    const uploadUrl = data.upload_url; // e.g. "https://storage.picterra.ch?id=AEnB2UmSEvVl"

    const rasterId = data.raster_id; // e.g. "123e4567-e89b-12d3-a456-426655440000"
    // Send raster data to blobstore

    response = await this._request(uploadUrl, 'PUT', {}, stream, false);
    await checkResponse(response); // Commit uploaded raster

    response = await this._request(`/rasters/${rasterId}/commit/`, 'POST');
    await checkResponse(response);
    data = await response.json(); // Prepare for polling

    const pollInterval = data.poll_interval; // In seconds

    const timeout = Date.now() + this._timeout;

    let isReady = false; // Start polling to check raster commit status

    do {
      await sleep(pollInterval);
      response = await this._request(`/rasters/${rasterId}/`);

      if (Date.now() > timeout || !response.ok) {
        break;
      }

      data = await response.json();
      isReady = data.status === 'ready';
    } while (!isReady); // Poll until complete
    // Raise error in case of timeout or bad response


    if (!isReady) {
      const errorMessage = response.ok ? 'Request timed-out' : 'Error uploading raster';
      throw new APIError(errorMessage);
    }

    return rasterId;
  }
  /**
     * @async
     * @function listRasters
     * @summary Get the list of available remote rasters
     * @description Lists the metadata of all the rasters owned by the API
     * user uploaded to the platform, thus targetable by a detection
     * @returns {Promise<[Object]>} A JSON list of the available rasters
     * @throws {APIError} Containing error code and text
     */


  async listRasters() {
    const response = await this._request('/rasters/');
    await checkResponse(response);
    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new APIError('Not getting a list as response');
    }

    return data;
  }
  /**
     * @async
     * @function getRasterById
     * @summary Get an available raster, identified by an UUID
     * @description Retrieve the metadata relative to a given raster,
     * identified by an UUID and owned by the API user, among the ones
     * available (uploaded) on the platform, that is on which we can detect on
     * @param {String} rasterId UUID of the raster
     * @returns {Promise<Object>} A JSON representing the metadata of the raster
     * @throws {APIError} Containing error code and text
     */


  async getRasterById(rasterId) {
    const response = await this._request(`/rasters/${rasterId}/`);
    await checkResponse(response);
    const data = await response.json();
    return data;
  }
  /**
     * @async
     * @summary Set the detection area of an available raster
     * @description Given a raster, sets the detection area geometries for it, overriding
     * any previous one
     * @param {String} rasterId The Id of the raster whose detection area we want to set
     * @param {String} fileName The GeoJSON with the Detection Areas geometries
     * @returns {Promise<Boolean>} Whether or not the operation succedeed
     * @throws {APIError} Containing error code and text
     */


  async setRasterDetectionAreaFromFile(fileName, rasterId) {
    const stream = createReadStream(fileName);
    let response, data; // Get upload URL

    response = await this._request(`/rasters/${rasterId}/detection_areas/upload/file/`, 'POST');
    await checkResponse(response);
    data = await response.json();
    const uploadUrl = data.upload_url;
    const uploadId = data.upload_id; // Send geojson data to blobstore

    response = await this._request(uploadUrl, 'PUT', {}, stream, false);
    await checkResponse(response); // Commit the upload

    response = await this._request(`/rasters/${rasterId}/detection_areas/upload/${uploadId}/commit/`, 'POST');
    await checkResponse(response); // Prepare for polling

    data = await response.json();
    const pollInterval = data.poll_interval; // In seconds

    const timeout = Date.now() + this._timeout;

    let isReady = false; // Start polling to check upload commit status

    do {
      await sleep(pollInterval);
      response = await this._request(`/rasters/${rasterId}/detection_areas/upload/${uploadId}/`);

      if (Date.now() > timeout || !response.ok) {
        break;
      }

      data = await response.json();

      if (data.status === 'failed') {
        break;
      }

      isReady = data.status === 'ready';
    } while (!isReady); // Poll until complete
    // Error management


    if (!isReady) {
      const text = await response.text();
      throw new APIError('Error uploading detection area', text);
    } else {
      return true;
    }
  }
  /**
    * @summary Delete a raster, identified by an UUID
    * @description Delete a given raster, identified by an UUID and
    * owned by the API user
    * @param {String} rasterId UUID of the raster
    * @returns {Promise<Boolean>} Whether or not removal was successful
    * @throws {APIError} Containing error code and text
    */


  async deleteRasterById(rasterId) {
    // Send HTTP request
    const response = await this._request('/rasters/'.concat(rasterId, '/'), 'DELETE'); // Error management

    await checkResponse(response); // Return all went good

    return true;
  }
  /**
   * @async
   * @function listDetectors
   * @summary Get the list of available custom detectors
   * @description Lists the metadata of all the custom detectors
   * owned by the API user, thus ready to preditc with on rasters
   * @returns {Promise<[Object]>} A JSON list of the available detectors
   * @throws {APIError} Containing error code and text
   */


  async listDetectors() {
    const response = await this._request('/detectors/');
    await checkResponse(response);
    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new APIError('Not getting a list as response');
    }

    return data;
  }
  /**
     * @async
     * @function getDetectorById
     * @summary Get an available custom detector, identified by an UUID
     * @description Retrieve the metadata relative to a given custom detector,
     * identified by an UUID and owned by the API user, among the ones
     * available on the platform, that is with which we can predict on rasters
     * @param {String} detectorId UUID of the custom detector
     * @returns {Promise<Object>} A JSON representing the metadata of the detector
     * @throws {APIError} Containing error code and text
     */


  async getDetectorById(detectorId) {
    const response = await this._request(`/detectors/${detectorId}/`);
    await checkResponse(response);
    const data = await response.json();
    return data;
  }
  /**
     * @async
     * @function runDetector
     * @summary Runs a given detector on a given raster, both identified by their UUID
     * @description Launches the detection on a given raster using a given custom
     * detector, both belonging to the API user: once started, it waits for the detection
     * to end, returning the URL where the result GeoJSON is stored
     * @param {String} detectorId UUID of the custom detector to use for prediction
     * @param {String} rasterId UUID of the raster to predict on
     * @returns {Promise<String>} Promise for the URL where the detection results are stored
     * @throws {APIError} Containing error code and text
     */


  async runDetector(detectorId, rasterId) {
    let response, data, isReady;
    response = await this._request(`/detectors/${detectorId}/run/`, 'POST', {
      'content-type': 'application/json'
    }, JSON.stringify({
      'raster_id': rasterId
    }));
    await checkResponse(response);
    data = await response.json();
    const pollInterval = data.poll_interval;

    const timeout = Date.now() + this._timeout;

    const resultId = data.result_id;
    isReady = false; // Start polling to check detection status

    do {
      await sleep(pollInterval);
      response = await this._request(`/results/${resultId}/`);

      if (Date.now() > timeout || !response.ok) {
        break;
      }

      data = await response.json();
      isReady = data.ready;
    } while (!isReady); // Poll until complete
    // Raise error in case of timeout or bad response


    if (!isReady) {
      const errorMessage = response.ok ? 'Request timed-out' : 'Error detecting on raster';
      throw new APIError(errorMessage);
    }

    return resultId;
  }

  async downloadResultToFile(resultId, fileName) {
    let response = await this._request(`/results/${resultId}/`);
    await checkResponse(response);
    const data = await response.json();

    if (!data.ready) {
      throw new APIError('Result not ready');
    }

    response = await this._request(data.result_url, 'GET', {}, null, false);
    await checkResponse(response);
    return streamPipeline(response.body, createWriteStream(fileName));
  }

}

exports.default = APIClient;