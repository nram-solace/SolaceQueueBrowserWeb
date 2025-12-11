/**
 * Transforms a message object (headers, meta, userProperties) into table data format
 * @param {Object} data - The object to transform (headers, meta, or userProperties)
 * @returns {Array} Array of objects with { name, value } structure for DataTable
 */
export function transformToTableData(data) {
  if (!data || typeof data !== 'object') {
    return [];
  }

  return Object.entries(data).map(([key, value]) => {
    // Format the value for display
    let displayValue;
    if (value === undefined) {
      displayValue = 'undefined';
    } else if (value === null) {
      displayValue = 'null';
    } else if (typeof value === 'boolean') {
      displayValue = String(value);
    } else if (typeof value === 'object') {
      // Handle nested objects (shouldn't happen for headers/meta, but handle gracefully)
      displayValue = JSON.stringify(value);
    } else {
      displayValue = String(value);
    }

    return {
      name: key,
      value: displayValue
    };
  });
}
