var path = require('path')

var internals = require('./internals')

exports.register = register
exports.register.attributes = {
  name: 'api',
  dependencies: 'h2o2'
}

var clientPath = path.dirname(require.resolve('hoodie-client/package.json'))

function register (server, options, next) {
  // allow clients to request a gzip response, even if the
  // Accept-Encoding headers is missing or mangled due to
  // faulty proxy servers
  // http://www.stevesouders.com/blog/2010/07/12/velocity-forcing-gzip-compression/
  server.ext('onPreHandler', function maybeForceGzip (request, reply) {
    if (request.query.force_gzip === 'true') {
      request.info.acceptEncoding = 'gzip'
    }
    reply.continue()
  })

  server.route([{
    method: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    path: '/_api/{p*}',
    handler: {
      proxy: {
        passThrough: true,
        mapUri: internals.mapProxyPath.bind(null, options.app.db),
        onResponse: internals.addCorsAndBearerToken
      }
    }
  }, {
    method: 'GET',
    path: '/_api/_all_dbs',
    handler: internals.notFound
  }, {
    method: 'GET',
    path: '/_api/_files/hoodie.js',
    handler: {
      file: path.join(clientPath, 'dist/hoodie.js')
    }
  }, {
    method: 'GET',
    path: '/_api/_files/hoodie.min.js',
    handler: {
      file: path.join(clientPath, 'dist/hoodie.min.js')
    }
  }])

  return next()
}