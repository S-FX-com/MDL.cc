// MDL.cc - QR Code Generation Handler
// Generates QR codes for short links using a simple SVG-based approach

import { Env, QRConfig } from '../types';
import { generateId, successResponse, errorResponse } from '../utils';

// QR Code Generator - Pure TypeScript implementation
// Error correction levels: L (7%), M (15%), Q (25%), H (30%)

const PATTERNS = {
  FINDER: [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 1, 1, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1],
  ],
};

// Alphanumeric encoding table
const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

// Generate QR code as SVG
export function generateQRSvg(
  data: string,
  options: {
    size?: number;
    foreground?: string;
    background?: string;
    margin?: number;
  } = {}
): string {
  const { size = 256, foreground = '#000000', background = '#FFFFFF', margin = 4 } = options;

  // For simplicity, we'll use a basic QR code structure
  // In production, you'd use a full QR code library
  const modules = encodeToModules(data);
  const moduleCount = modules.length;
  const moduleSize = size / (moduleCount + margin * 2);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  svg += `<rect width="100%" height="100%" fill="${background}"/>`;

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (modules[row][col]) {
        const x = (col + margin) * moduleSize;
        const y = (row + margin) * moduleSize;
        svg += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="${foreground}"/>`;
      }
    }
  }

  svg += '</svg>';
  return svg;
}

// Simple QR encoder (Version 1-4 for short URLs)
function encodeToModules(data: string): number[][] {
  // Determine version based on data length
  const version = Math.min(4, Math.max(1, Math.ceil(data.length / 14)));
  const size = 17 + version * 4; // QR code size formula

  // Initialize module matrix
  const modules: number[][] = Array(size)
    .fill(null)
    .map(() => Array(size).fill(0));

  // Add finder patterns (top-left, top-right, bottom-left)
  addFinderPattern(modules, 0, 0);
  addFinderPattern(modules, size - 7, 0);
  addFinderPattern(modules, 0, size - 7);

  // Add timing patterns
  for (let i = 8; i < size - 8; i++) {
    modules[6][i] = i % 2 === 0 ? 1 : 0;
    modules[i][6] = i % 2 === 0 ? 1 : 0;
  }

  // Add separators
  addSeparators(modules, size);

  // Add alignment pattern (for version >= 2)
  if (version >= 2) {
    const alignPos = size - 7;
    addAlignmentPattern(modules, alignPos - 2, alignPos - 2);
  }

  // Encode data into modules
  encodeData(modules, data, size);

  return modules;
}

function addFinderPattern(modules: number[][], startRow: number, startCol: number): void {
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      modules[startRow + row][startCol + col] = PATTERNS.FINDER[row][col];
    }
  }
}

function addSeparators(modules: number[][], size: number): void {
  // Horizontal separators
  for (let i = 0; i < 8; i++) {
    if (modules[7] && modules[7][i] !== undefined) modules[7][i] = 0;
    if (modules[7] && modules[7][size - 1 - i] !== undefined) modules[7][size - 1 - i] = 0;
    if (modules[size - 8] && modules[size - 8][i] !== undefined) modules[size - 8][i] = 0;
  }
  // Vertical separators
  for (let i = 0; i < 8; i++) {
    if (modules[i] && modules[i][7] !== undefined) modules[i][7] = 0;
    if (modules[i] && modules[i][size - 8] !== undefined) modules[i][size - 8] = 0;
    if (modules[size - 1 - i] && modules[size - 1 - i][7] !== undefined) modules[size - 1 - i][7] = 0;
  }
}

function addAlignmentPattern(modules: number[][], centerRow: number, centerCol: number): void {
  for (let row = -2; row <= 2; row++) {
    for (let col = -2; col <= 2; col++) {
      const r = centerRow + row;
      const c = centerCol + col;
      if (r >= 0 && c >= 0 && r < modules.length && c < modules[0].length) {
        if (Math.abs(row) === 2 || Math.abs(col) === 2 || (row === 0 && col === 0)) {
          modules[r][c] = 1;
        } else {
          modules[r][c] = 0;
        }
      }
    }
  }
}

function encodeData(modules: number[][], data: string, size: number): void {
  // Convert data to binary
  const binary = stringToBinary(data);

  // Fill data area with encoded bits
  let bitIndex = 0;
  let upward = true;

  for (let col = size - 1; col >= 1; col -= 2) {
    // Skip timing pattern column
    if (col === 6) col = 5;

    for (let row = upward ? size - 1 : 0; upward ? row >= 0 : row < size; row += upward ? -1 : 1) {
      for (let c = 0; c < 2; c++) {
        const currentCol = col - c;
        if (!isReserved(row, currentCol, size)) {
          if (bitIndex < binary.length) {
            modules[row][currentCol] = binary[bitIndex] === '1' ? 1 : 0;
            bitIndex++;
          } else {
            // Padding
            modules[row][currentCol] = (row + currentCol) % 2 === 0 ? 1 : 0;
          }
        }
      }
    }
    upward = !upward;
  }
}

function isReserved(row: number, col: number, size: number): boolean {
  // Finder patterns and separators
  if (row < 9 && col < 9) return true;
  if (row < 9 && col >= size - 8) return true;
  if (row >= size - 8 && col < 9) return true;

  // Timing patterns
  if (row === 6 || col === 6) return true;

  return false;
}

function stringToBinary(str: string): string {
  let binary = '';

  // Mode indicator (0100 for byte mode)
  binary += '0100';

  // Character count (8 bits for version 1-9)
  binary += str.length.toString(2).padStart(8, '0');

  // Encode characters
  for (let i = 0; i < str.length; i++) {
    binary += str.charCodeAt(i).toString(2).padStart(8, '0');
  }

  // Terminator
  binary += '0000';

  return binary;
}

// API handler for QR code generation
export async function generateQR(request: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(request.url);
    const linkId = url.searchParams.get('link_id');
    const shortCode = url.searchParams.get('code');
    const customUrl = url.searchParams.get('url');
    const size = parseInt(url.searchParams.get('size') || '256');
    const foreground = url.searchParams.get('fg') || '#000000';
    const background = url.searchParams.get('bg') || '#FFFFFF';
    const format = url.searchParams.get('format') || 'svg';

    let targetUrl: string;

    if (linkId) {
      // Resolve the link with its (optional) branded domain so the QR encodes
      // the exact URL the redirect handler serves. On the shared domain that's
      // mdl.cc/m{code}; on a branded domain it's <domain>/{code}.
      const link = await env.DB.prepare(
        `SELECT l.short_code, d.domain AS domain_host
         FROM links l LEFT JOIN domains d ON l.domain_id = d.id
         WHERE l.id = ?`,
      )
        .bind(linkId)
        .first<{ short_code: string; domain_host: string | null }>();

      if (!link) {
        return errorResponse('Link not found', 404);
      }

      targetUrl = link.domain_host
        ? `https://${link.domain_host}/${link.short_code}`
        : `https://mdl.cc/m${link.short_code}`;
    } else if (shortCode) {
      // Shared-domain short links resolve at the "/m" prefix; without it the
      // QR points at an app route that 404s.
      targetUrl = `https://mdl.cc/m${shortCode}`;
    } else if (customUrl) {
      targetUrl = customUrl;
    } else {
      return errorResponse('Please provide link_id, code, or url parameter');
    }

    const svg = generateQRSvg(targetUrl, {
      size: Math.min(Math.max(size, 64), 1024),
      foreground,
      background,
    });

    if (format === 'svg') {
      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // For other formats, return SVG with a note
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'X-Note': 'PNG/JPG conversion available in production with image processing',
      },
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    return errorResponse('Failed to generate QR code', 500);
  }
}

// Save QR configuration for a link
export async function saveQRConfig(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json<{
      link_id: string;
      foreground_color?: string;
      background_color?: string;
      logo_url?: string;
      size?: number;
      error_correction?: string;
    }>();

    if (!body.link_id) {
      return errorResponse('Link ID is required');
    }

    // Check if link exists
    const link = await env.DB.prepare('SELECT id FROM links WHERE id = ?').bind(body.link_id).first();
    if (!link) {
      return errorResponse('Link not found', 404);
    }

    const id = generateId();
    const now = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO qr_configs (id, link_id, foreground_color, background_color, logo_url, size, error_correction, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(link_id) DO UPDATE SET
         foreground_color = excluded.foreground_color,
         background_color = excluded.background_color,
         logo_url = excluded.logo_url,
         size = excluded.size,
         error_correction = excluded.error_correction,
         updated_at = excluded.updated_at`
    )
      .bind(
        id,
        body.link_id,
        body.foreground_color || '#000000',
        body.background_color || '#FFFFFF',
        body.logo_url || null,
        body.size || 256,
        body.error_correction || 'M',
        now,
        now
      )
      .run();

    const config = await env.DB.prepare('SELECT * FROM qr_configs WHERE link_id = ?')
      .bind(body.link_id)
      .first<QRConfig>();

    return successResponse(config, 'QR configuration saved');
  } catch (error) {
    console.error('Error saving QR config:', error);
    return errorResponse('Failed to save QR configuration', 500);
  }
}
