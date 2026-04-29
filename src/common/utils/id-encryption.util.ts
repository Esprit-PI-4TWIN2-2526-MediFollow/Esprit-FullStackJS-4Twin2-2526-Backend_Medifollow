/**
 * Utility for encoding/decoding IDs in URLs
 * Prevents exposing MongoDB ObjectIDs in production
 */

export class IdEncryptionUtil {
  /**
   * Encode an ID to a URL-safe token
   */
  static encodeId(id: string): string {
    if (!id) return '';
    
    try {
      const timestamp = Date.now().toString(36);
      const combined = `${id}:${timestamp}`;
      
      return Buffer.from(combined)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    } catch (error) {
      console.error('Error encoding ID:', error);
      return id;
    }
  }

  /**
   * Decode a URL token back to the original ID
   */
  static decodeId(token: string): string {
    if (!token) return '';
    
    // If it's already a valid MongoDB ID, return as-is (for backward compatibility)
    if (this.isMongoId(token)) {
      return token;
    }
    
    try {
      let base64 = token
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      
      while (base64.length % 4) {
        base64 += '=';
      }
      
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      const id = decoded.split(':')[0];
      
      return id;
    } catch (error) {
      console.error('Error decoding token:', error);
      return token;
    }
  }

  /**
   * Check if a string is a MongoDB ObjectID
   */
  static isMongoId(str: string): boolean {
    return /^[a-f\d]{24}$/i.test(str);
  }

  /**
   * Check if a string is an encoded token
   */
  static isEncodedToken(str: string): boolean {
    return /^[A-Za-z0-9_-]+$/.test(str) && str.length > 20 && !this.isMongoId(str);
  }
}
