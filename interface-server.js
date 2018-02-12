/*
 *  An express application to accept a path from an iPad
 *  and connect to the OpenCV control system for ChairBot.
 *
 */

// Require the modules needed
var express = require('express'),
    app = express();

var expressWs = require('express-ws')(app),
    bodyParser = require('body-parser'),
    fs = require('fs'),
    webcam = require('webcam-stream'),
    logger = require('json-logger'),
    WebSocket = require('ws'),
    BotControl = require('./bot-control');

// start webcam proxy stuff
var webcamClientServer = webcam.startWebClientServer();
var webcamStreamServer = webcam.startStreamProxyServer(webcamClientServer);

// Express app setup
app.use(webcam.middleware);
app.use(bodyParser.json());
app.use(express.static('static'));
app.set('port', (process.env.PORT || 5000));
app.set('views', './pages');

var wasdInfo = {linear: 0, rotation: 0};
app.post('/wasd', function(req, res) {
  console.log("got wasd", req.query.linear, req.query.rotation);
  wasdInfo = {linear: Number(req.query.linear), rotation: Number(req.query.rotation)};
  sendCommand();
  
  res.send('ok');
});

app.get('/wasd', function (req, res) {
  res.sendFile('pages/wasd.html', {root: __dirname});
});

app.get('/view-stream.html', function (req, res) {
  res.sendFile('pages/view-stream.html', {root: __dirname});
});

app.get('/', function (req, res) {
  res.sendFile('pages/main.html', {root: __dirname});
});

let controlLog = logger.named('controller');

var controllers = [];
function sendControllersUpdate(update) {
  controllers.forEach(function(ws) {
    ws.send(JSON.stringify(update));
  });
}

app.ws('/web-controller', function(ws, req) {
  console.log('paths socket connected');
  controllers.push(ws);
  ws.on('message', function(msgString) {
    var msg;
    try {
      msg = JSON.parse(msgString);
    } catch (e) {
      console.error("Unable to parse path message", msgString, e);
      return;
    }
    controlLog.save(msg);
    try {
      if (msg.action == "requestPath") {
        console.log("got path!", msg);
        var bot = BotControl.for(msg.bot);
        if (msg.mechanism == "orient") {
          bot.orient(msg.finalOrientation, msg.pathId, msg.topSpeed, msg.accel);
        } else {
          bot.requestPath(msg.path, msg.pathId, msg.topSpeed, msg.accel, msg.mechanism == "append");          
        }
        let update = {
          bots: [{
            id: bot.botId,
            path: bot.fractionalPath,
            finalOrientation: bot.fractionalFinalOrientation
          }]
        };
        sendControllersUpdate(update);
      } else if (msg.action == "requestForced") {
        console.log("got forced!", msg);
        var bot = BotControl.for(msg.bot);
        bot.force(msg.forward, msg.turn, msg.topSpeed, msg.accel);
        let update = {
          bots: [{
            id: bot.botId,
            path: bot.fractionalPath,
            finalOrientation: bot.finalOrientation
          }]
        };
        sendControllersUpdate(update);
      } else if (msg.action == "requestSpeed") {
        console.log("got speed!", msg);
        var bot = BotControl.for(msg.bot);
        bot.setTopSpeed(msg.topSpeed, msg.accel);
      }
    } catch (e) {
      console.error("Unable to request path", msg, e);
      return;
    }
  });
  ws.on('close', function() {
    let index = controllers.indexOf(ws);
    if (index > -1) {
      controllers.splice(index, 1);
    }
  })
});

let updateLog = logger.named('update');

app.ws('/bot-updates', function(ws, req) {
  console.log('updates source connected');
  ws.on('message', function(msgString) {
    // console.log("Got update!", msgString);
    var msg;
    try {
      msg = JSON.parse(msgString);
    } catch (e) {
      console.error("Unable to parse update message", msgString, e);
      return;
    }
    updateLog.save(msg);
    try {
      msg.updates.forEach(function(update) {
        var control = BotControl.for(update.id);
        control.noteLocation(update.location, msg.size);
      });
    } catch (e) {
      console.error("Failed to process message updates", msg, e);
      return;
    }
    let update = {
      bots: BotControl.all().map(function(bot) {
              return {
                id: bot.botId,
                location: bot.fractionalLocation,
                path: bot.fractionalPath,
                nextAction: bot.nextAction(),
                finalOrientation: bot.finalOrientation,
                // topSpeed: bot.topSpeed
              };
            }),
      frame: msg.size
    };
    // console.log("got updates", updates);
    
    sendControllersUpdate(update);
  });
});

// Start server
app.listen(app.get('port'), function() {
  console.log('Server running on port ', app.get('port'));
});
