/**
 * Created by Ellery1 on 15/9/23.
 * url重写和过滤
 */
var util = require('./proxyUtil'),
    http = require("http"),
    url = require("url"),
    fs = require('fs'),
    logger = util.logger;

module.exports = function (sreq, sres) {

    var redirect,
        redirectUrl,
        responseData,
        renderedUrl,
        method,
        filtered,
        port,
        host,
        nocache,
        sheaders,
        isLocal,
        jsonpCallback,
        protocol;

    //第一步过滤,匹配rewrite中的规则
    redirect = util.rewrite(sreq.url);
    responseData = redirect.responseData;
    isLocal = redirect.isLocal;
    redirectUrl = redirect.rewriteUrl;
    jsonpCallback = redirect.jsonpCallback;
    console.log(redirect)

    renderedUrl = redirectUrl ? url.parse(redirectUrl) : null;

    //如果是本地文件
    //直接从本地读取并返回
    if (isLocal) {

        if (!responseData) {

            var exists = fs.existsSync(redirectUrl);

            if (!exists) {

                sres.writeHead(404, {
                    contentType: 'text/html'
                });
                sres.end('404 Not Found.');
            }
            else {

                fs.readFile(redirectUrl, function (err, data) {

                    if (err) {

                        sres.writeHead(500);
                        sres.end(err.toString());
                        return;
                    }

                    if (jsonpCallback) {

                        data = jsonpCallback + '(' + data + ');';
                    }

                    sres.writeHead(200, {
                        'Content-Type': 'text/json;charset=utf-8',
                        'Local-Path': redirectUrl
                    });
                    sres.end(data);
                });
            }
        }
        else {

            sres.writeHead(200, {
                'Content-Type': 'application/json'
            });

            responseData = JSON.stringify(responseData);

            if (jsonpCallback) {

                responseData = jsonpCallback + '(' + responseData + ');';
            }

            sres.end(responseData);
        }

        return null;
    }
    //线上资源
    else {
        //第二步过滤,匹配转发分组中的规则
        filtered = util.filter(renderedUrl.host);

        if (!filtered) {

            return;
        }

        protocol = renderedUrl.protocol || 'http:';
        port = renderedUrl.port || (protocol === 'http:' ? 80 : 443);
        host = filtered.host;
        nocache = filtered.nocache;
        sheaders = sreq.headers;
        method = sreq.method.toLowerCase();

        if (redirect.redirected && sreq.headers.host) {

            sheaders.host = host;
        }

        if (nocache) {

            sheaders['cache-control'] = 'no-cache';
        }

        logger(host, sreq.url, port, protocol.replace(':', ''), method, renderedUrl);

        return {
            host: host,
            port: port,
            path: renderedUrl.path,
            headers: sheaders,
            method: method,
            nocache: nocache,
            protocol: protocol
        };
    }
};