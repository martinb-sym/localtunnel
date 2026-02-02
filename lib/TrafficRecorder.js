const { EventEmitter } = require('events');
const http = require('http');
const uuid = require('uuid');
const { HTTPParser } = require('http-parser-js');

const Request = require('./Request');

function parseHeaders(headersArray) {
  return headersArray.reduce((acc, header, i) => {
    if (i % 2 === 0) {
      const key = header;
      const value = headersArray[i + 1];
      if (acc[key]) {
        if (Array.isArray(acc[key])) {
          acc[key].push(value);
        } else {
          acc[key] = [acc[key], value];
        }
      } else {
        acc[key] = value;
      }
    }
    return acc;
  }, {});
}

module.exports = class TrafficRecorder extends EventEmitter {
  constructor(requests) {
    super();
    this.requests = requests;
    this.request = null;
    this.pendingResponseRequests = [];
  }

  recordRequest(parser, data) {
    parser[HTTPParser.kOnHeadersComplete] = ({ method, url, headers }) => {
      this.request = new Request({
        id: uuid.v4(),
      });
      //console.log('Recording request headers for request ID:', this.request.id);
      this.request.method = HTTPParser.methods[method];
      this.request.path = url;
      this.request.headers = parseHeaders(headers);
    };

    parser[HTTPParser.kOnBody] = (chunk, offset, length) => {
      //console.log('Recording request body chunk for request ID:', this.request.id);
      // support streaming bodies
      if (this.request) {
        const bodyChunk = chunk.slice(offset, offset + length);
        if (this.request.body) {
          this.request.body = Buffer.concat([this.request.body, bodyChunk]);
        } else {
          this.request.body = bodyChunk;
        }
      }
    };

    parser[HTTPParser.kOnMessageComplete] = () => {
      //console.log('Request complete for request ID:', this.request.id);
      if (this.request) {
        this.requests.push(this.request);
        this.pendingResponseRequests.push(this.request);
        this.request = null;
      }
      parser.reinitialize(HTTPParser.REQUEST);
    };

    parser.execute(data);
  }

  recordResponse(data) {
    const parser = new HTTPParser(HTTPParser.RESPONSE);
    const request = this.pendingResponseRequests[0];
    
    parser[HTTPParser.kOnHeadersComplete] = ({ statusCode, headers }) => {
      //console.log('Recording response headers for request ID:', request.id);
      request.responseStatus = `${statusCode} ${http.STATUS_CODES[statusCode]}`;
      request.responseHeaders = parseHeaders(headers);

      if (request.method === 'HEAD') {
        //console.log('HEAD request detected, marking response complete for request ID:', request.id);
        request.responseTime = Date.now() - request.startTime;
        this.pendingResponseRequests.shift();
        this.emit('new-request', request);
      }
    };

    parser[HTTPParser.kOnBody] = (chunk, offset, length) => {
      //console.log('Recording response body chunk for request ID:', request.id);
      const bodyChunk = chunk.slice(offset, offset + length);
      if (request.responseBody) {
        request.responseBody = Buffer.concat([request.responseBody, bodyChunk]);
      } else {
        request.responseBody = bodyChunk;
      }
    };

    parser[HTTPParser.kOnMessageComplete] = () => {
      //console.log('Response complete for request ID:', request.id);
      request.responseTime = Date.now() - request.startTime;
      this.pendingResponseRequests.shift();
      this.emit('new-request', request);
    };

    parser.execute(data);
  }
}
