/**
 * Helpers for SEMP v2 cursor-based paging.
 *
 * SEMP collections return `meta.paging.cursorQuery` when additional pages exist.
 * That field is either:
 * - an opaque cursor value, or
 * - a query string containing `cursor=<opaque>` (and possibly other params)
 *
 * This file provides a small, defensive paginator so the UI can fetch "all queues".
 */
function normalizeCursor(cursorQuery) {
  if (!cursorQuery) return null;

  // If SEMP returns a query string, extract the cursor parameter value.
  if (typeof cursorQuery === 'string' && cursorQuery.includes('cursor=')) {
    const q = cursorQuery.startsWith('?') ? cursorQuery.slice(1) : cursorQuery;
    try {
      const cursor = new URLSearchParams(q).get('cursor');
      return cursor || null;
    } catch {
      // Fall through to treat it as an opaque cursor.
    }
  }

  return cursorQuery;
}

async function getAllPages({ fetchPage, pageSize = 100, maxPages = 10000 }) {
  const items = [];
  const seenCursors = new Set();

  let cursor = undefined;
  for (let page = 0; page < maxPages; page++) {
    const resp = await fetchPage({ cursor, count: pageSize });
    if (Array.isArray(resp?.data)) {
      items.push(...resp.data);
    }

    const nextCursor = normalizeCursor(resp?.meta?.paging?.cursorQuery);
    if (!nextCursor) {
      break;
    }

    // Protect against buggy/looping cursors.
    if (seenCursors.has(nextCursor)) {
      throw new Error('SEMP paging loop detected (cursor repeated)');
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;

    // Yield to the browser event loop between pages to keep UI responsive.
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 0));
  }

  return items;
}

export async function getAllMsgVpnQueues(sempClient, msgVpnName, opts = {}) {
  const {
    pageSize = 100,
    select,
    where
  } = opts;

  return await getAllPages({
    pageSize,
    fetchPage: ({ cursor, count }) =>
      sempClient.getMsgVpnQueues(msgVpnName, {
        count,
        cursor,
        select,
        where
      })
  });
}


