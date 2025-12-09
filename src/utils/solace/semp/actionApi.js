import { ApiClient } from './monitor/ApiClient';

/**
 * Utility class for SEMP Action API operations
 */
export class ActionApiClient extends ApiClient {
  constructor() {
    super();
    // Override base path for Action API
    this.basePath = 'http://www.solace.com/SEMP/v2/action';
  }

  /**
   * Delete a message from a queue
   * @param {Object} config - Broker configuration
   * @param {string} msgVpnName - Message VPN name
   * @param {string} queueName - Queue name
   * @param {string|number} msgId - Message ID
   * @returns {Promise<Object>} Response from the API
   */
  async deleteQueueMessage(config, msgVpnName, queueName, msgId) {
    const { useTls, hostName, sempPort, sempUsername, sempPassword } = config;
    
    // Set base path for Action API
    this.basePath = `${(useTls ? 'https' : 'http')}://${hostName}:${sempPort}/SEMP/v2/action`;
    this.authentications.basicAuth = { username: sempUsername, password: sempPassword };

    const path = `/msgVpns/{msgVpnName}/queues/{queueName}/msgs/{msgId}/delete`;
    const pathParams = {
      msgVpnName,
      queueName,
      msgId: String(msgId)
    };
    
    // The delete action requires an empty body according to SEMP spec
    const bodyParam = {};

    return await this.callApi(
      path,
      'PUT',
      pathParams,
      {},
      {},
      {},
      bodyParam,
      ['basicAuth'],
      ['application/json'],
      ['application/json'],
      'Object'
    );
  }

  /**
   * Delete a message from a topic endpoint
   * @param {Object} config - Broker configuration
   * @param {string} msgVpnName - Message VPN name
   * @param {string} topicEndpointName - Topic endpoint name
   * @param {string|number} msgId - Message ID
   * @returns {Promise<Object>} Response from the API
   */
  async deleteTopicEndpointMessage(config, msgVpnName, topicEndpointName, msgId) {
    const { useTls, hostName, sempPort, sempUsername, sempPassword } = config;
    
    // Set base path for Action API
    this.basePath = `${(useTls ? 'https' : 'http')}://${hostName}:${sempPort}/SEMP/v2/action`;
    this.authentications.basicAuth = { username: sempUsername, password: sempPassword };

    const path = `/msgVpns/{msgVpnName}/topicEndpoints/{topicEndpointName}/msgs/{msgId}/delete`;
    const pathParams = {
      msgVpnName,
      topicEndpointName,
      msgId: String(msgId)
    };
    
    // The delete action requires an empty body according to SEMP spec
    const bodyParam = {};

    return await this.callApi(
      path,
      'PUT',
      pathParams,
      {},
      {},
      {},
      bodyParam,
      ['basicAuth'],
      ['application/json'],
      ['application/json'],
      'Object'
    );
  }
}

