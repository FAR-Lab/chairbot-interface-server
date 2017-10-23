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

// mm or mm/sec
var TOP_SPEED = 300;
var TOP_ANGULAR_SPEED = 150;
var BASE_DIAMETER = 241 // 9.5 inches (24 cm?)
var FIDUCIAL_EDGE_SIZE = 203; // 8 inches (20.3 cm?)
var ASSUMED_TIMESTEP = 0.1; // seconds

function BotControl(botId, skipConnection) {
  this.location = null;
  this.fractionalLocation = null;
  this.path = [];
  
  this.botId = botId;
  
  if (! skipConnection) {
    this.socket = connectToBot(botId);
  }
}
BotControl.prototype = {
  noteLocation(location, frameSize) {
    this.frameSize = frameSize;
    // [{x: x1, y: y1}, .. {x: x4, y: y4}] for four corners of bot fiducial
    this.fractionalLocation = location;
    this.location = location.map(function(pt) { return { x: pt.x*frameSize.width, y: pt.y*frameSize.height }; }); 
    this.centerPt = centerOf(this.location);
    var frontPt = centerOf(this.location.slice(0, 2));
    this.angle = Math.atan2(frontPt.y - this.centerPt.y, frontPt.x - this.centerPt.x);
    
    this.pixelsPerMm = dist(this.location[0].x, this.location[0].y, this.location[1].x, this.location[1].y) / FIDUCIAL_EDGE_SIZE;
    console.log("pixelsPermm", this.pixelsPerMm);
    
    this.updateActions();
  },
  
  requestPath(path, id) {
    let frameSize = this.frameSize;
    console.log("path requested for bot", this.botId, "path is", path);
    this.fractionalPath = path;
    this.path = path.map(function(pt) { return { x: pt.x*frameSize.width, y: pt.y*frameSize.height }; }); 
    this.pathid = id;
    this.updateActions();
    console.log("path is now", this.path);
  },
    
  distance(from, to) {
    if (! to) {
      to = from;
      from = this.centerPt;
    }
    
    return dist(from.x, from.y, to.x, to.y) / this.pixelsPerMm;
  },
  
  updateActions() {
    while(this.path.length > 0 && this.distance(this.path[0], this.centerPt) < BASE_DIAMETER) {
      console.log("skipping point", this.path[0], "distance", this.distance(this.path[0], this.centerPt));
      this.path.shift();
      this.fractionalPath.shift();
    }
    this.nextTarget = this.path[0];
    
    this.updateRotation();
    this.updateSpeed();
    
    this.sendAction();
  },
  
  // rotation is radians / sec
  updateRotation() {
    if (! this.nextTarget) {
      this.nextRotation = 0;
      return;
    }
    this.targetAngle = Math.atan2(this.nextTarget.y - this.centerPt.y, this.nextTarget.x - this.centerPt.x);

    var ad = angleDiff(this.angle, this.targetAngle);
    var angleDistance = ad * BASE_DIAMETER; 
    if (angleDistance > 0) {
      this.nextRotation = Math.min(angleDistance, TOP_ANGULAR_SPEED * ASSUMED_TIMESTEP);
    } else {
      this.nextRotation = Math.max(angleDistance, -TOP_ANGULAR_SPEED * ASSUMED_TIMESTEP);
    }
    console.log("next rotation is", this.nextRotation);
  },
  
  updateSpeed() {
    if (! this.nextTarget) {
      this.nextDistance = 0;
      return;
    }
    var ad = angleDiff(this.angle, this.targetAngle);
    if (Math.abs(ad) < 0.05) {
      this.nextDistance = Math.min(TOP_SPEED * ASSUMED_TIMESTEP, this.distance(this.centerPt, this.nextTarget));
    } else {
      this.nextDistance *= 0.5;
    }
    console.log("next distance is", this.nextDistance);
  },
  
  sendCommand(obj) {
    console.log()
    if (this.socket) {
      try {
        this.socket.send(JSON.stringify(obj));
      } catch (e) {
        console.error("failed to send command", obj, "to bot", this.botId);
      }
    }
  },
  
  nextAction() {
    if (this.nextTarget) {
      var left = this.nextDistance || 0;
      var right = this.nextDistance || 0;
      left += this.nextRotation || 0;
      right -= this.nextRotation || 0;

      return {
        left: left,
        right: right,
        speed: TOP_SPEED
      }
    } else {
      return null;
    }
  },
  
  sendAction() {
    var action = this.nextAction();
    if (action) {
      this.sendCommand(this.nextAction());      
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