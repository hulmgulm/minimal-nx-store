import express from 'express';
import https from 'node:https';
import path from 'node:path';
import { createWriteStream, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

// configuration
const store = process.env.CACHE_STORE_PATH || `${import.meta.dirname}/store`;
const port = process.env.CACHE_PORT || 443;
const token = process.env.CACHE_TOKEN || 'do_not_use_this_token';
const maxAge = process.env.CACHE_MAX_AGE || 21;

const app = express();

// Check Authorization header
app.use((req, res, next) => {
  if (req.headers.authorization !== `Bearer ${token}`) {
    console.log('nx-cache', 'Error:', new Date(), 'Missing or invalid authentication token');
    return res.status(401).send('Missing or invalid authentication token');
  }
  next();
});

// handle cache upload
app.put('/v1/cache/:hash', async (req, res) => {
  const filepath = path.join(store, path.basename(req.params.hash));

  const writeStream = createWriteStream(filepath, { flags: 'wx' }); // fail if file exists
  req.pipe(writeStream);

  writeStream.on('finish', () => {
    console.log('nx-cache', new Date(), 'Added to cache', req.params.hash);
    res.status(202).send(`Successfully uploaded ${req.params.hash}`);
  });

  writeStream.on('error', (err) => {
    if (err.code !== 'EEXIST') {
      console.log('nx-cache', new Date(), 'Error writing to cache:', err);
      res.status(501).send('Error writing to cache');
    } else {
      console.log('nx-cache', new Date(), 'Already in cache:', req.params.hash);
      res.status(409).send('File already exists.');
    }
  });
});

// touch file in cache to allow deleting unused files
const setHeaders = (res, path) => {
  console.log('nx-cache', new Date(), 'Cache access:', path.split('/').pop());
  spawn('touch', [path], { stdio: 'ignore' });
}

// handle cache get
app.use('/v1/cache/', express.static(store, { setHeaders }), (req, res) => {
  console.log('nx-cache', new Date(), 'Not in cache:', req.url.replace('/', ''));
  res.status(404).send('Error: Not Found');
});

// start server
var key = readFileSync('selfsigned.key');
var cert = readFileSync('selfsigned.crt');
const server = https.createServer({ key, cert }, app);
server.listen(port, () => { console.log('nx-cache', new Date(), `Server is listening at https://0.0.0.0:${port}`); });

// cache clean up
const cleanup = () => {
  console.log('nx-cache', new Date(), 'Running cache clean up', [store, '-type', 'f', '-mtime', `+${maxAge}`, '-print', '-delete']);
  const find = spawn('find', [store, '-type', 'f', '-mtime', `+${maxAge}`, '-print', '-delete']);
  find.stdout.on('data', (data) => {
    console.log('nx-cache', new Date(), 'Result of cache clean up:', data.toString());
  });

  find.stderr.on('data', (data) => {
    console.log('nx-cache', new Date(), 'Error cleaning cache:', data.toString());
  });

  find.on('close', (code) => {
    console.log('nx-cache', new Date(), 'Cache clean up finished with code:', code);
  });
};

setInterval(cleanup, 1000 * 60 * 60 * 5); // run every five hours
cleanup(); // run once at startup
