const Tunnel = require('./lib/Tunnel');
const WebInterface = require('./lib/WebInterface');

module.exports = function localtunnel(arg1, arg2, arg3) {
  const options = typeof arg1 === 'object' ? arg1 : { ...arg2, port: arg1 };
  const callback = typeof arg1 === 'object' ? arg2 : arg3;
  const client = new Tunnel(options);

  if (options.show_traffic) {
    const webInterface = new WebInterface(client, options.traffic_inspector_port);
    webInterface.start();
  }

  if (callback) {
    client.open(err => (err ? callback(err) : callback(null, client)));
    return client;
  }
  return new Promise((resolve, reject) =>
    client.open(err => (err ? reject(err) : resolve(client)))
  );
};
