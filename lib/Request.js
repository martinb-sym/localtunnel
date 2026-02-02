module.exports = class Request {
  constructor(options) {
    this.id = options.id;
    this.startTime = Date.now();
    this.method = options.method;
    this.path = options.path;
    this.headers = options.headers;
    this.body = options.body;
    this.responseStatus = null;
    this.responseHeaders = null;
    this.responseBody = null;
    this.responseTime = null;
  }
}
