import { http } from '../../../tauri/api';

/**
* @module ApiClient
* @version 2.36
*/

/**
* Manages low level client-server communications, parameter marshalling, etc. There should not be any need for an
* application to use this class directly - the *Api and model classes provide the public API for the service. The
* contents of this file should be regarded as internal but are documented for completeness.
* 
* Modified to use Tauri HTTP plugin instead of superagent to bypass CORS restrictions.
* 
* @alias module:ApiClient
* @class
*/
export class ApiClient {
  constructor() {
    /**
     * The base URL against which to resolve every API call's (relative) path.
     * @type {String}
     * @default http://www.solace.com/SEMP/v2/monitor
     */
    this.basePath = 'http://www.solace.com/SEMP/v2/monitor'.replace(/\/+$/, '');
    
    /**
     * The authentication methods to be included for all API calls.
     * @type {Array.<String>}
     */
    this.authentications = {
      'basicAuth': { type: 'basic' }
    };

    /**
     * The default HTTP headers to be included for all API calls.
     * @type {Array.<String>}
     * @default {}
     */
    this.defaultHeaders = {};

    /**
     * The default HTTP timeout for all API calls.
     * @type {Number}
     * @default 60000
     */
    this.timeout = 60000;

    /**
     * If set to false an additional timestamp parameter is added to all API GET calls to
     * prevent browser caching
     * @type {Boolean}
     * @default true
     */
    this.cache = true;

    /**
     * If set to true, the client will save the cookies from each server
     * response, and return them in the next request.
     * @default false
     */
    this.enableCookies = false;
  }

  buildCollectionParam(param, collectionFormat) {
    if (param == null) {
      return null;
    }
    switch (collectionFormat) {
      case 'csv':
        return param.map(this.paramToString).join(',');
      case 'ssv':
        return param.map(this.paramToString).join(' ');
      case 'tsv':
        return param.map(this.paramToString).join('\t');
      case 'pipes':
        return param.map(this.paramToString).join('|');
      case 'multi':
        return param.map(this.paramToString);
      default:
        throw new Error('Unknown collection format: ' + collectionFormat);
    }
  }

  buildUrl(path, pathParams) {
    if (!path.match(/^\//)) {
      path = '/' + path;
    }

    var url = this.basePath + path;
    url = url.replace(/\{([\w-]+)\}/g, (fullMatch, key) => {
      var value;
      if (pathParams.hasOwnProperty(key)) {
        value = this.paramToString(pathParams[key]);
      } else {
        value = fullMatch;
      }

      return encodeURIComponent(value);
    });

    return url;
  }

  async callApi(   
    path, httpMethod, pathParams, queryParams, headerParams,
    formParams, bodyParam, authNames, contentTypes, accepts, returnType) {
    
    const { fetch } = http;
    console.log('🌐 SEMP ApiClient using Tauri fetch:', typeof fetch, fetch?.name || 'unknown');
    const url = this.buildUrl(path, pathParams)
    const urlParams = new URLSearchParams(this.normalizeParams(queryParams));

    const args = {
      request: { 
        path, httpMethod, pathParams, queryParams, headerParams,
        formParams, bodyParam, authNames, contentTypes, accepts, returnType
      },
      response: {}
    };

    console.debug(`${httpMethod} ${url}`, args);
    const { username, password } = this.authentications.basicAuth;

    const resp = await fetch(urlParams.size ? `${url}?${urlParams}` : url, {
      method: httpMethod,
      headers: {
        'Authorization': `Basic ${btoa(`${username}:${password}`)}`
      },
      body: bodyParam ? JSON.stringify(bodyParam) : undefined,
    });

    args.response = resp;

    const data = await resp.json();
    const { status, ...rest } = resp;
    const result = {
      status,
      data,
      response: {
        status,
        body: data,
        ...rest
      }
    };

    if(!resp.ok) {
      throw result;
    }
    return result;
  }

  normalizeParams(params) {
    var newParams = {};
    for (var key in params) {
      if (params.hasOwnProperty(key) && params[key] != undefined && params[key] != null) {
        var value = params[key];
        newParams[key] = this.paramToString(value);
      }
    }

    return newParams;
  }

  flattenParams(params) {
    return Object.entries(params || {})
      .filter(([key, value]) => value)
      .map(([key, value]) => `${key}=${value}`);
  }

  paramsToString(params) {
    return this.flattenParams(this.normalizeParams(params)).join('&');
  }

  paramToString(param) {
    if (param == undefined || param == null) {
      return '';
    }
    if (param instanceof Date) {
      return param.toJSON();
    }

    return param.toString();
  }

  /**
   * Parses an ISO-8601 string representation of a date value.
   * @param {String} str The date value as a string.
   * @returns {Date} The parsed date object.
   */
  parseDate(str) {
    return new Date(str.replace(/T/i, ' '));
  }

  /**
   * Converts a value to the specified type.
   * @param {(String|Object)} data The data to convert, as a string or object.
   * @param {(String|Array.<String>|Object.<String, Object>|Function)} type The type to return. Pass a string for simple types
   * or the constructor function for a complex type. Pass an array containing the type name to return an array of that type. To
   * return an object, pass an object with one property whose name is the key type and whose value is the corresponding value type:
   * all properties on <code>data<code> will be converted to this type.
   * @returns An instance of the specified type or null or undefined if data is null or undefined.
   */
  convertToType(data, type) {
    if (data === null || data === undefined)
      return data

    switch (type) {
      case 'Boolean':
        return Boolean(data);
      case 'Integer':
        return parseInt(data, 10);
      case 'Number':
        return parseFloat(data);
      case 'String':
        return String(data);
      case 'Date':
        return this.parseDate(String(data));
      case 'Blob':
        return data;
      default:
        if (type === Object) {
          // generic object, return directly
          return data;
        } else if (typeof type === 'function') {
          // for model type like: User
          return type.constructFromObject(data);
        } else if (Array.isArray(type)) {
          // for array type like: ['String']
          var itemType = type[0];
          return data.map((item) => {
            return this.convertToType(item, itemType);
          });
        } else if (typeof type === 'object') {
          // for plain object type like: {'String': 'Integer'}
          var keyType, valueType;
          for (var k in type) {
            if (type.hasOwnProperty(k)) {
              keyType = k;
              valueType = type[k];
              break;
            }
          }
          var result = {};
          for (var k in data) {
            if (data.hasOwnProperty(k)) {
              var key = this.convertToType(k, keyType);
              var value = this.convertToType(data[k], valueType);
              result[key] = value;
            }
          }
          return result;
        } else {
          // for unknown type, return the data directly
          return data;
        }
    }
  }

  /**
   * Constructs a new map or array model from REST data.
   * @param data {Object|Array} The REST data.
   * @param obj {Object|Array} The target object or array.
   */
  constructFromObject(data, obj, itemType) {
    if (Array.isArray(data)) {
      for (var i = 0; i < data.length; i++) {
        if (data.hasOwnProperty(i))
          obj[i] = this.convertToType(data[i], itemType);
      }
    } else {
      for (var k in data) {
        if (data.hasOwnProperty(k))
          obj[k] = this.convertToType(data[k], itemType);
      }
    }
  };

  /**
   * Applies authentication headers to the request.
   * @param {Object} request The request object.
   * @param {Array.<String>} authNames An array of authentication method names.
   */
  applyAuthToRequest(request, authNames) {
    authNames.forEach((authName) => {
      var auth = this.authentications[authName];
      switch (auth.type) {
        case 'basic':
          if (auth.username || auth.password) {
            request.set('Authorization', 'Basic ' + btoa(auth.username + ':' + auth.password));
          }
          break;
        case 'apiKey':
          if (auth.apiKey) {
            var data = {};
            if (auth.apiKeyPrefix) {
              data[auth.name] = auth.apiKeyPrefix + ' ' + auth.apiKey;
            } else {
              data[auth.name] = auth.apiKey;
            }
            if (auth['in'] === 'header') {
              request.set(data);
            } else {
              request.query(data);
            }
          }
          break;
        case 'oauth2':
          if (auth.accessToken) {
            request.set('Authorization', 'Bearer ' + auth.accessToken);
          }
          break;
        default:
          throw new Error('Unknown authentication type: ' + auth.type);
      }
    });
  }

  /**
   * Deserializes an HTTP response body into a value of the specified type.
   * @param {Object} response A SuperAgent response object.
   * @param {(String|Array.<String>|Object.<String, Object>|Function)} returnType The type to return. Pass a string for simple types
   * or the constructor function for a complex type. Pass an array containing the type name to return an array of that type. To
   * return an object, pass an object with one property whose name is the key type and whose value is the corresponding value type:
   * all properties on <code>data<code> will be converted to this type.
   * @returns A value of the specified type.
   */
  deserialize(response, returnType) {
    if (response == null || returnType == null || response.status == 204) {
      return null;
    }
    // Rely on SuperAgent for parsing response body.
    // See http://visionmedia.github.io/superagent/#parsing-response-bodies
    var data = response.body;
    if (data == null || (typeof data === 'object' && typeof data.length === 'undefined' && !Object.keys(data).length)) {
      // SuperAgent does not always produce a body; use the unparsed response as a fallback
      data = response.text;
    }
    return this.convertToType(data, returnType);
  }
}

ApiClient.instance = new ApiClient();
