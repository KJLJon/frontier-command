import { deflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";
const crc = (data) => {
  let c = 0xffffffff;
  for (const byte of data) {
    c ^= byte;
    for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (name, data) => {
  const type = Buffer.from(name),
    size = Buffer.alloc(4),
    check = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  check.writeUInt32BE(crc(Buffer.concat([type, data])));
  return Buffer.concat([size, type, data, check]);
};
for (const size of [192, 512]) {
  const data = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const px = (x / size) * 512,
        py = (y / size) * 512;
      let color = [20, 44, 53];
      if (
        (px > 104 && px < 408 && py > 140 && py < 326) ||
        (py >= 326 && py < 426 && Math.abs(px - 256) < (426 - py) * 1.52)
      )
        color = [228, 184, 92];
      if (
        (px > 153 && px < 359 && py > 192 && py < 316) ||
        (py > 149 &&
          py < 192 &&
          [
            [195, 235],
            [277, 317],
          ].some(([a, b]) => px > a && px < b))
      )
        color = [29, 82, 97];
      if (Math.abs(px - 256) / 48 + Math.abs(py - 281) / 55 < 1)
        color = [236, 241, 219];
      const i = y * (size * 4 + 1) + 1 + x * 4;
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = 255;
    }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  await writeFile(
    `public/icon-${size}.png`,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(data)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}
