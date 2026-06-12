const http = require('http');
http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    console.log('--- RECEIVED LOG ---');
    console.log(body);
    res.writeHead(200);
    res.end();
  });
}).listen(9999, () => console.log('Listening on 9999'));
