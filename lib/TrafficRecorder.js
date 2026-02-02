const http = require('http');
const uuid = require('uuid');
const { HTTPParser } = require('http-parser-js');

const Request = require('./Request');

module.exports = class TrafficRecorder {
  constructor(requests) {
    this.requests = requests;
    this.request = null;
    this.pendingResponseRequests = [];
  }

  recordRequest(parser, data, callback) {
    parser[HTTPParser.kOnHeadersComplete] = ({ method, url, headers }) => {
      this.request = new Request({
        id: uuid.v4(),
      });
      this.request.method = HTTPParser.methods[method];
      this.request.path = url;
      this.request.headers = headers.reduce((acc, header, i) => {
        if (i % 2 === 0) {
          const key = header;
          const value = headers[i + 1];
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
    };

    parser[HTTPParser.kOnBody] = (chunk, offset, length) => {
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
      if (this.request) {
        this.requests.push(this.request);
        this.pendingResponseRequests.push(this.request);
        callback(this.request);
        this.request = null;
      }
      parser.reinitialize(HTTPParser.REQUEST);
    };

    parser.execute(data);
  }

  recordResponse(parser, data) {
    const request = this.pendingResponseRequests[0];

    parser[HTTPParser.kOnHeadersComplete] = ({ statusCode, headers }) => {
      request.responseStatus = `${statusCode} ${http.STATUS_CODES[statusCode]}`;
      request.responseHeaders = headers.reduce((acc, header, i) => {
        if (i % 2 === 0) {
          const key = header;
          const value = headers[i + 1];
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
    };

    parser[HTTPParser.kOnBody] = (chunk, offset, length) => {
      const bodyChunk = chunk.slice(offset, offset + length);
      if (request.responseBody) {
        request.responseBody = Buffer.concat([request.responseBody, bodyChunk]);
      } else {
        request.responseBody = bodyChunk;
      }
    };

    parser[HTTPParser.kOnMessageComplete] = () => {
      request.responseTime = Date.now() - request.startTime;
      this.pendingResponseRequests.shift();
      parser.reinitialize(HTTPParser.RESPONSE);
    };

    parser.execute(data);
  }
}
