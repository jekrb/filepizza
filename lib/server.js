var db = require('./db')
var express = require('express')
var expressWinston = require('express-winston')
var fs = require('fs')
var http = require('http')
var ice = require('./ice')
var path = require('path')
var socketIO = require('socket.io')
var winston = require('winston')

var app = express()
var server = http.Server(app)
var io = socketIO(server)

var logDir = path.resolve(__dirname, '../log')

winston.add(winston.transports.DailyRotateFile, {
  filename: logDir + '/access.log',
  level: 'info'
})

winston.add(winston.transports.File, {
  filename: logDir + '/error.log',
  level: 'error',
  handleExceptions: true,
  json: false
})

server.on('error', function (err) {
  console.error(err.message)
  process.exit(1)
})

server.listen(process.env.PORT || 3000, function (err) {
  var host = server.address().address
  var port = server.address().port
  console.log('FilePizza listening on %s:%s', host, port)
})

app.use(expressWinston.logger({
  winstonInstance: winston,
  expressFormat: true
}))

app.get('/js', require('./middleware/javascript'))
app.get('/css', require('./middleware/css'))
app.use(require('./middleware/static'))

app.use([
  require('./middleware/bootstrap'),
  require('./middleware/error'),
  require('./middleware/react')
])

io.on('connection', function (socket) {

  var upload = null

  socket.on('upload', function (metadata, res) {
    if (upload) return
    db.create(socket).then((u) => {
      upload = u
      upload.fileName = metadata.fileName
      upload.fileSize = metadata.fileSize
      upload.fileType = metadata.fileType
      upload.infoHash = metadata.infoHash
      res(upload.token)
    })
  })

  socket.on('rtcConfig', function (_, res) {
    ice.getICEServers().then(function (iceServers) {
      res({ iceServers: iceServers })
    })
  })

  socket.on('disconnect', function () {
    db.remove(upload)
  })

})
