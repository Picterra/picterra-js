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

/**
 * Sleep for a given amount of seconds
 * @param {Number} s Seconds to wait
 */
const sleep = s => new Promise(resolve => setTimeout(resolve, s * 1000));
/**
 * Validates an UUID
 * @param {String} uuid String to validate
 */


const uuidValidator = uuid => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
/**
 * Validation errors when calling library functions
 */


class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }

}
/**
 * Errors returned by the APi server
 */


class APIError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApiError';
  }

}
/**
 * The Client for the Picterra Public API
 */


exports.APIError = APIError;

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


  _request(path, method = 'GET', headers = {}, body = null, internal = true) {
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

    try {
      response = this._fetch(internal ? this.baseUrl + path : path, fetchOptions);
    } catch (e) {
      throw new Error('Error in Fetch API :' + e);
    }

    return response;
  }
  /**
     * @async
     * @function uploadRaster
     * @summary Given a raster, upload and commit it
     * @description The workflow is the following
     *  - we request an upload URL
     *  - we send raster data stream to the above URL
     *  - once finished, we order the server to commit (process) the raster
     *  - we poll the status of the processing until completion
     * @param {*} fileData
     * @param {Number} fileSize
     * @param {String} rasterName Name
     * @returns {Boolean} If the upload succedeed
     * @throws {APIError} Containing error code and text
     */


  async uploadRaster(fileData, fileSize, rasterName) {
    let response, data;

    try {
      response = await this._request( // Get upload URL
      '/rasters/upload/file/', 'POST', {
        'content-type': 'application/json'
      }, JSON.stringify({
        'name': rasterName // name of the image to upload

      }));

      if (!response.ok) {
        throw new APIError(`Error getting raster upload URL, status code ${response.status}`);
      } // Get parameters for blobstore upload


      data = await response.json();
      const uploadUrl = data.upload_url; // e.g. "https://storage.picterra.ch?id=AEnB2UmSEvVl"

      const rasterId = data.raster_id; // e.g. "123e4567-e89b-12d3-a456-426655440000"
      // Send raster data to blobstore

      response = await this._request(uploadUrl, 'PUT', {
        'content-length': fileSize
      }, fileData, false);

      if (!response.ok) {
        throw new APIError(`Error uploading raster with code ${response.status}`);
      } // Commit uploaded raster


      response = await this._request(`/rasters/${rasterId}/commit/`, 'POST');

      if (!response.ok) {
        throw new APIError(`Error committing raster ${response.status}`);
      }

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

      return true;
    } catch (error) {
      throw new APIError(error);
    }
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
    try {
      const response = await this._request('/rasters/');

      if (!response.ok) {
        throw new APIError(response, `Error getting rasters list with status ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new APIError('Not getting a list as response');
      }

      return data;
    } catch (error) {
      throw new APIError(error);
    }
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
    if (!uuidValidator(rasterId)) {
      throw new ValidationError('Invalid UUID string');
    }

    try {
      const response = await this._request(`/rasters/${rasterId}/`);

      if (!response.ok) {
        throw new APIError(`Error getting raster metadata with status ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw new APIError(error);
    }
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
    try {
      const response = await this._request('/detectors/');

      if (!response.ok) {
        throw new APIError(`Error getting detectors list with status ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new APIError('Not getting a list as response');
      }

      return data;
    } catch (error) {
      throw new APIError(error);
    }
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
    if (!uuidValidator(detectorId)) {
      throw new ValidationError('Invalid UUID string');
    }

    try {
      const response = await this._request(`/detectors/${detectorId}/`);

      if (!response.ok) {
        throw new APIError(`Error getting detector metadata with status ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      throw new APIError(error);
    }
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


  async runDetectorOnRaster(detectorId, rasterId) {
    let response, data, isReady;

    if (!uuidValidator(detectorId)) {
      throw new ValidationError('Invalid UUID string for a custom detector');
    }

    if (!uuidValidator(rasterId)) {
      throw new ValidationError('Invalid UUID string for a raster');
    }

    try {
      response = await this._request(`/detectors/${detectorId}/run/`, 'POST', {
        'content-type': 'application/json'
      }, JSON.stringify({
        'raster_id': rasterId
      }));

      if (!response.ok) {
        throw new APIError(`Error launching detection with status ${response.status}`);
      }

      data = await response.json();
      const pollInterval = data.poll_interval;

      const timeout = Date.now() + this._timeout;

      const resultId = data.result_id; // e.g. "123e4567-e89b-12d3-a456-426655440000"

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
      } // Returns the URL from which we can download the GeoJSON with the resulting geometries


      return data.result_url;
    } catch (error) {
      throw new APIError(error);
    }
  }

}

exports.default = APIClient;