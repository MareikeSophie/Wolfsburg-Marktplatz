const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const docPath = path.join(__dirname, 'docs', 'WesthagenFest_Chat.docx');
const buf = fs.readFileSync(docPath);

function findZipEntries(buf) {
  const entries = [];
  let i = 0;
  while (i < buf.length - 4) {
    if (buf[i] === 0x50 && buf[i+1] === 0x4B && buf[i+2] === 0x03 && buf[i+3] === 0x04) {
      const compression = buf.readUInt16LE(i + 8);
      const compSize = buf.readUInt32LE(i + 18);
      const uncompSize = buf.readUInt32LE(i + 22);
      const fnLen = buf.readUInt16LE(i + 26);
      const extraLen = buf.readUInt16LE(i + 28);
      const fname = buf.slice(i + 30, i + 30 + fnLen).toString('utf8');
      const dataOffset = i + 30 + fnLen + extraLen;
      entries.push({ fname, compression, compSize, uncompSize, dataOffset });
      i = dataOffset + compSize;
    } else {
      i++;
    }
  }
  return entries;
}

const entries = findZipEntries(buf);
const target = entries.find(e => e.fname === 'word/document.xml');
if (!target) {
  console.log('NOT FOUND. Entries:', entries.map(e => e.fname).join(', '));
  process.exit(1);
}

let data = buf.slice(target.dataOffset, target.dataOffset + target.compSize);
if (target.compression === 8) {
  data = zlib.inflateRawSync(data);
}
const xml = data.toString('utf8');

let text = xml;
text = text.replace(/<w:br[^>]*\/>/g, '\n');
text = text.replace(/<\/w:p>/g, '\n');
text = text.replace(/<[^>]+>/g, '');
text = text.replace(/\n{3,}/g, '\n\n');
text = text
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&#x27;/g, "'")
  .replace(/&#x2019;/g, '’')
  .replace(/&#x2018;/g, '‘')
  .replace(/&#x201C;/g, '“')
  .replace(/&#x201D;/g, '”')
  .replace(/&#x2013;/g, '–')
  .replace(/&#x2014;/g, '—');

process.stdout.write(text);
