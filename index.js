import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { createWriteStream } from 'node:fs';

const store = `${import.meta.dirname}/store`;
const port = 4711;
const token = 'sdfsdf';

const app = express();

// Check Authorization header
app.use((req, res, next) => {
  if (req.headers.authorization !== `Bearer ${token}`) {
    return res.status(401).send('Missing or invalid authentication token.');
  }
  next();
});

// handle cache upload
app.put('/v1/cache/:hash', async (req, res) => {
  const filepath = path.join(store, path.basename(req.params.hash));

  const writeStream = createWriteStream(filepath, { flags: 'wx' }); // fail if file exists
  req.pipe(writeStream);

  writeStream.on('finish', () => {
    res.status(202).send(`Successfully uploaded ${req.params.hash}`);
  });

  writeStream.on('error', (err) => {
    res.status(409).send('File already exists.');
  });
});

// handle cache get
app.use('/v1/cache/', express.static(store), (req, res) => {
  res.status(404).send('Error: Not Found');
});

// start server
const server = http.createServer(app);
server.listen(port, () => { console.log(`Server is listening at http://localhost:${port}`); });
