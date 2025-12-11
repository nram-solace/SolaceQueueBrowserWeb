import { useState } from "react";
import solace from '../utils/solace/solclientasync';

import { useSempApi } from "../providers/SempClientProvider";

const PAGE_SIZE = 100;
const MIN_MSG_ID = 1n;
const MAX_MSG_ID = 9223372036854775808n;

// Special constant to indicate binary payload that cannot be retrieved
export const BINARY_PAYLOAD_NOT_AVAILABLE = '__BINARY_PAYLOAD_NOT_AVAILABLE__';

export const SOURCE_TYPE = {
  BASIC: 'basic',
  QUEUE: 'queue',
  TOPIC: 'topic'
};

export const BROWSE_MODE = {
  BASIC: 'basic',
  HEAD: 'head',
  TAIL: 'tail',
  TIME: 'time',
  MSGID: 'msgid'
};

export const SUPPORTED_BROWSE_MODES = {
  [SOURCE_TYPE.BASIC]: [
    BROWSE_MODE.BASIC
  ],
  [SOURCE_TYPE.QUEUE]: [
    BROWSE_MODE.BASIC,
    BROWSE_MODE.HEAD,
    BROWSE_MODE.TAIL,
    BROWSE_MODE.TIME,
    BROWSE_MODE.MSGID
  ],
  [SOURCE_TYPE.TOPIC]: [
    BROWSE_MODE.TIME,
    BROWSE_MODE.MSGID
  ]
}

export const MESSAGE_ORDER = {
  OLDEST: 'oldest',   // Forward Browsing
  NEWEST: 'newest'    // Reverse Browsing
};

const BROWSER_STATE = {
  CLOSED: 'closed',
  OPENING: 'opening',
  OPEN: 'open',
  CLOSING: 'closing'
};
 
class BaseBrowser {
  constructor({ sourceDefinition, startFrom, sempApi, solclientFactory } = {}) {
    this.instanceId = `${this.constructor.name} ${Math.random().toString().substring(2,6)}`;
    // Specific browser instance behavior
    this.sourceDefinition = sourceDefinition;
    this.startFrom = startFrom;

    // Core API
    this.sempApi = sempApi;
    this.solclientFactory = solclientFactory;

    // Defined in open()
    this.vpn = undefined;
    this.sempClient = undefined;
    this.session = undefined;
    this.replayLogName = undefined;
    this.topics = undefined;

    // Page management
    this.nextPage = null;
    this.prevPages = [];
    this.pageSize = PAGE_SIZE;

    this.state = BROWSER_STATE.CLOSED;
  }

  async checkBrowsePermissions() {
    const { sourceName, config, type } = this.sourceDefinition || {};
    const { clientUsername } = config || {};
    
    // Only check permissions for QUEUE type (not topics or basic sources)
    // BASIC type might be a queue but we'll let the actual browse operation handle permissions
    if (type !== SOURCE_TYPE.QUEUE || !sourceName || !this.sempClient) {
      return; // Skip check for non-queue sources or if no queue name/SEMP client
    }

    try {
      // Get queue details including owner and permission
      const { data: queue } = await this.sempClient.getMsgVpnQueue(
        this.vpn, 
        sourceName, 
        { select: ['owner', 'permission'] }
      );

      if (!queue) {
        return; // Skip check if queue details not available
      }

      const { owner, permission } = queue;
      const isOwner = (owner === clientUsername);

      // If user is not the owner and permission is "no-access", deny browsing
      if (!isOwner && permission === 'no-access') {
        throw new Error(
          `Access denied: You do not have browse permissions on queue "${sourceName}". ` +
          `Queue owner: ${owner || 'unknown'}, Permission: ${permission}. ` +
          `Message listing via SEMP may work, but browsing message contents requires browse permissions.`
        );
      }

      // Note: "read-only" permission allows browsing but not consuming
      // "consume", "modify-topic", and "delete" also allow browsing
    } catch (err) {
      // If it's our permission error, re-throw it
      if (err.message && err.message.includes('Access denied')) {
        throw err;
      }
      // For other errors (e.g., queue not found), log but don't block
      // The actual browse operation will fail with a more specific error
      console.warn('Could not verify queue permissions:', err);
    }
  }

  async open() {
    this.assertState(BROWSER_STATE.CLOSED);
    this.state = BROWSER_STATE.OPENING;

    const { sourceName, config, topics } = this.sourceDefinition || {};
    const {
      hostName, clientPort, useTls, vpn,
      clientUsername, clientPassword
    } = config || {};

    this.vpn = vpn;

    if (this.sempApi) {
      this.sempClient = this.sempApi?.getClient(config);
    }

    // Note: We don't pre-check permissions via SEMP because:
    // 1. SEMP permissions may not match broker's actual bind-time permission checks
    // 2. The broker will reject the connection if permissions are insufficient
    // 3. Pre-checking can cause false positives (e.g., queue has "consume" permission but broker initially rejects)
    // We rely on the broker's actual response to determine permission errors

    if (this.solclientFactory) {
      this.session = this.solclientFactory.createAsyncSession({
        url: `${(useTls ? 'wss' : 'ws')}://${hostName}:${clientPort}`,
        vpnName: this.vpn,
        userName: clientUsername,
        password: clientPassword
      });
    }

    const { data: [{ replayLogName } = {}] } = await this.sempClient.getMsgVpnReplayLogs(this.vpn, { select: ['replayLogName'] });
    this.replayLogName = replayLogName;

    this.assertState(BROWSER_STATE.OPENING);

    if (topics) {
      this.topics = topics;
    } else {
      const { data: { networkTopic } } = await this.sempClient.getMsgVpnQueue(this.vpn, sourceName, { select: ['networkTopic'] });
      const { data: subscriptions } = await this.sempClient.getMsgVpnQueueSubscriptions(this.vpn, sourceName);

      this.topics = [
        networkTopic,
        ...subscriptions.map(s => s.subscriptionTopic)
      ];
    }

    this.assertState(BROWSER_STATE.OPENING);
    this.state = BROWSER_STATE.OPEN;
  }

  async close() { 
    this.state = BROWSER_STATE.CLOSED;
    this.assertState(BROWSER_STATE.CLOSED);
  }


  assertState(state) {
    if(this.state !== state) {
      throw new Error(`[${this.instanceId}] Invalid state: expected '${state}', current value '${this.state}'`);
    }
  }

  getFirstPage() {
    this.prevPages.length = 0;
    return this.getPage(this.startFrom);
  }

  getNextPage() {
    return this.getPage(this.nextPage);
  }

  getPrevPage() {
    this.prevPages.pop();
    return this.getPage(this.prevPages.pop())
  }

  hasNextPage() {
    return (this.nextPage !== null);
  }

  hasPrevPage() {
    return (this.prevPages.length > 1);
  }

  async getPage(page) {
    return [];
  }

  async getMessageMetaData({ queueName, fromMsgId = null, direction, count = this.pageSize }) {
    const cursor = (fromMsgId !== null) ? [
      `<rpc><show><queue>`,
      `<name>${queueName}</name>`,
      `<vpn-name>${this.vpn}</vpn-name>`,
      `<messages/><${direction}/>`,
      `<msg-id>${fromMsgId}</msg-id>`,
      `<detail/><count/>`,
      `<num-elements>${count}</num-elements>`,
      `</queue></show></rpc>`
    ].join('') : undefined;

    const { data: msgMetaData } = await this.sempClient
      .getMsgVpnQueueMsgs(this.vpn, queueName, { cursor, count });

    return msgMetaData;
  }

  async replayToTempQueue({ sourceName, replayFrom, count = this.pageSize}) {
    await this.session.connect();

    const tempQueueName = `#QB/${sourceName}/${Date.now()}`;
    const queueDescriptor = { name: tempQueueName, type: solace.QueueType.QUEUE };

    await this.session.provisionEndpoint(queueDescriptor, {}, true);

    const messageConsumer = this.session.createMessageConsumer({
      queueDescriptor,
      acknowledgeMode: solace.MessageConsumerAcknowledgeMode.CLIENT,
      windowSize: 1,
      replayStartLocation:
        replayFrom?.afterMsg ? this.solclientFactory.createReplicationGroupMessageId(replayFrom.afterMsg) :
          replayFrom?.fromTime ? this.solclientFactory.createReplayStartLocationDate(new Date(replayFrom.fromTime * 1000)) :
            replayFrom ? this.solclientFactory.createReplayStartLocationBeginning() :
              null
    });

    await Promise.all(this.topics.map(topic => (
      messageConsumer.addSubscription(
        this.solclientFactory.createTopicDestination(topic),
        topic,
        2000
      )))
    );

    // Trigger Replay
    messageConsumer.connect();
    messageConsumer.disconnect();

    const queueBrowser = this.session.createQueueBrowser({ queueDescriptor });
    const [, messages] = await Promise.all([
      queueBrowser.connect(),
      queueBrowser.readMessages(count, 500)
    ]);
    queueBrowser.disconnect();

    return {
      messages,
      tempQueueName,
      cleanupReplay: () => {
        this.session.deprovisionEndpoint(queueDescriptor);
        this.session.disconnect();
      }
    };
  }

  async getQueueReplayFrom({ messageId }) {
    try {
      const cursor = [
        `<rpc><show><replay-log>`,
        `<name>${this.replayLogName}</name>`,
        `<vpn-name>${this.vpn}</vpn-name>`,
        `<messages/><newest/>`,
        `<msg-id>${messageId}</msg-id>`,
        `<detail/>`,
        `<num-elements>2</num-elements>`,
        `</replay-log></show></rpc>`,
      ].join('');

      const { data: msgMetaData } = await this.sempClient
        .getMsgVpnReplayLogMsgs(this.vpn, this.replayLogName, { cursor, count: 2 });
      const [, nextOldestMessage] = msgMetaData;
      if (!nextOldestMessage?.replicationGroupMsgId) {
        throw new Error('No suitable RGMID found');
      }
      return ({
        afterMsg: nextOldestMessage.replicationGroupMsgId
      });
    } catch (ex) {
      // This is expected when replay log doesn't have the message yet (e.g., after move/delete operations)
      // Fallback to replaying from beginning of time works correctly
      console.debug('Unable to find a suitable RGMID to start from. Will replay from beginning of time.', ex);
      return {};
    }
  }

  async getReplayTimeRange() {
    if(!this.replayLogName) {
      return { max: null, min: null };
    }
    try {
      const minMaxSpooledTime = await Promise.all([
        this.sempClient.getMsgVpnReplayLogMsgs(this.vpn, this.replayLogName, {
          cursor: [
            `<rpc><show><replay-log>`,
            `<name>${this.replayLogName}</name>`,
            `<vpn-name>${this.vpn}</vpn-name>`,
            `<messages/><oldest/>`,
            `<msg-id>${MIN_MSG_ID}</msg-id>`,
            `<detail/>`,
            `<num-elements>1</num-elements>`,
            `</replay-log></show></rpc>`,
          ].join(''),
          select: ['spooledTime'],
          count: 1
        }).then(({ data: [{ spooledTime }] }) => ['min', spooledTime]).catch(() => ['min', null]),
        this.sempClient.getMsgVpnReplayLogMsgs(this.vpn, this.replayLogName, {
          cursor: [
            `<rpc><show><replay-log>`,
            `<name>${this.replayLogName}</name>`,
            `<vpn-name>${this.vpn}</vpn-name>`,
            `<messages/><newest/>`,
            `<msg-id>${MAX_MSG_ID}</msg-id>`,
            `<detail/>`,
            `<num-elements>1</num-elements>`,
            `</replay-log></show></rpc>`,
          ].join(''),
          select: ['spooledTime'],
          count: 1
        }).then(({ data: [{ spooledTime }] }) => ['max', spooledTime]).catch(() => ['max', null]),
      ]);
      return Object.fromEntries(minMaxSpooledTime);
    } catch (ex) {
      return { min: null, max: null };
    }
  }

  extractPayload(msg, expectedAttachmentSize = 0) {
    // Original simple approach - try SDT container first, then binary attachment with toString()
    // This preserves the original working behavior
    const sdtValue = msg.getSdtContainer()?.getValue();
    if (sdtValue !== null && sdtValue !== undefined) {
      return sdtValue;
    }

    // Try binary attachment with original toString() approach
    const binaryAttachment = msg.getBinaryAttachment();
    if (binaryAttachment !== null && binaryAttachment !== undefined) {
      // If it's already a string, return it
      if (typeof binaryAttachment === 'string') {
        return binaryAttachment;
      }
      
      // Try the original toString() method first (this was working before)
      try {
        const str = binaryAttachment.toString();
        // Only reject if it's clearly an object representation, not actual content
        if (str && !str.startsWith('[object ')) {
          return str;
        }
      } catch (e) {
        // toString() failed, try enhanced decoding
      }
      
      // Enhanced handling for binary types (ArrayBuffer, Uint8Array) - for STM feeds
      // Only do this if toString() didn't work
      if (binaryAttachment instanceof ArrayBuffer) {
        try {
          return new TextDecoder('utf-8', { fatal: false }).decode(binaryAttachment);
        } catch (e) {
          // Fall through to return empty
        }
      } else if (binaryAttachment instanceof Uint8Array) {
        try {
          return new TextDecoder('utf-8', { fatal: false }).decode(binaryAttachment);
        } catch (e) {
          // Fall through to return empty
        }
      } else if (Array.isArray(binaryAttachment)) {
        try {
          const uint8Array = new Uint8Array(binaryAttachment);
          return new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
        } catch (e) {
          // Fall through to return empty
        }
      } else if (binaryAttachment.buffer && binaryAttachment.buffer instanceof ArrayBuffer) {
        try {
          return new TextDecoder('utf-8', { fatal: false }).decode(binaryAttachment.buffer);
        } catch (e) {
          // Fall through to return empty
        }
      }
    } else if (expectedAttachmentSize > 0) {
      // Log warning if we expected an attachment but didn't get one
      // This is a known limitation: queue browser may not be able to retrieve binary attachments
      // for certain message types. Return special indicator so UI can show appropriate message.
      console.warn(`WARNING: Metadata shows attachmentSize=${expectedAttachmentSize} but getBinaryAttachment() returned null/undefined. This may indicate queue browser limitation. Message will be displayed with empty payload.`);
      return BINARY_PAYLOAD_NOT_AVAILABLE;
    }

    // No payload found - return empty string (original behavior)
    // Messages with empty payloads should still be displayed in the UI
    return '';
  }

  merge({ messages, msgMetaData }) {
    // Create index by replicationGroupMsgId (primary key)
    const messageIdx = new Map(msgMetaData.map(meta => ([meta.replicationGroupMsgId, { meta, headers: {}, userProperties: {}, payload: '' }])));
    
    // Also create a fallback index by msgId for messages that might not have replicationGroupMsgId
    const messageIdxByMsgId = new Map(msgMetaData.map(meta => {
      if (meta.msgId && meta.replicationGroupMsgId) {
        return [meta.msgId, meta.replicationGroupMsgId];
      }
      return null;
    }).filter(Boolean));
    
    messages.forEach(msg => {
      const replicationGroupMsgId = msg.getReplicationGroupMessageId()?.toString();
      const guaranteedMessageId = msg.getGuaranteedMessageId()?.low;
      
      // Try to find matching metadata entry
      let metaData = null;
      let attachmentSize = 0;
      
      if (replicationGroupMsgId) {
        // Primary match: by replicationGroupMsgId
        metaData = messageIdx.get(replicationGroupMsgId);
        if (metaData) {
          attachmentSize = metaData.meta?.attachmentSize || 0;
        }
      }
      
      // Fallback match: by msgId if replicationGroupMsgId match failed
      if (!metaData && guaranteedMessageId) {
        const matchingRgmid = messageIdxByMsgId.get(guaranteedMessageId);
        if (matchingRgmid) {
          metaData = messageIdx.get(matchingRgmid);
          if (metaData) {
            attachmentSize = metaData.meta?.attachmentSize || 0;
          }
        }
      }
      
      // If still no match, try to find any metadata entry with matching msgId
      if (!metaData && guaranteedMessageId) {
        for (const [rgmid, entry] of messageIdx.entries()) {
          if (entry.meta?.msgId === guaranteedMessageId) {
            metaData = entry;
            attachmentSize = entry.meta?.attachmentSize || 0;
            break;
          }
        }
      }
      
      // Extract payload (this will log warnings if attachment can't be retrieved)
      const payload = this.extractPayload(msg, attachmentSize);
      
      const msgObj = {
        payload: payload,
        headers: {
          destination: msg.getDestination()?.getName() || '',
          replicationGroupMsgId: replicationGroupMsgId || metaData?.meta?.replicationGroupMsgId || '',
          guaranteedMessageId: guaranteedMessageId,
          applicationMessageId: msg.getApplicationMessageId(),
          applicationMessageType: msg.getApplicationMessageType(),
          correlationId: msg.getCorrelationId(),
          deliveryMode: ['Direct', 'Persistent', 'Non-Persistent'][msg.getDeliveryMode()],
          replyTo: msg.getReplyTo(),
          senderId: msg.getSenderId(),
          senderTimestamp: msg.getSenderTimestamp(),
          sequenceNumber: msg.getSequenceNumber()
        },
        userProperties: Object.fromEntries((msg.getUserPropertyMap()?.getKeys() || []).map(key => {
          return [key, msg.getUserPropertyMap().getField(key).getValue()]
        }))
      };
      
      if (metaData) {
        // Update existing metadata entry with message data
        Object.assign(metaData, msgObj);
      } else {
        // Message exists but no metadata - add it with minimal structure
        // Use replicationGroupMsgId if available, otherwise create a placeholder
        const key = replicationGroupMsgId || `msg-${guaranteedMessageId || Date.now()}`;
        messageIdx.set(key, {
          meta: { 
            replicationGroupMsgId: replicationGroupMsgId || '',
            msgId: guaranteedMessageId,
            attachmentSize: attachmentSize
          },
          ...msgObj
        });
      }
    });
    
    // Return all entries - this includes:
    // 1. Metadata entries that were matched with messages
    // 2. Metadata entries that had no matching message (will have empty payload/headers but metadata)
    // 3. Messages that had no matching metadata (will have message data but minimal metadata)
    return [...messageIdx.values()];
  }
}

class LoggedMessagesReplayBrowser extends BaseBrowser {
  constructor({ sourceDefinition, startFrom, sempApi, solclientFactory }) {
    super({ sourceDefinition, sempApi, solclientFactory });
    this.startFrom = startFrom;
  }

  async getPage(page) {
    const { fromMsgId, fromTime } = page || {};
    const { sourceName } = this.sourceDefinition;
    const count = this.pageSize;

    // Determine replayFrom based on what's in the page parameter
    let replayFrom;
    if (fromMsgId) {
      // MSGID mode: Try to convert message ID to RGMID for replay positioning
      replayFrom = await this.getQueueReplayFrom({ messageId: fromMsgId });
    } else if (fromTime !== undefined && fromTime !== null) {
      // TIME mode: Use fromTime directly
      replayFrom = { fromTime };
    } else {
      // No specific start point, use page as-is (might be empty object for beginning)
      replayFrom = page || {};
    }

    const { tempQueueName, messages, cleanupReplay } = await this.replayToTempQueue({ sourceName, replayFrom });
    const msgMetaData =
      await this.getMessageMetaData({
        queueName: tempQueueName,
        fromMsgId: fromMsgId || null,
        direction: MESSAGE_ORDER.OLDEST,
        count
      });

    const { data: tempQueue } = await this.sempClient.getMsgVpnQueue(this.vpn, tempQueueName);
    cleanupReplay();

    if (msgMetaData.length === 0) {
      return [];
    }

    const highestMsgId = msgMetaData[msgMetaData.length - 1]?.msgId;

    this.nextPage =
      (tempQueue.spooledMsgCount > count) ? ({ fromMsgId: highestMsgId + 1 }) : null;
    this.prevPages.push({ fromMsgId: fromMsgId || null });

    return this.merge({ messages, msgMetaData });
  }
}

class QueuedMessagesReplayBrowser extends BaseBrowser {
  constructor({ sourceDefinition, startFrom, sempApi, solclientFactory }) {
    const messageOrderBy = startFrom?.queuePosition;
    const isReversed = (messageOrderBy === MESSAGE_ORDER.NEWEST);

    super({
      sourceDefinition,
      startFrom: { fromMsgId: isReversed ? MAX_MSG_ID : MIN_MSG_ID },
      sempApi,
      solclientFactory
    });

    this.messageOrderBy = messageOrderBy;
    this.isReversed = isReversed;
  }

  async getPage(page) {
    const { fromMsgId } = page || {};
    const { sourceName } = this.sourceDefinition;
    const count = this.pageSize;
    const msgMetaData =
      await this.getMessageMetaData({
        queueName: sourceName,
        fromMsgId,
        direction: this.messageOrderBy,
        count
      });
    if (msgMetaData.length === 0) {
      return [];
    }

    const { data: queue } = await this.sempClient.getMsgVpnQueue(this.vpn, sourceName);

    const lowestMsgId = msgMetaData[this.isReversed ? (msgMetaData.length - 1) : 0].msgId;
    const highestMsgId = msgMetaData[this.isReversed ? 0 : (msgMetaData.length - 1)].msgId;

    const replayFrom = await this.getQueueReplayFrom({ messageId: lowestMsgId });
    const { messages, cleanupReplay } = await this.replayToTempQueue({ sourceName, replayFrom, count: msgMetaData.length });
    cleanupReplay();

    this.nextPage = this.isReversed ?
      ((lowestMsgId > queue.lowestMsgId) ? ({ fromMsgId: lowestMsgId - 1 }) : null) :
      ((highestMsgId < queue.highestMsgId) ? ({ fromMsgId: highestMsgId + 1 }) : null);
    this.prevPages.push({ fromMsgId });

    return this.merge({ messages, msgMetaData });
  }
}

class BasicQueueBrowser extends BaseBrowser {
  constructor({ sourceDefinition, sempApi, solclientFactory }) {
    super({ sourceDefinition, sempApi, solclientFactory });

    this.didReadMessages = false;
  }

  async open() {
    const { sourceName: queueName, config } = this.sourceDefinition;
    const { clientUsername } = config || {};

    await super.open();
    this.state = BROWSER_STATE.OPENING; // reset OPEN state to continue async operations
    
    await this.session.connect();
    this.assertState(BROWSER_STATE.OPENING);

    const queueDescriptor = { name: queueName, type: solace.QueueType.QUEUE };
    
    // Retry logic to handle transient connection failures
    // Some brokers may initially reject the connection but allow it on retry
    const maxRetries = 2;
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.queueBrowser = this.session.createQueueBrowser({ queueDescriptor });
        await this.queueBrowser.connect();
        // Success - break out of retry loop
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        
        // Check if this is a permission error from the broker - be specific to avoid false positives
        // Only treat as permission error if explicitly "Permission Not Allowed"
        const isPermissionError = err.isPermissionError || 
            (err.message && err.message.includes('Permission Not Allowed'));
        
        if (isPermissionError) {
          // Permission errors are definitive - don't retry
          const username = clientUsername || 'unknown';
          throw new Error(`The messaging user "${username}" does not have permissions to browse this Queue.`);
        }
        
        // For other errors, retry if we have attempts left
        if (attempt < maxRetries) {
          // Wait a bit before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
          continue;
        }
        
        // Out of retries - throw the last error
        throw err;
      }
    }
    
    this.assertState(BROWSER_STATE.OPENING);
    this.nextPage = null; // Will be set in getPage() based on actual message count

    this.state = BROWSER_STATE.OPEN;
  }
  async close() {
    this.state = BROWSER_STATE.CLOSING;

    this.queueBrowser?.disconnect();
    this.session?.disconnect();

    this.assertState(BROWSER_STATE.CLOSING);
    this.state = BROWSER_STATE.CLOSED;
  }

  async getPage() {
    const { sourceName: queueName } = this.sourceDefinition;
    const messages = await this.queueBrowser.readMessages(this.pageSize, 500);

    if (messages.length === 0) {
      this.nextPage = null; // No more messages
      return [];
    }
    const fromMsgId = messages[0].getGuaranteedMessageId()?.low;
    const msgMetaData =
      await this.getMessageMetaData({
        queueName,
        fromMsgId,
        direction: MESSAGE_ORDER.OLDEST,
        count: messages.length
      });
    
    // If we got fewer messages than the page size, there are no more pages
    // Otherwise, there might be more (set to true to indicate potential next page)
    this.nextPage = (messages.length < this.pageSize) ? null : true;
    
    this.didReadMessages = true;
    return this.merge({ messages, msgMetaData });
  }

  async getFirstPage() {
    if(this.didReadMessages) {
      await this.close();
      await this.open();
      this.didReadMessages = false;
    }
    return await this.getPage();
  }
}

class NullBrowser extends BaseBrowser{
  async open() {}
  async close() {}
  async getPage() {return []};
  async getFirstPage() {return []};
  async getReplayTimeRange() {return { min: null, max: null }; }
}

class ErrorBrowser extends BaseBrowser {
  constructor(error) {
    super();
    this.error = error;
  }
  
  async open() {}
  async close() {}
  async getPage() {
    throw this.error;
  }
  async getFirstPage() {
    throw this.error;
  }
  async getReplayTimeRange() {
    return { min: null, max: null };
  }
}

const NULL_BROWSER = new NullBrowser();

export function useQueueBrowsing() {
  const [browser, setBrowser] = useState(NULL_BROWSER);
  const sempApi = useSempApi();

  const updateBrowser = async (sourceDefinition, browseFrom) => {
    const solclientFactory = solace.SolclientFactory;
    const { type } = sourceDefinition;
    const { browseMode, startFrom = {}} = browseFrom;


    const newBrowser = (type) ? (
      (browseMode === BROWSE_MODE.BASIC || type === SOURCE_TYPE.BASIC) ?
        new BasicQueueBrowser({ sourceDefinition, startFrom, sempApi, solclientFactory }) :
        (browseMode === BROWSE_MODE.HEAD || browseMode === BROWSE_MODE.TAIL) ?
          new QueuedMessagesReplayBrowser({ sourceDefinition, startFrom, sempApi, solclientFactory }) :
          new LoggedMessagesReplayBrowser({ sourceDefinition, startFrom, sempApi, solclientFactory })
    ) : NULL_BROWSER;
    
    try {
      await browser?.close();
    } catch (err) {
      console.error('Error closing browser', err);
    }
    try {
      await newBrowser?.open();
      setBrowser(newBrowser);
    } catch (err) {
      // Check if this is a permission error (expected behavior, user will be notified via popup)
      // Be specific - only treat as permission error if explicitly about permissions
      const errorMessage = err.message || String(err);
      const isPermissionError = 
        errorMessage.includes('does not have permissions') ||
        errorMessage.includes('Permission Not Allowed') ||
        errorMessage.includes('Access denied');
      
      if (isPermissionError) {
        // Permission errors are expected and user is notified via popup, so log at debug level
        console.debug('Permission error (user will be notified via popup):', errorMessage);
      } else {
        // Log unexpected errors at error level
        console.error('Error opening browser', err);
      }
      
      // Store the error in an ErrorBrowser so it can be thrown when getFirstPage() is called
      // Ensure the error message is preserved
      const errorToStore = err instanceof Error ? err : new Error(errorMessage);
      setBrowser(new ErrorBrowser(errorToStore));
    }
  }

  return [browser, updateBrowser];
}