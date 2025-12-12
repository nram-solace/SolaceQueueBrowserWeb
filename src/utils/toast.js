/**
 * Extract error detail from error object
 * @param {Error|Object} error - Error object
 * @returns {string} Error detail message
 */
function getErrorDetail(error) {
  if (!error) {
    return 'Unknown error occurred';
  }
  
  // Check for SEMP API error response format
  if (error.response?.body?.meta?.error?.description) {
    return error.response.body.meta.error.description;
  }
  
  // Fall back to error message
  if (error.message) {
    return error.message;
  }
  
  // Last resort
  return String(error);
}

/**
 * Show an error toast notification
 * @param {Object} toastRef - React ref to Toast component
 * @param {Error|Object|string} error - Error object or error message
 * @param {string} context - Context description for the operation (e.g., 'Loading Messages')
 * @param {number} life - Toast lifetime in milliseconds (default: 5000)
 */
export function showErrorToast(toastRef, error, context = 'Operation', life = 5000) {
  const errorDetail = typeof error === 'string' ? error : getErrorDetail(error);
  const summary = context.includes('Failed') ? context : `${context} Failed`;
  
  toastRef.current?.show({
    severity: 'error',
    summary,
    detail: errorDetail,
    life
  });
}

/**
 * Show a success toast notification
 * @param {Object} toastRef - React ref to Toast component
 * @param {string} message - Success message
 * @param {string} summary - Toast summary (default: 'Success')
 * @param {number} life - Toast lifetime in milliseconds (default: 3000)
 */
export function showSuccessToast(toastRef, message, summary = 'Success', life = 3000) {
  toastRef.current?.show({
    severity: 'success',
    summary,
    detail: message,
    life
  });
}

/**
 * Show a warning toast notification
 * @param {Object} toastRef - React ref to Toast component
 * @param {string} message - Warning message
 * @param {string} summary - Toast summary (default: 'Warning')
 * @param {number} life - Toast lifetime in milliseconds (default: 5000)
 */
export function showWarningToast(toastRef, message, summary = 'Warning', life = 5000) {
  toastRef.current?.show({
    severity: 'warn',
    summary,
    detail: message,
    life
  });
}

/**
 * Show a generic toast notification with full control
 * @param {Object} toastRef - React ref to Toast component
 * @param {Object} options - Toast options (severity, summary, detail, life)
 */
export function showToast(toastRef, options) {
  toastRef.current?.show(options);
}

