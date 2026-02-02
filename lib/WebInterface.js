const http = require('http');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

const traffic_template = fs.readFileSync(path.join(__dirname, '../views/traffic.ejs'), 'utf8');
const request_template = fs.readFileSync(path.join(__dirname, '../views/request.ejs'), 'utf8');

module.exports = class WebInterface {
  constructor(client) {
    this.client = client;
    this.server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith('/request/')) {
        const requestId = url.pathname.split('/')[2];
        const request = this.client.requests.find(r => r.id === requestId);
        if (request) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(ejs.render(request_template, { request }));
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Request not found');
        }
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(ejs.render(traffic_template, { requests: this.client.requests }));
    });
  }

  start() {
    this.server.listen(0, () => {
      const port = this.server.address().port;
      console.log(`Traffic inspector running on http://localhost:${port}`);
    });
  }
}
