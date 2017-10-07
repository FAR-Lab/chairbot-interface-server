/*
 *  An express application to accept a path from an iPad
 *  and connect to the OpenCV control system for ChairBot.
 *
 */

// Require the modules needed
var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    fs = require('fs'),
    exec = require('child_process').exec,
    WebSocket = require('ws'),
    spawn = require('child_process').spawn;

// Child Process
var cv = null;

// Connect to neato websocket

// Express app setup
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

app.get('/', function (req, res) {
  res.sendFile('pages/main.html', {root: __dirname});
});

// Define /path route
app.post('/path', function(req, res) {

  // Prepare write stream for the YAML path file to be written
  var stream = fs.createWriteStream("../path_0.yml");
  stream.write("%YAML:1.0\n");
  stream.write("features:\n");

  // Write the path array to the file
  req.body.path.forEach(function(element) {
    stream.write("   - { x:");
    stream.write(String(element[0]));
    stream.write(", y:");
    stream.write(String(element[1]));
    stream.write(" }\n");
  });

  console.log("Path received and printed. ");


  // Execute the OpenCV control system

  const defaults = {
    cwd: "/home/ubuntu-cdr/Chairbot/chairbot-control/",
    shell: true,
    env: null,
  }

    /*
  cv = spawn("../CV1", defaults, function(err, stdout, stderr) {
    if (err) {
        console.log('Child process exited with error code', err.code);
        return;
    }

    console.log(stdout);
  });
    */
    cv = spawn("sh", [ "runCV.sh" ], defaults);

  res.send({ status: 'SUCCESS' });
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

const ws = new WebSocket("ws://"+(process.env.NEATO_HOST || "neato-04.local:3000"));
ws.on('open', function() {
  ws.on('message', function(message) {
    if (message.startsWith('pong')) {
      console.log("successfully connected!");
    }
  });
  ws.send('ping');
});

var commandTimeout;

function sendCommand() {
  if (commandTimeout) {
    clearTimeout(commandTimeout);
  }

  var out = {
    speed: Math.abs(wasdInfo.linear)
  }
  var differential = wasdInfo.rotation;
  if (differential != 0 && out.speed == 0) {
    out.speed = 50;
  }

  var distance = Math.sign(wasdInfo.linear) * (out.speed * 0.6);

  out.left = distance + (differential * 0.6);
  out.right = distance - (differential * 0.6);

  ws.send(JSON.stringify(out));


  if (out.speed > 0) {
    commandTimeout = setTimeout(sendCommand, 500);
  }
}

// Start server
app.listen(app.get('port'), function() {
  console.log('Server running on port ', app.get('port'));
});
