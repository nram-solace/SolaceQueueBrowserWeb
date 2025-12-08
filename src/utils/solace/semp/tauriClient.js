import { http } from '../../tauri/api';


export class ApiClient {
  constructor() {
    this.authentications = {
      'basicAuth': { type: 'basic' }
    };
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
        //return the array directly as SuperAgent will handle it as expected
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
    console.log('🌐 Using fetch:', typeof fetch, fetch?.name || 'unknown');
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
}

ApiClient.instance = new ApiClient();