import { ActionApiClient } from './solace/semp/actionApi';
import { SOURCE_TYPE } from '../hooks/solace';

/**
 * Utility class for managing bulk message operations
 */
export class BulkOperationManager {
  constructor() {
    this.actionApiClient = new ActionApiClient();
  }

  /**
   * Execute bulk delete operation
   * @param {Array} messages - Array of message objects to delete
   * @param {Object} config - Broker configuration
   * @param {string} sourceName - Source queue/topic name
   * @param {string} sourceType - Source type (QUEUE, BASIC, TOPIC)
   * @param {Object} options - Operation options
   * @returns {Promise<Object>} Operation results
   */
  async executeBulkDelete(messages, config, sourceName, sourceType, options = {}) {
    const {
      onProgress = () => {},
      onError = () => {},
      abortOnError = false,
      cancelToken = null
    } = options;

    const results = {
      total: messages.length,
      success: 0,
      failed: 0,
      errors: [],
      aborted: false,
      duration: 0
    };

    const startTime = Date.now();

    for (let i = 0; i < messages.length; i++) {
      // Check for cancellation
      if (cancelToken?.aborted) {
        results.aborted = true;
        break;
      }

      const message = messages[i];
      const msgId = message.meta?.msgId;

      if (!msgId) {
        const error = new Error('Message ID is missing');
        results.failed++;
        results.errors.push({ message, error: error.message });
        onError(message, error);
        
        if (abortOnError) {
          results.aborted = true;
          break;
        }
        continue;
      }

      try {
        const vpn = config.vpn;
        
        if (sourceType === SOURCE_TYPE.QUEUE || sourceType === SOURCE_TYPE.BASIC) {
          await this.actionApiClient.deleteQueueMessage(config, vpn, sourceName, msgId);
        } else if (sourceType === SOURCE_TYPE.TOPIC) {
          await this.actionApiClient.deleteTopicEndpointMessage(config, vpn, sourceName, msgId);
        } else {
          throw new Error(`Unsupported source type: ${sourceType}`);
        }

        results.success++;
        onProgress(i + 1, messages.length, message);
      } catch (err) {
        console.error('Error deleting message:', err);
        const errorDetail = err.response?.body?.meta?.error?.description || 
                           err.message || 
                           'Unknown error occurred while deleting message.';
        
        const error = new Error(errorDetail);
        results.failed++;
        results.errors.push({ message, error: errorDetail });
        onError(message, error);
        
        if (abortOnError) {
          results.aborted = true;
          break;
        }
        
        onProgress(i + 1, messages.length, message);
      }
    }

    results.duration = Date.now() - startTime;
    return results;
  }

  /**
   * Execute bulk copy operation
   * @param {Array} messages - Array of message objects to copy
   * @param {string} destQueueName - Destination queue name
   * @param {Object} config - Broker configuration
   * @param {string} sourceName - Source queue name
   * @param {Object} options - Operation options
   * @returns {Promise<Object>} Operation results
   */
  async executeBulkCopy(messages, destQueueName, config, sourceName, options = {}) {
    const {
      onProgress = () => {},
      onError = () => {},
      abortOnError = false,
      cancelToken = null
    } = options;

    const results = {
      total: messages.length,
      success: 0,
      failed: 0,
      errors: [],
      aborted: false,
      duration: 0
    };

    const startTime = Date.now();
    const vpn = config.vpn;

    for (let i = 0; i < messages.length; i++) {
      // Check for cancellation
      if (cancelToken?.aborted) {
        results.aborted = true;
        break;
      }

      const message = messages[i];
      const replicationGroupMsgId = message.headers?.replicationGroupMsgId || message.meta?.replicationGroupMsgId;

      if (!replicationGroupMsgId) {
        const error = new Error('Replication Group Message ID is missing');
        results.failed++;
        results.errors.push({ message, error: error.message });
        onError(message, error);
        
        if (abortOnError) {
          results.aborted = true;
          break;
        }
        continue;
      }

      try {
        await this.actionApiClient.copyQueueMessage(
          config,
          vpn,
          destQueueName,
          replicationGroupMsgId,
          sourceName
        );

        results.success++;
        onProgress(i + 1, messages.length, message);
      } catch (err) {
        console.error('Error copying message:', err);
        const errorDetail = err.response?.body?.meta?.error?.description || 
                           err.message || 
                           'Unknown error occurred while copying message.';
        
        results.failed++;
        results.errors.push({ message, error: errorDetail });
        onError(message, new Error(errorDetail));
        
        if (abortOnError) {
          results.aborted = true;
          break;
        }
        
        onProgress(i + 1, messages.length, message);
      }
    }

    results.duration = Date.now() - startTime;
    return results;
  }

  /**
   * Execute bulk move operation (copy + delete)
   * @param {Array} messages - Array of message objects to move
   * @param {string} destQueueName - Destination queue name
   * @param {Object} config - Broker configuration
   * @param {string} sourceName - Source queue name
   * @param {Object} options - Operation options
   * @returns {Promise<Object>} Operation results
   */
  async executeBulkMove(messages, destQueueName, config, sourceName, options = {}) {
    const {
      onProgress = () => {},
      onError = () => {},
      abortOnError = false,
      cancelToken = null
    } = options;

    const results = {
      total: messages.length,
      success: 0,
      failed: 0,
      partialFailures: 0, // Copy succeeded but delete failed
      errors: [],
      partialErrors: [], // Copy succeeded, delete failed
      aborted: false,
      duration: 0
    };

    const startTime = Date.now();
    const vpn = config.vpn;

    for (let i = 0; i < messages.length; i++) {
      // Check for cancellation
      if (cancelToken?.aborted) {
        results.aborted = true;
        break;
      }

      const message = messages[i];
      const replicationGroupMsgId = message.headers?.replicationGroupMsgId || message.meta?.replicationGroupMsgId;
      const msgId = message.meta?.msgId;

      if (!replicationGroupMsgId) {
        const error = new Error('Replication Group Message ID is missing');
        results.failed++;
        results.errors.push({ message, error: error.message });
        onError(message, new Error(error.message));
        
        if (abortOnError) {
          results.aborted = true;
          break;
        }
        continue;
      }

      try {
        // Step 1: Copy to destination
        await this.actionApiClient.copyQueueMessage(
          config,
          vpn,
          destQueueName,
          replicationGroupMsgId,
          sourceName
        );

        // Step 2: Delete from source (if msgId available)
        if (!msgId) {
          const error = new Error('Message ID is missing. Message was copied but not deleted from source.');
          results.partialFailures++;
          results.partialErrors.push({ message, error: error.message });
          onError(message, new Error(error.message));
          
          if (abortOnError) {
            results.aborted = true;
            break;
          }
          
          onProgress(i + 1, messages.length, message);
          continue;
        }

        try {
          await this.actionApiClient.deleteQueueMessage(config, vpn, sourceName, msgId);
          results.success++;
        } catch (deleteErr) {
          console.error('Error deleting message after copy:', deleteErr);
          const deleteErrorDetail = deleteErr.response?.body?.meta?.error?.description || 
                                  deleteErr.message || 
                                  'Unknown error occurred while deleting message.';
          
          results.partialFailures++;
          results.partialErrors.push({ 
            message, 
            error: `Message was copied to ${destQueueName}, but failed to delete from source: ${deleteErrorDetail}` 
          });
          onError(message, new Error(deleteErrorDetail));
          
          if (abortOnError) {
            results.aborted = true;
            break;
          }
        }

        onProgress(i + 1, messages.length, message);
      } catch (copyErr) {
        console.error('Error copying message:', copyErr);
        const copyErrorDetail = copyErr.response?.body?.meta?.error?.description || 
                               copyErr.message || 
                               'Unknown error occurred while copying message.';
        
        results.failed++;
        results.errors.push({ message, error: copyErrorDetail });
        onError(message, new Error(copyErrorDetail));
        
        if (abortOnError) {
          results.aborted = true;
          break;
        }
        
        onProgress(i + 1, messages.length, message);
      }
    }

    results.duration = Date.now() - startTime;
    return results;
  }
}

