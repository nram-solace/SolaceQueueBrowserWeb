import solace from 'solclientjs';

const { SolclientFactory } = solace;

const factoryProps = new solace.SolclientFactoryProperties();
factoryProps.profile = solace.SolclientFactoryProfiles.version10_5;
solace.SolclientFactory.init(factoryProps);
solace.SolclientFactory.setLogLevel(solace.LogLevel.ERROR);

(() => {
  function createOperationError(type, errorStr) {
    return new solace.OperationError(`Invalid ${type}: ${errorStr}`, ErrorSubcode.INVALID_TOPIC_SYNTAX);
  }

  const { DestinationUtil } = solace._internal.Destination;
  const {
    encode,
    legacyValidate,
  } = DestinationUtil;

  function validateAndEncode(type, name, exceptionCreator = createOperationError.bind(null, type)) {
    const { bytes, offset } = encode(type, name);
    const { error: constError, isWildcarded } = legacyValidate(type, bytes, name, exceptionCreator);
    let error = constError;
    let subscriptionInfo = {};
    subscriptionInfo.isWildcarded = isWildcarded;

    return { bytes, offset, error, isWildcarded, subscriptionInfo };
  }

  Object.assign(DestinationUtil, { validateAndEncode });
})();

function createAsyncSession(sessionProperties) {
  const session = SolclientFactory.createSession(sessionProperties);

  const {
    connect,
    provisionEndpoint,
    createMessageConsumer,
    createQueueBrowser
  } = session;

  function connectAsync() {
    return new Promise((onUpNotice, onConnectFailed) => {
      session.once(solace.SessionEventCode.UP_NOTICE, onUpNotice);
      session.once(solace.SessionEventCode.CONNECT_FAILED_ERROR, onConnectFailed);
      connect.call(session);
    });
  }

  function provisionEndpointAsync(...args) {
    return new Promise((onProvisionOk) => {
      session.once(solace.SessionEventCode.PROVISION_OK, onProvisionOk);
      provisionEndpoint.call(session, ...args);
    });
  }

  function createAsyncMessageConsumer(...args) {
    const messageConsumer = createMessageConsumer.call(session, ...args);

    const {
      addSubscription
    } = messageConsumer;

    function addSubscriptionAsync(...args) {
      return new Promise((resolve, reject) => {
        const [_, correlationKey, __] = args;
        const { SUBSCRIPTION_OK, SUBSCRIPTION_ERROR } = solace.MessageConsumerEventName;

        let onOk, onError;
        const createHandler = execute => evt => {
          if (evt.correlationKey !== correlationKey) {
            return;
          }
          messageConsumer.removeListener(SUBSCRIPTION_OK, onOk);
          messageConsumer.removeListener(SUBSCRIPTION_ERROR, onError);
          execute(evt);
        };

        onOk = createHandler(resolve);
        onError = createHandler(reject);

        messageConsumer.on(SUBSCRIPTION_OK, onOk);
        messageConsumer.on(SUBSCRIPTION_ERROR, onError);

        addSubscription.call(messageConsumer, ...args);
      });
    }

    return Object.assign(messageConsumer, {
      addSubscription: addSubscriptionAsync
    });
  }

  function createAyncQueueBrowser(...args) {
    const queueBrowser = createQueueBrowser.call(session, ...args);

    const { connect } = queueBrowser;

    function connectAsync() {
      return new Promise((onBrowserUp, onBrowserError) => {
        let resolved = false;
        
        const cleanup = () => {
          queueBrowser.removeListener(solace.QueueBrowserEventName.UP, handleUp);
          queueBrowser.removeListener(solace.QueueBrowserEventName.CONNECT_FAILED_ERROR, handleConnectError);
          queueBrowser.removeListener(solace.QueueBrowserEventName.DOWN_ERROR, handleDownError);
        };
        
        const handleUp = () => {
          if (!resolved) {
            resolved = true;
            cleanup();
            onBrowserUp();
          }
        };
        
        const handleConnectError = (errorEvent) => {
          if (!resolved) {
            resolved = true;
            cleanup();
            handleError(errorEvent, 'Connection failed');
          }
        };
        
        const handleDownError = (errorEvent) => {
          if (!resolved) {
            resolved = true;
            cleanup();
            handleError(errorEvent, 'Disconnected due to error');
          }
        };
        
        const handleError = (errorEvent, errorType) => {
          // Extract error information
          const errorInfo = errorEvent.info || {};
          const errorStr = errorEvent.str || errorEvent.message || errorEvent.toString() || '';
          const responseCode = errorEvent.responseCode;
          
          // Check for permission errors
          const isPermissionError = 
            errorStr.includes('Permission Not Allowed') ||
            (errorStr.includes('Permission') && errorStr.includes('Not Allowed')) ||
            responseCode === solace.SolclientErrorSubcode.INVALID_OPERATION ||
            (errorInfo && errorInfo.reason && errorInfo.reason.includes('Permission'));
          
          if (isPermissionError) {
            const error = new Error(`Permission Not Allowed: The messaging user does not have permissions to browse this Queue.`);
            error.isPermissionError = true;
            error.originalError = errorEvent;
            onBrowserError(error);
          } else {
            // For other errors, create a generic error
            const error = new Error(errorStr || `${errorType}: ${responseCode || 'Unknown error'}`);
            error.originalError = errorEvent;
            onBrowserError(error);
          }
        };
        
        queueBrowser.once(solace.QueueBrowserEventName.UP, handleUp);
        queueBrowser.once(solace.QueueBrowserEventName.CONNECT_FAILED_ERROR, handleConnectError);
        queueBrowser.once(solace.QueueBrowserEventName.DOWN_ERROR, handleDownError);
        connect.call(queueBrowser);
      });
    }

    function readMessagesAsync(count, timeout) {
      return new Promise((resolve) => {
        const messages = [];
        let onMessage, onMessageTimeout, messageTimeout;

        const stopAndResolve = () => {
          queueBrowser.stop();
          queueBrowser.removeListener(solace.QueueBrowserEventName.MESSAGE, onMessage);
          resolve(messages);
        }

        onMessageTimeout = () => {
          console.warn('Timeout waiting for messages');
          stopAndResolve();
        };

        onMessage = (msg) => {
          messages.push(msg);
          clearTimeout(messageTimeout);
          if (messages.length >= count) {
            stopAndResolve();
            return;
          }
          messageTimeout = setTimeout(onMessageTimeout, timeout);
        }

        messageTimeout = setTimeout(onMessageTimeout, timeout);

        queueBrowser.on(solace.QueueBrowserEventName.MESSAGE, onMessage);
        queueBrowser.start();
      });
    }

    // Change default status of browser
    queueBrowser.stop();

    return Object.assign(queueBrowser, {
      connect: connectAsync,
      readMessages: readMessagesAsync
    });
  }

  return Object.assign(session, {
    connect: connectAsync,
    provisionEndpoint: provisionEndpointAsync,
    createMessageConsumer: createAsyncMessageConsumer,
    createQueueBrowser: createAyncQueueBrowser
  });
}

Object.assign(SolclientFactory, {
  createAsyncSession
});

export default solace;