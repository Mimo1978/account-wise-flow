/**
 * Safe text rendering utilities to prevent XSS attacks in AI-generated content
 */

/**
 * Escapes HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return text.replace(/[&<>"'/]/g, (char) => htmlEscapes[char] || char);
}

/**
 * Checks if a URL is safe (not javascript:, data:, or other dangerous protocols)
 */
export function isSafeUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  // Block dangerous protocols
  if (trimmed.startsWith('javascript:')) return false;
  if (trimmed.startsWith('data:')) return false;
  if (trimmed.startsWith('vbscript:')) return false;
  // Allow http, https, mailto, tel, and relative URLs
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    !trimmed.includes(':')
  );
}

/**
 * Sanitizes a URL, returning empty string if unsafe
 */
export function sanitizeUrl(url: string): string {
  return isSafeUrl(url) ? url : '';
}

/**
 * Test that script tags are rendered as text, not executed
 * Returns true if safe
 */
export function verifyXssPrevention(): boolean {
  const testCases = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)>',
    '"><script>alert(1)</script>',
    "javascript:alert('xss')",
  ];
  
  for (const testCase of testCases) {
    const escaped = escapeHtml(testCase);
    // Verify no unescaped tags
    if (escaped.includes('<script') || escaped.includes('onerror=') || escaped.includes('onload=')) {
      return false;
    }
  }
  
  // Verify javascript URLs are blocked
  if (isSafeUrl("javascript:alert(1)")) {
    return false;
  }
  
  return true;
}
