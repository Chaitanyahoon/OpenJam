/**
 * OpenJam Standalone QR Code Matrix Generator & Canvas Renderer.
 * Zero external dependencies. Pure JavaScript QR Code (Model 2) Engine.
 */

// GF(256) Math tables for Reed-Solomon error correction
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    EXP_TABLE[i + 255] = x;
    LOG_TABLE[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // Generator polynomial x^8 + x^4 + x^3 + x^2 + 1
  }
})();

function gMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const nextPoly = new Array(poly.length + 1).fill(0);
    const root = EXP_TABLE[i];
    for (let j = 0; j < poly.length; j++) {
      nextPoly[j] ^= gMul(poly[j], root);
      nextPoly[j + 1] ^= poly[j];
    }
    poly = nextPoly;
  }
  return poly;
}

function calculateRsEcc(data, eccLength) {
  const genPoly = rsGeneratorPoly(eccLength);
  const info = new Uint8Array(data.length + eccLength);
  info.set(data);

  for (let i = 0; i < data.length; i++) {
    const coef = info[i];
    if (coef !== 0) {
      for (let j = 0; j < genPoly.length; j++) {
        info[i + j] ^= gMul(genPoly[j], coef);
      }
    }
  }
  return Array.from(info.subarray(data.length));
}

// QR Code Specifications for Versions 1-10 (Byte mode with Level M error correction)
const QR_CAPACITIES_M = [
  { version: 1, size: 21, totalBytes: 26, dataBytes: 16, eccPerBlock: 10, numBlocks: 1, align: [] },
  { version: 2, size: 25, totalBytes: 44, dataBytes: 28, eccPerBlock: 16, numBlocks: 1, align: [6, 18] },
  { version: 3, size: 29, totalBytes: 70, dataBytes: 44, eccPerBlock: 26, numBlocks: 1, align: [6, 22] },
  { version: 4, size: 33, totalBytes: 100, dataBytes: 64, eccPerBlock: 18, numBlocks: 2, align: [6, 26] },
  { version: 5, size: 37, totalBytes: 134, dataBytes: 86, eccPerBlock: 24, numBlocks: 2, align: [6, 30] },
  { version: 6, size: 41, totalBytes: 172, dataBytes: 108, eccPerBlock: 16, numBlocks: 4, align: [6, 34] },
  { version: 7, size: 45, totalBytes: 196, dataBytes: 124, eccPerBlock: 18, numBlocks: 4, align: [6, 22, 38] },
  { version: 8, size: 49, totalBytes: 242, dataBytes: 154, eccPerBlock: 22, numBlocks: 4, align: [6, 24, 42] },
  { version: 9, size: 53, totalBytes: 292, dataBytes: 182, eccPerBlock: 22, numBlocks: 5, align: [6, 26, 46] },
  { version: 10, size: 57, totalBytes: 346, dataBytes: 216, eccPerBlock: 26, numBlocks: 5, align: [6, 28, 50] },
];

/**
 * Generate binary bit stream for text using 8-bit byte mode.
 */
function encodeData(text, dataByteLimit) {
  const utf8Bytes = [];
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code < 0x80) {
      utf8Bytes.push(code);
    } else if (code < 0x800) {
      utf8Bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      utf8Bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }

  const charCount = utf8Bytes.length;
  // Mode Indicator: Byte Mode = 0100 (4 bits)
  let bits = '0100';
  // Character Count Indicator (8 bits for V1-V9)
  bits += charCount.toString(2).padStart(8, '0');

  for (const b of utf8Bytes) {
    bits += b.toString(2).padStart(8, '0');
  }

  const totalBits = dataByteLimit * 8;
  // Terminator (up to 4 zeroes)
  const termLen = Math.min(4, totalBits - bits.length);
  for (let i = 0; i < termLen; i++) bits += '0';

  // Pad to multiple of 8
  while (bits.length % 8 !== 0) bits += '0';

  // Pad bytes: 0xEC (11101100), 0x11 (00010001)
  const padBytes = ['11101100', '00010001'];
  let padIdx = 0;
  while (bits.length < totalBits) {
    bits += padBytes[padIdx % 2];
    padIdx++;
  }

  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    dataBytes.push(parseInt(bits.substr(i, 8), 2));
  }
  return dataBytes;
}

/**
 * Generate 2D boolean array representing QR code modules.
 */
export function generateQrMatrix(text) {
  if (!text) text = 'https://openjam.fun';

  // Select minimum QR version that accommodates text length
  const testBytes = new TextEncoder().encode(text);
  const spec = QR_CAPACITIES_M.find(s => s.dataBytes >= testBytes.length + 3) || QR_CAPACITIES_M[QR_CAPACITIES_M.length - 1];
  const { size, dataBytes, eccPerBlock, numBlocks, align } = spec;

  const encodedData = encodeData(text, dataBytes);

  // Divide into blocks and compute RS error correction
  const blockSize = Math.floor(dataBytes / numBlocks);
  const dataBlocks = [];
  const eccBlocks = [];

  for (let b = 0; b < numBlocks; b++) {
    const blockData = encodedData.slice(b * blockSize, (b + 1) * blockSize);
    dataBlocks.push(blockData);
    eccBlocks.push(calculateRsEcc(blockData, eccPerBlock));
  }

  // Interleave data and ecc codewords
  const finalCodewords = [];
  for (let i = 0; i < blockSize; i++) {
    for (let b = 0; b < numBlocks; b++) {
      finalCodewords.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < eccPerBlock; i++) {
    for (let b = 0; b < numBlocks; b++) {
      finalCodewords.push(eccBlocks[b][i]);
    }
  }

  // Convert to bit sequence
  let codewordBits = '';
  for (const cw of finalCodewords) {
    codewordBits += cw.toString(2).padStart(8, '0');
  }

  // Initialize Matrix (-1 = unassigned, 0 = white, 1 = black)
  const matrix = Array.from({ length: size }, () => new Array(size).fill(-1));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));

  function setFinderPattern(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const tr = row + r;
        const tc = col + c;
        if (tr >= 0 && tr < size && tc >= 0 && tc < size) {
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
            const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
            matrix[tr][tc] = (isBorder || isCenter) ? 1 : 0;
          } else {
            matrix[tr][tc] = 0; // Separator
          }
          isFunction[tr][tc] = true;
        }
      }
    }
  }

  // 1. Finder Patterns (Top-Left, Top-Right, Bottom-Left)
  setFinderPattern(0, 0);
  setFinderPattern(0, size - 7);
  setFinderPattern(size - 7, 0);

  // 2. Alignment Patterns
  if (align && align.length > 0) {
    for (const r of align) {
      for (const c of align) {
        if (isFunction[r][c]) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const tr = r + dr;
            const tc = c + dc;
            const isBorder = Math.abs(dr) === 2 || Math.abs(dc) === 2;
            const isCenter = dr === 0 && dc === 0;
            matrix[tr][tc] = (isBorder || isCenter) ? 1 : 0;
            isFunction[tr][tc] = true;
          }
        }
      }
    }
  }

  // 3. Timing Patterns
  for (let i = 8; i < size - 8; i++) {
    if (!isFunction[6][i]) {
      matrix[6][i] = (i % 2 === 0) ? 1 : 0;
      isFunction[6][i] = true;
    }
    if (!isFunction[i][6]) {
      matrix[i][6] = (i % 2 === 0) ? 1 : 0;
      isFunction[i][6] = true;
    }
  }

  // 4. Dark Module
  matrix[4 * spec.version + 9][8] = 1;
  isFunction[4 * spec.version + 9][8] = true;

  // 5. Reserve Format Info Area
  for (let i = 0; i < 9; i++) {
    if (!isFunction[8][i]) isFunction[8][i] = true;
    if (!isFunction[i][8]) isFunction[i][8] = true;
    if (!isFunction[8][size - 1 - i]) isFunction[8][size - 1 - i] = true;
    if (!isFunction[size - 1 - i][8]) isFunction[size - 1 - i][8] = true;
  }

  // 6. Data Placement in Zig-Zag pattern
  let bitIdx = 0;
  let upwards = true;
  for (let rightCol = size - 1; rightCol > 0; rightCol -= 2) {
    if (rightCol === 6) rightCol--; // Skip vertical timing line
    const cols = [rightCol, rightCol - 1];
    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (const col of cols) {
        if (!isFunction[row][col]) {
          let bit = bitIdx < codewordBits.length ? parseInt(codewordBits[bitIdx], 10) : 0;
          bitIdx++;

          // Apply standard QR Mask 0: (row + col) % 2 == 0
          if ((row + col) % 2 === 0) {
            bit ^= 1;
          }
          matrix[row][col] = bit;
        }
      }
    }
    upwards = !upwards;
  }

  // 7. Format Information (Level M, Mask 0: 00 + 000 -> Format Bits 101010000010010)
  // Mask pattern 0 with ECC Level M format string with BCH(15,5) & XOR mask 101010000010010
  const FORMAT_BITS_M_MASK0 = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];

  // Place format information on matrix
  for (let i = 0; i < 15; i++) {
    const bit = FORMAT_BITS_M_MASK0[i];
    // Top-left
    if (i <= 5) matrix[8][i] = bit;
    else if (i === 6) matrix[8][7] = bit;
    else if (i === 7) matrix[8][8] = bit;
    else if (i === 8) matrix[7][8] = bit;
    else matrix[14 - i][8] = bit;

    // Split format around other finders
    if (i < 8) {
      matrix[size - 1 - i][8] = bit;
    } else {
      matrix[8][size - 15 + i] = bit;
    }
  }

  // Convert matrix values (1 -> true, 0 -> false)
  return matrix.map(row => row.map(v => v === 1));
}

/**
 * Draw a clean QR Code directly onto an HTML5 Canvas 2D rendering context.
 */
export function drawQrCode(ctx, text, x, y, size, options = {}) {
  const {
    bgColor = '#ffffff',
    fgColor = '#000000',
    margin = 3,
    borderRadius = 12,
  } = options;

  const matrix = generateQrMatrix(text);
  const matrixSize = matrix.length;
  const totalModules = matrixSize + margin * 2;
  const cellSize = size / totalModules;

  ctx.save();

  // Background Box
  ctx.fillStyle = bgColor;
  if (borderRadius > 0) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, size, size, borderRadius);
    } else {
      ctx.rect(x, y, size, size);
    }
    ctx.fill();
  } else {
    ctx.fillRect(x, y, size, size);
  }

  // Draw QR Modules
  ctx.fillStyle = fgColor;
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        const mx = x + (c + margin) * cellSize;
        const my = y + (r + margin) * cellSize;
        ctx.fillRect(Math.floor(mx), Math.floor(my), Math.ceil(cellSize), Math.ceil(cellSize));
      }
    }
  }

  ctx.restore();
}
