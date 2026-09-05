'use strict';
/**
 * Minimal multipart/form-data parser. Handles one or more fields/files.
 * No dependencies. Not RFC-perfect but robust enough for browser-generated
 * multipart bodies from <input type="file"> / FormData.
 */

function parseContentType(header) {
  const parts = header.split(';').map(s => s.trim());
  const type = parts[0];
  let boundary = null;
  for (const p of parts) {
    if (p.startsWith('boundary=')) {
      boundary = p.slice('boundary='.length);
      if (boundary.startsWith('"') && boundary.endsWith('"')) {
        boundary = boundary.slice(1, -1);
      }
    }
  }
  return { type, boundary };
}

function parseMultipart(buffer, boundary) {
  const result = { fields: {}, files: {} };
  const boundaryBuf = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(boundaryBuf, 0);
  while (start !== -1) {
    const next = buffer.indexOf(boundaryBuf, start + boundaryBuf.length);
    if (next === -1) break;
    let chunk = buffer.slice(start + boundaryBuf.length, next);
    // strip leading CRLF and trailing CRLF/--
    if (chunk.slice(0, 2).toString() === '\r\n') chunk = chunk.slice(2);
    if (chunk.length >= 2 && chunk.slice(-2).toString() === '\r\n') chunk = chunk.slice(0, -2);
    if (chunk.length > 0) parts.push(chunk);
    start = next;
  }

  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headerStr = part.slice(0, headerEnd).toString('utf8');
    const body = part.slice(headerEnd + 4);

    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]*)"/);
    const ctMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
    const fieldName = nameMatch ? nameMatch[1] : null;
    if (!fieldName) continue;

    if (filenameMatch) {
      result.files[fieldName] = {
        filename: filenameMatch[1],
        contentType: ctMatch ? ctMatch[1].trim() : 'application/octet-stream',
        data: body
      };
    } else {
      result.fields[fieldName] = body.toString('utf8');
    }
  }
  return result;
}

module.exports = { parseContentType, parseMultipart };
