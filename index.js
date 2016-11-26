var httpProxy = require("http-proxy"),
    http = require("http"),
    url = require("url"),
    net = require('net'),
    zt = require('zt'),
    regex_hostport = /^([^:]+)(:([0-9]+))?$/,
    LISTENING_PORT = process.env.NODE_PORT || 8080,
    LISTENING_IP = process.env.NODE_IP || '0.0.0.0';

zt.log("Proxy started! PORT = " + LISTENING_PORT);

var server = http.createServer(function(req, res) {
    var urlObj = url.parse(req.url),
        target = urlObj.protocol + "//" + urlObj.host,
        proxy = httpProxy.createProxyServer({});

    zt.log("Proxy HTTP request for:", target);

    proxy.on("error", function(err, req, res) {
        zt.error("Proxy error" + JSON.stringify(err));
        res.end();
    });

    proxy.web(req, res, {
        target: target
    });

}).listen(LISTENING_PORT, LISTENING_IP);

var getHostPortFromString = function(hostString, defaultPort) {
    var host = hostString,
        port = defaultPort,
        result = regex_hostport.exec(hostString);

    if (result != null) {
        host = result[1];
        if (result[2] != null) {
            port = result[3];
        }
    }

    return ([host, port]);
};

server.addListener('connect', function(req, socket, bodyhead) {
    var hostPort = getHostPortFromString(req.url, 443),
        hostDomain = hostPort[0],
        port = parseInt(hostPort[1]),
        proxySocket = new net.Socket();

    zt.log("Proxying HTTPS request for:" + JSON.stringify([hostDomain, port]));

    proxySocket.connect(port, hostDomain, function() {
        proxySocket.write(bodyhead);
        socket.write("HTTP/" + req.httpVersion + " 200 Connection established\r\n\r\n");
    });

    proxySocket.on('data', function(chunk) {
        socket.write(chunk);
    });

    proxySocket.on('end', function() {
        zt.warn("Connection ended");
        socket.end();
    });

    proxySocket.on('error', function() {
        zt.error("Error occured");
        socket.write("HTTP/" + req.httpVersion + " 500 Connection error\r\n\r\n");
        socket.end();
    });

    socket.on('data', function(chunk) {
        proxySocket.write(chunk);
    });

    socket.on('end', function() {
        proxySocket.end();
    });

    socket.on('error', function() {
        proxySocket.end();
    });

});
