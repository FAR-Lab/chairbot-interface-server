var WebSocket = require('ws');

const TWO_PI = Math.PI * 2;

function angleDiff(from, to) {
  // can probably be simplified
  from = (from + TWO_PI) % TWO_PI;
  to = (to + TWO_PI) % TWO_PI;
  
  var fwd = (to - from + TWO_PI) % TWO_PI;
  var bkw = (from - to + TWO_PI) % TWO_PI;

	return fwd > bkw ? -bkw : fwd;
}

function lpad0(v, n) {
  var s = String(v);
  while (s.length < n) {
    s = "0"+s;
  }
  return s;
}

function connectToBot(id) {
  const ws = new WebSocket("ws://"+(process.env['NEATO_HOST_'+id] || "neato-"+lpad0(id, 2)+".local:3000"));
  ws.on('error', function() {
    console.error("NEATO socket errored out for bot", id);
  });
  ws.on('open', function() {
    ws.on('message', function(message) {
      if (message.startsWith('pong')) {
        console.log("successfully connected to bot", id);
      }
    });
    ws.send('ping');
  });
  return ws;
}

function centerOf(pts) {
  return pts.reduce((p, c, _, {length: n}) => ({x: p.x+c.x/n, y: p.y+c.y/n}), {x: 0, y: 0}); // average of points
}

function dist(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2));
}

// lack of frequent updates causes rapid magnificaiton of error. don't use this for now.
var USE_GUESSED_UPDATES = false;

// mm or mm/sec
var BASE_DIAMETER = 241; // 9.5 inches (24 cm?)
var FIDUCIAL_EDGE_SIZE = 190; // ~< 8 inches (12.7 cm?)
var ASSUMED_TIMESTEP = 0.5; // seconds
var MISSED_UPDATE_DELAY = 250;

var TOP_SPEED = 50;
var TOP_ANGULAR_SPEED = 0.3;
var ACCEL = 300;
var ANGULAR_ACCEL = 6;

var PROP_ANGLE_STEP = 1;
var RAD_ERR = 0.8;
var RAD_DEAD = 0.4;
var RAD_FINAL = 0.01;
var DIST_ERR = BASE_DIAMETER;

function BotControl(botId, skipConnection) {
  this.location = null;
  this.fractionalLocation = null;
  this.path = [];
  this.finalOrientation = null;
  this.speed = 0;
  this.topSpeed = TOP_SPEED;
  this.angularSpeed = 0;
  this.topAngularSpeed = TOP_ANGULAR_SPEED;
  this.accel = ACCEL;
  this.angularAccel = ANGULAR_ACCEL;
  this.lastUpdate = Date.now();
  this.frameSize = {width: 640, height: 480}; // temporary. gets replaced with first location update.
  
  this.botId = botId;
  
  if (! skipConnection) {
    this.socket = connectToBot(botId);
  }
}
BotControl.prototype = {
  noteLocation(location, frameSize) {
    if (USE_GUESSED_UPDATES && this.missedUpdateTimer) {
      clearTimeout(this.missedUpdateTimer);
      delete this.missedUpdateTimer;
    }
    this.frameSize = frameSize;
    
    // [{x: x1, y: y1}, .. {x: x4, y: y4}] for four corners of bot fiducial  
    this.fractionalLocation = location;
    this.location = location.map(function(pt) { return { x: pt.x*frameSize.width, y: pt.y*frameSize.height }; }); 
    this.centerPt = centerOf(this.location);
    var frontPt = centerOf(this.location.slice(0, 2));
    this.angle = Math.atan2(frontPt.y - this.centerPt.y, frontPt.x - this.centerPt.x);
    
    this.pixelsPerMm = dist(this.location[0].x, this.location[0].y, this.location[1].x, this.location[1].y) / FIDUCIAL_EDGE_SIZE;
    
    this.updateActions();
    if (USE_GUESSED_UPDATES) {
      this.missedUpdateTimer = setTimeout(this.missedUpdate.bind(this), MISSED_UPDATE_DELAY);
    }
  },
  
  missedUpdate() {
    // pretend based on motion?
    // this moves the bots in the wrong direction, don't use for now.
    var frameSize = this.frameSize
    var location = this.location;
    var centerPt = centerOf(location);
    var amountCompleted = (MISSED_UPDATE_DELAY / 1000) / ASSUMED_TIMESTEP;

    var d = amountCompleted * this.nextDistance;
    var r = amountCompleted * this.nextRotation / BASE_DIAMETER; // back to angle!
    for (var i = 0; i < 10; i++) { // discrete faking of distance + rotation into offsets.
      var dx = d/10 * Math.cos(r/10);
      var dy = d/10 * Math.sin(r/10);
      location = location.map(function(pt) { 
        // rotate around center
        var rx = (pt.x-centerPt.x) * Math.cos(r/10) - (pt.y-centerPt.y) * Math.sin(r/10);
        var ry = (pt.x-centerPt.x) * Math.sin(r/10) + (pt.y-centerPt.y) * Math.cos(r/10);
        return { x: centerPt.x + dx + rx, y: centerPt.y + dy + ry }; 
      });
      centerPt = centerOf(location);
    }
    var fractionalLocation = location.map(function(pt) { return { x: pt.x / frameSize.width, y: pt.y / frameSize.height }; });
    
    this.noteLocation(fractionalLocation, this.frameSize);
    // console.log("guessed update!", fractionalLocation);
  },
  
  requestPath(path, id, topSpeed, accel, append) {
    let frameSize = this.frameSize;
    console.log("path requested for bot", this.botId, "path is", path);
    if (append) {
      this.fractionalPath = (this.fractionalPath || []).concat(path)
    } else {
      this.fractionalPath = path;      
    }
    this.finalOrientation = null;
    this.fractionalFinalOrientation = null;
    console.log("new path for bot", this.botId, "is", this.fractionalPath);
    this.path = this.fractionalPath.map(function(pt) { return { x: pt.x*frameSize.width, y: pt.y*frameSize.height }; }); 
    this.pathid = id;
    this.setTopSpeed(topSpeed, accel);
    delete this.forcedMotion;
    this.updateActions();
    
    console.log("path is now", this.path);
  },
  
  orient(finalOrientation, id, topSpeed, accel) {
    let frameSize = this.frameSize;
    console.log("final orientation for bot", this.botId, "orientation is", finalOrientation);
    this.fractionalFinalOrientation = finalOrientation;
    this.finalOrientation = { x: finalOrientation.x*frameSize.width, y: finalOrientation.y*frameSize.height };
    this.setTopSpeed(topSpeed, accel);
    this.updateActions();
  },

  forcedTimeLeft() { // millis
    if (! this.forcedMotion) {
      return 0;
    } else {
      return this.forcedMotion.until - new Date();
    }
  },
  
  force(fwd, turn, topSpeed, accel) {
    this.path = [];
    this.fractionalPath = [];
    this.finalOrientation = null;
    this.fractionalFinalOrientation = null;
    this.forcedMotion = {
      forward: fwd,
      turn: turn,
      until: Date.now() + ASSUMED_TIMESTEP * 1000,
    }
    this.setTopSpeed(topSpeed, accel);
    delete this.pathid;

    this.updateActions();
  },
  
  setTopSpeed(topSpeed, accel) {
    this.topSpeed = topSpeed;
    this.topAngularSpeed = topSpeed / TOP_SPEED * TOP_ANGULAR_SPEED;
    this.accel = accel;
    this.angularAccel = accel / ACCEL * ANGULAR_ACCEL;
  },
  
  distance(from, to) {
    if (! to) {
      to = from;
      from = this.centerPt;
    }
    
    return dist(from.x, from.y, to.x, to.y) / this.pixelsPerMm;
  },
  
  angleTo(toPoint) {
    return Math.atan2(toPoint.y - this.centerPt.y, toPoint.x - this.centerPt.x);
  },
  
  updateActions() {
    while(this.path.length > 0 && this.distance(this.path[0], this.centerPt) < BASE_DIAMETER/1.5) { // 1.5: just a little bit of wiggle room
      console.log("skipping point", this.path[0], "distance", this.distance(this.path[0], this.centerPt));
      this.path.shift();
      this.fractionalPath.shift();
    }
    if (this.finalOrientation && Math.abs(this.angleTo(this.finalOrientation)) < RAD_FINAL) {
      delete this.finalOrientation;
      delete this.fractionalFinalOrientation;
    }
    this.pathDistanceRemaining = this.path.reduce((p, c) => (
      { to: c, distanceSoFar: p.distanceSoFar + this.distance(p.to, c) }
    ), { to: this.centerPt, distanceSoFar: 0 }).distanceSoFar;
    this.nextTarget = this.path[0];
    
    this.setTargetRotation();
    this.setTargetSpeed();
    this.updateSpeeds();
    
    if (this.forcedMotion && this.forcedTimeLeft() <= 0) { // no time left
      delete this.forcedMotion;
    }
    
    this.sendAction();
  },
  
  // rotation is radians / sec
  setTargetRotation() {
    if (this.forcedMotion) {
      this.targetAngularSpeed = this.forcedMotion.turn * this.topAngularSpeed;
      return;
    }
    if (! this.nextTarget && ! this.finalOrientation) {
      this.targetAngularSpeed = 0;
      return;
    }
    this.targetAngle = this.angleTo(this.nextTarget || this.finalOrientation);

    var ad = angleDiff(this.angle, this.targetAngle);
    var absad = Math.abs(ad);

      // 1/2 a * t^2 = d ; vf = a * t ; t = sqrt(2 * d/a) = vf / a ; vf = a * sqrt(2 d /a) = sqrt(2*d*a*a / a) = sqrt(2da)
    var topSpeedToHitTarget = Math.min(Math.sqrt(2 * absad * this.angularAccel) * 0.9, this.topAngularSpeed);
      
    if (Math.abs(ad) > Math.abs(PROP_ANGLE_STEP)) { // TOP_ANGULAR_SPEED * ASSUMED_TIMESTEP) {
      this.targetAngularSpeed = Math.sign(ad) * topSpeedToHitTarget;
    } else {
      this.targetAngularSpeed = ad / Math.abs(PROP_ANGLE_STEP) * topSpeedToHitTarget;
    }

    // console.log("next rotation is", this.targetAngularSpeed);
  },
  
  setTargetSpeed() {
    if (this.forcedMotion) {
      this.targetSpeed = this.forcedMotion.forward * this.topSpeed;
      return;
    }
    if (! this.nextTarget) {
      this.targetSpeed = 0;
      return;
    }
    
    var ad = angleDiff(this.angle, this.targetAngle);
    var topSpeedToHitTarget = Math.min(Math.sqrt(2 * this.pathDistanceRemaining * this.accel) * 0.9, this.topSpeed);

    if (Math.abs(ad) > RAD_ERR) {
      this.targetSpeed = 0;
    } else if (Math.abs(ad) < RAD_DEAD) {
      this.targetSpeed = topSpeedToHitTarget;
    } else {
      var angleFactor = (RAD_ERR-Math.abs(ad)-RAD_DEAD) / (RAD_ERR-RAD_DEAD);
      this.targetSpeed = angleFactor * topSpeedToHitTarget;
    }
    // console.log("next speed is", this.targetSpeed);
  },
  
  updateSpeeds() {
    var now = Date.now();
    var dt = (now - this.lastUpdate) / 1000;
    
    if (this.targetSpeed > this.speed) {
      this.speed += Math.min(this.accel * dt, this.targetSpeed - this.speed);
    } else {
      this.speed += Math.max(-this.accel * dt, this.targetSpeed - this.speed);
    }

    if (this.targetAngularSpeed > this.angularSpeed) {
      this.angularSpeed += Math.min(this.angularAccel * dt, this.targetAngularSpeed - this.angularSpeed);
    } else {
      this.angularSpeed += Math.max(-this.angularAccel * dt, this.targetAngularSpeed - this.angularSpeed);
    }

    // console.log("speeds:", this.speed, "->", this.targetSpeed, "angles:", this.angularSpeed, "->", this.targetAngularSpeed);
      
    this.lastUpdate = now;
  },
  
  sendCommand(obj) {
    if (this.socket) {
      try {
        this.socket.send(JSON.stringify(obj));
      } catch (e) {
        console.error("failed to send command", obj, "to bot", this.botId);
      }
    }
  },
  
  nextAction() {
    if (Math.abs(this.speed) > 0.1 || Math.abs(this.angularSpeed) > 0.01 || this.nextTarget || this.forcedMotion) {
      var leftSpeed = this.speed;
      var rightSpeed = this.speed;
      
      var angularSpeed = this.angularSpeed * BASE_DIAMETER/2;
      leftSpeed += angularSpeed;
      rightSpeed -= angularSpeed;

      // console.log("getting action!", this.speed, angularSpeed, leftSpeed, rightSpeed);
	
      var isStopped = Math.abs(leftSpeed) < 0.01 && Math.abs(rightSpeed) < 0.01 

      var leftDistance = leftSpeed * ASSUMED_TIMESTEP;
      var rightDistance = rightSpeed * ASSUMED_TIMESTEP;      

      return {
        left: isStopped && ! this.isStopped ? -1 : -rightDistance,
        right: isStopped && ! this.isStopped ? -1 : -leftDistance,
        speed: isStopped ? 0 : Math.min(Math.max(Math.abs(leftSpeed), Math.abs(rightSpeed)), 300),
        accel: this.accel
      }
      this.isStopped = isStopped;
    } else {
      return null;
    }
  },
  
  sendAction() {
    var action = this.nextAction();
    if (action) {
      this.sendCommand(action);      
    }
  }
}


BotControl.for = function(id) {
  if (id === null || id === undefined) {
    return;
  }
  id = Number(id);
  if (! this.controllers) {
    this.controllers = {};
  }
  if (! this.controllers[id]) {
    this.controllers[id] = new BotControl(id);
  }
  return this.controllers[id];
}
BotControl.all = function() {
  return Object.keys(this.controllers).map(function(k) { return BotControl.controllers[k] });
}

module.exports = BotControl;
