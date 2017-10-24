/*
 *  An express application to accept a path from an iPad
 *  and connect to the OpenCV control system for ChairBot.
 *
 */

// Require the modules needed
var express = require('express'),
    app = express();

var expressWs = require('express-ws')(app);
    bodyParser = require('body-parser'),
    fs = require('fs'),
    WebSocket = require('ws'),
    BotControl = require('./bot-control');

// Child Process
var cv = null;

// Express app setup
// app.use(function(req, res, next) {
//   req.socket.on('error', function() {
//     console.log("error on socket....disconnected?");
//   });
//   res.socket.on('error', function() {
//     console.log("error on socket....disconnected?");
//   });
//   next();
// });
app.use(bodyParser.json());
app.use(express.static('static'));
app.set('port', (process.env.PORT || 5000));
app.set('views', './pages');

var wasdInfo = {linear: 0, rotation: 0};
app.post('/wasd', function(req, res) {
  console.log(req.query.linear, req.query.rotation);
  wasdInfo = {linear: Number(req.query.linear), rotation: Number(req.query.rotation)};
  sendCommand();
  
  res.send('ok');
});

app.get('/wasd', function (req, res) {
  res.sendFile('pages/wasd.html', {root: __dirname});
});

app.get('/', function (req, res) {
  res.sendFile('pages/main.html', {root: __dirname});
});

app.post('/stop', function(req, res) {
    console.log('Neato stop request received. ');

    if(cv !== null) {
        process.kill(cv.pid + 2);
        res.send({ status: 'SUCCESS' });
    } else {
      res.send({ status: 'FAILURE' });
      console.log('could not kill CV app');
    }
});

var controllers = [];

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
    try {
      if (msg.action == "requestPath") {
        console.log("got path!", msg);
        var control = BotControl.for(msg.bot);
        control.requestPath(msg.path, msg.pathId);
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
    try {
      msg.updates.forEach(function(update) {
        var control = BotControl.for(update.id);
        control.noteLocation(update.location, msg.size);
      });
    } catch (e) {
      console.error("Failed to process message updates", msg, e);
      return;
    }
    let updates = {
      bots: BotControl.all().map(function(bot) {
              return {
                id: bot.botId,
                location: bot.fractionalLocation,
                path: bot.fractionalPath,
                nextAction: bot.nextAction()
              };
            }),
      frame: msg.size
    };
//    console.log("got updates", updates);
    
    controllers.forEach(function(ws) {
      ws.send(JSON.stringify(updates));
    });
  });
});


// Connect to neato websocket
// const ws = new WebSocket("ws://"+(process.env.NEATO_HOST || "neato-04.local:3000"));
// ws.on('error', function() {
//   console.log("NEATO socket errored out!");
// });
// ws.on('open', function() {
//   ws.on('message', function(message) {
//     if (message.startsWith('pong')) {
//       console.log("successfully connected!");
//     }
//   });
//   ws.send('ping');
// });
//
// var commandTimeout;
//
// function sendCommand() {
//   if (commandTimeout) {
//     clearTimeout(commandTimeout);
//   }
//
//   var out = {
//     speed: Math.abs(wasdInfo.linear)
//   }
//   var differential = wasdInfo.rotation;
//   if (differential != 0 && out.speed == 0) {
//     out.speed = 50;
//   }
//
//   var distance = Math.sign(wasdInfo.linear) * (out.speed * 0.6);
//
//   out.left = distance + (differential * 0.6);
//   out.right = distance - (differential * 0.6);
//
//   ws.send(JSON.stringify(out));
//
//
//   if (out.speed > 0) {
//     commandTimeout = setTimeout(sendCommand, 500);
//   }
// }

// Start server
app.listen(app.get('port'), function() {
  console.log('Server running on port ', app.get('port'));
});
