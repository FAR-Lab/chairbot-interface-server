var restrictedFiducialId = window.location.hash.startsWith('#') ? Number(window.location.hash.substr(1)) : null;
var socket;

function connectNewSocket() {
  socket = new WebSocket("ws://"+document.location.host+"/web-controller");
  socket.onmessage = function(event) {
    let data = JSON.parse(event.data);
    data.bots.forEach(handleUpdate);
  }
  socket.onopen = function(event) {
    socket.onclose = function() {
      setTimeout(connectNewSocket, 500);
    }
  }
}
$(connectNewSocket);

function pathId() {
  return ""+Math.round(Math.random()*1e7);
}

function appendToPath(fiducialKey, path, topSpeed, accel) {
  console.log("requesting path append", fiducialKey, path);
  let pid = pathId();
  socket.send(JSON.stringify({
    action: "requestPath",
    mechanism: "append",
    bot: fiducialKey,
    pathId: pid,
    path: path,
    topSpeed: topSpeed,
    accel: accel
  }));
}

function sendPath(fiducialKey, path, topSpeed, accel) {
  console.log("requesting path", fiducialKey, path);
  let pid = pathId();
  socket.send(JSON.stringify({
    action: "requestPath",
    mechanism: "replace",
    bot: fiducialKey,
    pathId: pid,
    path: path,
    topSpeed: topSpeed,
    accel: accel
  }));
}

function sendOrientation(fiducialKey, finalOrientation, topSpeed, accel) {
  console.log("requesting path append", fiducialKey, finalOrientation);
  let pid = pathId();
  socket.send(JSON.stringify({
    action: "requestPath",
    mechanism: "orient",
    bot: fiducialKey,
    pathId: pid,
    finalOrientation: finalOrientation,
    topSpeed: topSpeed,
    accel: accel
  }));
}

function sendForce(fiducialKey, forcedForward, forcedTurn, topSpeed, accel) {
  console.log("requesting force", fiducialKey, forcedForward, forcedTurn);
  socket.send(JSON.stringify({
    action: "requestForced",
    bot: fiducialKey,
    forward: forcedForward,
    turn: forcedTurn,
    topSpeed: topSpeed,
    accel: accel
  }));
}

function sendSpeed(fiducialKey, topSpeed, accel) {
  console.log("updating speed", fiducialKey, topSpeed, accel);
  socket.send(JSON.stringify({
    action: "requestSpeed",
    bot: fiducialKey,
    topSpeed: topSpeed,
    accel: accel
  }));
}

var theViewer;
function handleUpdate(update) {
  if (theViewer) {
    theViewer.handleUpdate(update);
  }
}

function centerOf(pts) {
  return pts.reduce((p, c, _, {length: n}) => ({x: p.x+c.x/n, y: p.y+c.y/n}), {x: 0, y: 0}); // average of points
}

function distance(p1, p2) {
  return p1 == null || p2 == null ? Number.POSITIVE_INFINITY : Math.sqrt(Math.pow(p2.x-p1.x, 2) + Math.pow(p2.y-p1.y, 2));
}

function scale(pt, scale) {
  return pt ? {x: scale*pt.x, y: scale*pt.y} : {x: 0, y: 0};
}

function minus(p1, p2) {
  return p1 && p2 ? {x: p1.x-p2.x, y: p1.y-p2.y}: {x: 0, y: 0};
}

function plus(p1, p2) {
  return p1 && p2 ? {x: p1.x+p2.x, y: p1.y+p2.y}: {x: 0, y: 0};
}


class ChairBot extends React.Component {
  location() {
    return this.props.status.location.map(pt => scale(pt, 1000));
  }
  
  centerPt() {
    return centerOf(this.location());
  }
  
  chair() {
    let loc = this.location();
    // console.log("path from", loc);
    let [p1, p2, p3, p4] = loc;
    let cpt = centerOf(loc);
    let dir = centerOf([p1, p2]);
    
    return `M${p1.x},${p1.y}L${p2.x},${p2.y}L${p3.x},${p3.y}L${p4.x},${p4.y}Z M${cpt.x},${cpt.y}L${dir.x},${dir.y}`;
  }
  
  path() {
    let points = (this.props.status.path || []).map(pt => scale(pt, 1000));
    if (points.length > 0) {
      return "M" + points.map(({x, y}) => `${x},${y}`).join("L")
    } else {
      return "";
    }
  }

  selectChairbot(event) {
    this.props.selectChairbot();
    event.preventDefault();
    event.stopPropagation();
  }
  
  render() {
    if (! this.props.status.location) {
      return null;
    }
    let cpt = this.centerPt();
    return <g>
      <path d={this.chair()} strokeWidth="5" stroke={this.props.isDraggable ? "#0a0" : "#000"} fill="none" strokeLinejoin="round"/>
      {this.props.status.path ? 
        <g stroke="#a00"><PathView path={[scale(cpt, 1/1000)].concat(this.props.status.path)} finalTick={this.props.status.finalOrientation} /></g> :
        ""}
      <circle cx={cpt.x} cy={cpt.y} r="30" fill="#fff" opacity="0.5"/>
        <text x={cpt.x-15} y={cpt.y+15} fontFamily="Verdana" fontSize="40" fill="#000" onMouseDown={(event) =>  this.selectChairbot(event)} onTouchStart={(event) => this.selectChairbot(event)}>{this.props.status.id}</text>
    </g>
  }
}

class PathView extends React.Component {
  path() {
    let loc = this.props.path.map(pt => scale(pt, 1000));
    return `M${loc.map(pt => `${pt.x},${pt.y}`).join('L')}`;
  }
  
  tick() {
    if (this.props.path.length > 0) {
      var loc;
      if (this.props.finalTick) {
        loc = [this.props.path[this.props.path.length-1], this.props.finalTick];
      } else {
        let endPt = this.props.path[this.props.path.length-1];
        let farEnoughIndex = this.props.path.length-2;
        while (farEnoughIndex >= 0 && distance(endPt, this.props.path[farEnoughIndex]) < .01) {
          farEnoughIndex--;
        }
        if (farEnoughIndex >= 0) {
          loc = [this.props.path[farEnoughIndex], endPt];
        } else {
          return;
        }
      }
      loc = loc.map(pt => scale(pt, 1000))

      let delta = minus(loc[1], loc[0]);
      console.log("length is", distance(loc[0], loc[1]), "delta is", delta);
      loc[1] = plus(loc[this.props.finalTick ? 0 : 1], scale(delta, 30/distance(loc[0], loc[1])))
      return `M${loc.map(pt => `${pt.x},${pt.y}`).join('L')}`;
    }
  }
  
  render() {
    let tick = this.tick();
    
    return <React.Fragment>
      <path d={this.path()} strokeWidth="10" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
      {tick ? <path d={tick} strokeWidth="2.5" fill="none" strokeLinecap="round" /> : ''}
    </React.Fragment>
  }
}

class KeyButton extends React.Component {
  render() {
    let props = this.props;
    let handler = props.handler;
    let key = this.props.keyChar;
    let text = this.props.text || key;
    return <button
            className={props.pressed ? "active" : ""}
            onMouseDown={() => handler.handleKeyDown(key)}
            onTouchStart={(event) => { handler.handleKeyDown(key); event.preventDefault(); }}
            onMouseUp={() => handler.handleKeyUp(key)}
            onMouseLeave={() => handler.handleKeyUp(key)}
            onTouchCancel={() => handler.handleKeyUp(key)}
            onTouchEnd={() => handler.handleKeyUp(key)} >
        {text}
      </button>
    
  }
}

function pt(r, a) {
  let rad = a*Math.PI/180;
  return `${-r*Math.sin(rad)} ${-r*Math.cos(rad)}`;
}
function map(value, imin, imax, omin, omax) {
  return (value-imin) / (imax-imin) * (omax-omin) + omin;
}
function sigfig(v, n) {
  let factor = Math.pow(10, n);
  return Math.round(v * factor) / factor;
}

class TouchTargetEventHandler {
  constructor(target) {
    this.target = target;
  }
  
  mousePosition(event) {
    if (! ('pageX' in event) && ! (event.nativeEvent.touches.length > 0)) {
      return null;
    }
    let bounds = ReactDOM.findDOMNode(this.target.svg).getBoundingClientRect();
    console.log(bounds);
    return {
      x: ('pageX' in event ? event.pageX - bounds.x : this.currentTouch(event).pageX - bounds.x) / bounds.width, 
      y: ('pageY' in event ? event.pageY - bounds.y : this.currentTouch(event).pageY - bounds.y) / bounds.height
    }
  }

  currentTouch(event) {
    var touches = event.nativeEvent.touches;
    for (var i = 0; i < touches.length; i++) {
      if (touches[i].identifier == this.touch) {
        return touches[i];
      }
    }
  }
  
  mouseDown(event) {
    this.isDown = true;
    this.target.updateCommand(event);
  }
  touchStart(event) {
    if (event.nativeEvent.touches) {
      this.touch = event.nativeEvent.touches[event.nativeEvent.touches.length-1].identifier;
    }
    this.mouseDown(event);
    event.preventDefault();
    return false;
  }
  mouseMove(event) {
    if (this.isDown) {
      this.target.updateCommand(event);
    }
  }
  touchMove(event) {
    this.mouseMove(event);
    event.preventDefault();
    return false;
  }
  mouseUp(event) {
    this.isDown = false;
    this.target.zeroCommand(0);
  }
  mouseLeave(event) {
    if (this.isDown) {
      this.mouseUp(event);
    }
  }
  touchEnd(event) {
    this.mouseUp(event);
    event.preventDefault();
    return false;
  }
  
  get handlers() {
    return {
      onMouseDown:   this.mouseDown .bind(this),
      onTouchStart:  this.touchStart.bind(this),
      onMouseMove:   this.mouseMove .bind(this),
      onTouchMove:   this.touchMove .bind(this),
      onMouseUp:     this.mouseUp   .bind(this),
      onMouseLeave:  this.mouseLeave.bind(this),
      onTouchEnd:    this.touchEnd  .bind(this),
      onTouchCancel: this.touchEnd  .bind(this)
    };
  }
}

class SpeedDragTarget extends React.Component {
  constructor(props) {
    super(props);
    this.targetWidth = 40;
    this.innerRadius = 40;
    this.outerRadius = 10;
    
    this.eventHandler = new TouchTargetEventHandler(this);
  }
  
  updateCommand(event) {
    let {deadZones, angleZones} = this;
    let bounds = ReactDOM.findDOMNode(this.svg).getBoundingClientRect();
    let pos = this.eventHandler.mousePosition(event);
    if (pos) {
      console.log("Force Drag at", pos);
      // let d = distance(pos, {x: 0.5, y: 0.5});
      var speed = Math.max(Math.min((-pos.y + 0.5) / (this.innerRadius/bounds.height), 1), -1);

      this.props.update(speed);
    }
  }
  
  zeroCommand() {
    this.props.update(0);
  }
  
  render() {
    let {targetWidth, innerRadius, outerRadius} = this;
    let r = innerRadius + outerRadius;
    let ir = innerRadius;
    
    let segments = <g>
      <path d={`M 0 0 L${pt(r, -targetWidth/2)} A${r} ${r} 0 0 0 ${pt(r, targetWidth/2)} z`} fill="darkgreen" stroke="white" strokeWidth="2"/>
      <path d={`M 0 0 L${pt(r, 180-targetWidth/2)} A${r} ${r} 0 0 0 ${pt(r, 180+targetWidth/2)} z`} fill="darkred" stroke="white" strokeWidth="2"/>

      <path d={`M 0 0 L${pt(ir, -targetWidth/2)} A${r} ${r} 0 0 0 ${pt(ir, targetWidth/2)} z`} fill="green" stroke="white" strokeWidth="2"/>
      <path d={`M 0 0 L${pt(ir, 180-targetWidth/2)} A${r} ${r} 0 0 0 ${pt(ir, 180+targetWidth/2)} z`} fill="red" stroke="white" strokeWidth="2"/>
    </g>
    
    return <div>
      <svg 
          id="drag-target-view" 
          style={{width: 2*(r+2), height: 2*(r+2)}}
          viewBox={`${-(r+2)} ${-(r+2)} ${2*(r+2)} ${2*(r+2)}`}
          preserveAspectRatio="none"
          ref={(ref) => this.svg = ref}
          {...this.eventHandler.handlers} >
        {segments}
      </svg>
      <p>Speed: {sigfig(this.props.forcedForward, 2)} — Turn: {sigfig(this.props.forcedTurn, 2)}</p>
    </div>
  }
}


class TurnDragTarget extends React.Component {
  constructor(props) {
    super(props);
    this.targetWidth = 40;
    this.innerRadius = 40;
    this.outerRadius = 10;
    
    this.eventHandler = new TouchTargetEventHandler(this);
  }
  
  updateCommand(event) {
    let {deadZones, angleZones} = this;
    let bounds = ReactDOM.findDOMNode(this.svg).getBoundingClientRect();
    let pos = this.eventHandler.mousePosition(event);
    if (pos) {
      console.log("Force Drag at", pos);
      // let d = distance(pos, {x: 0.5, y: 0.5});
      var turn = Math.max(Math.min((pos.x - 0.5) / (this.innerRadius/bounds.height), 1), -1);

      this.props.update(turn);
    }
  }
  
  zeroCommand() {
    this.props.update(0);
  }
  
  render() {
    let {targetWidth, innerRadius, outerRadius} = this;
    let r = innerRadius + outerRadius;
    let ir = innerRadius;
    
    let segments = <g>
      <path d={`M 0 0 L${pt(r, 90-targetWidth/2)} A${r} ${r} 0 0 0 ${pt(r, 90+targetWidth/2)} z`} fill="deepskyblue" stroke="white" strokeWidth="2"/>
      <path d={`M 0 0 L${pt(r, 270-targetWidth/2)} A${r} ${r} 0 0 0 ${pt(r, 270+targetWidth/2)} z`} fill="coral" stroke="white" strokeWidth="2"/>


      <path d={`M 0 0 L${pt(ir, 90-targetWidth/2)} A${r} ${r} 0 0 0 ${pt(ir, 90+targetWidth/2)} z`} fill="lightblue" stroke="white" strokeWidth="2"/>
      <path d={`M 0 0 L${pt(ir, 270-targetWidth/2)} A${r} ${r} 0 0 0 ${pt(ir, 270+targetWidth/2)} z`} fill="orange" stroke="white" strokeWidth="2"/>
    </g>
    
    
    return <div>
      <svg 
          id="drag-target-view" 
          style={{width: 2*(r+2), height: 2*(r+2)}}
          viewBox={`${-(r+2)} ${-(r+2)} ${2*(r+2)} ${2*(r+2)}`}
          preserveAspectRatio="none"
          ref={(ref) => this.svg = ref}
          {...this.eventHandler.handlers} >
        {segments}
      </svg>
    </div>
  }
}

class ForceDragTarget extends React.Component {
  constructor(props) {
    super(props);
    this.deadZones = 20; // degrees spanning straight up/down
    this.angleZones = 160;
    this.innerRadius = 40;
    this.outerRadius = 10;
    
    this.eventHandler = new TouchTargetEventHandler(this);
  }
  
  updateCommand(event) {
    let {deadZones, angleZones} = this;
    let bounds = ReactDOM.findDOMNode(this.svg).getBoundingClientRect();
    let pos = this.eventHandler.mousePosition(event);
    if (pos) {
      console.log("Force Drag at", pos);
      // let d = distance(pos, {x: 0.5, y: 0.5});
      var speed = Math.max(Math.min((-pos.y + 0.5) / (this.innerRadius/bounds.height), 1), -1);
      var turn = 0;
      
      let ang = (Math.atan2(pos.y-0.5, pos.x-0.5) * 180/Math.PI + 90);
      if (ang > 180) {
        ang = ang-360;
      }
      console.log("angle is", ang);
      if (ang > this.deadZones/2 && ang < this.angleZones/2) {
        turn = map(ang, this.deadZones/2, this.angleZones/2, 0, speed);
      } else if (ang > 180-this.angleZones/2 && ang < 180-this.deadZones/2) {
        turn = map(ang, 180-this.deadZones/2, 180-this.angleZones/2, 0, speed);
      } else if (ang < -this.deadZones/2 && ang > -this.angleZones/2) {
        turn = map(ang, -this.deadZones/2, -this.angleZones/2, 0, -speed);
      } else if (ang < -180+this.angleZones/2 && ang > -180+this.deadZones/2) {
        turn = map(ang, -180+this.deadZones/2, -180+this.angleZones/2, 0, -speed);
      }
      
      this.props.update(speed, turn);
    }
  }
  
  zeroCommand() {
    this.props.update(0, 0);
  }
  
  render() {
    let {deadZones, innerRadius, outerRadius, angleZones} = this;
    let r = innerRadius + outerRadius;
    let ir = innerRadius;
    
    let segments = <g>
      <path d={`M 0 0 L${pt(r, -deadZones/2)} A${r} ${r} 0 0 0 ${pt(r, deadZones/2)} z`} fill="darkgreen" stroke="white" strokeWidth="2"/>
      <path d={`M 0 0 L${pt(r, 180-deadZones/2)} A${r} ${r} 0 0 0 ${pt(r, 180+deadZones/2)} z`} fill="darkred" stroke="white" strokeWidth="2"/>
      <path d={`M 0 0 L${pt(r, deadZones/2)} A${r} ${r} 0 0 0 ${pt(r, angleZones/2)} z`} fill="blue" stroke="white" strokeWidth="2"/>
      <path d={`M 0 0 L${pt(r, 180-angleZones/2)} A${r} ${r} 0 0 0 ${pt(r, 180-deadZones/2)} z`} fill="blue" stroke="white" strokeWidth="2"/>
      <path d={`M 0 0 L${pt(r, -angleZones/2)} A${r} ${r} 0 0 0 ${pt(r, -deadZones/2)} z`} fill="blue" stroke="white" strokeWidth="2"/>
      <path d={`M 0 0 L${pt(r, -180+deadZones/2)} A${r} ${r} 0 0 0 ${pt(r, -180+angleZones/2)} z`} fill="blue" stroke="white" strokeWidth="2"/>



      <path d={`M 0 0 L${pt(ir, -deadZones/2)} A${r} ${r} 0 0 0 ${pt(ir, deadZones/2)} z`} fill="green" stroke="white" strokeWidth="2"/>
      <path d={`M 0 0 L${pt(ir, 180-deadZones/2)} A${r} ${r} 0 0 0 ${pt(ir, 180+deadZones/2)} z`} fill="red" stroke="white" strokeWidth="2"/>
      <path d={`M 0 0 L${pt(ir, deadZones/2)} A${r} ${r} 0 0 0 ${pt(ir, angleZones/2)} z`} fill="#55f" stroke="white" strokeWidth="2"/>
      <path d={`M 0 0 L${pt(ir, 180-angleZones/2)} A${r} ${r} 0 0 0 ${pt(ir, 180-deadZones/2)} z`} fill="#55f" stroke="white" strokeWidth="2"/>
      <path d={`M 0 0 L${pt(ir, -angleZones/2)} A${r} ${r} 0 0 0 ${pt(ir, -deadZones/2)} z`} fill="#55f" stroke="white" strokeWidth="2"/>
      <path d={`M 0 0 L${pt(ir, -180+deadZones/2)} A${r} ${r} 0 0 0 ${pt(ir, -180+angleZones/2)} z`} fill="#55f" stroke="white" strokeWidth="2"/>
    </g>
    
    
    return <div>
      <svg 
          id="drag-target-view" 
          style={{width: 2*(innerRadius+outerRadius+2), height: 2*(innerRadius+outerRadius+2)}}
          viewBox={`${-(innerRadius+outerRadius+2)} ${-(innerRadius+outerRadius+2)} ${2*(innerRadius+outerRadius+2)} ${2*(innerRadius+outerRadius+2)}`}
          preserveAspectRatio="none"
          ref={(ref) => this.svg = ref}
          {...this.eventHandler.handlers} >
        {segments}
      </svg>
      <p>Speed: {sigfig(this.props.forcedForward, 2)} — Turn: {sigfig(this.props.forcedTurn, 2)}</p>
    </div>
  }
}

class SliderToggle extends React.Component {
  mouseDown() {
    this.props.toggle();
  }
  
  render() {
    let toggleStyle = {
      width: this.props.width || 50,
      height: this.props.height || 20,
      borderRadius: (this.props.height || 20) / 3,
      boxShadow: "inset 0 0 10px #000000",
      position: "relative",
      display: "inline-block",
      top: 4,
      margin: "0px 5px"
    }
    let sliderStyle = {
      width: toggleStyle.width / 2.1,
      height: toggleStyle.height * 0.9,
      background: "green",
      borderRadius: toggleStyle.borderRadius,
      boxShadow: "inset 0 0 5px darkgreen",
      position: "absolute",
      left: this.props.toggled ? toggleStyle.width - (toggleStyle.width/2.1) - toggleStyle.height * 0.05 : toggleStyle.height * 0.05,
      top: toggleStyle.height * 0.05,
      transition: "left 0.25s ease-in-out 0"
    }
    return <span style={toggleStyle} onMouseDown={() => this.mouseDown()} onTouchEnd={(event) => event.preventDefault()} onTouchStart={(event) => {this.mouseDown(); event.preventDefault();}}>
        <span style={sliderStyle} />
      </span>
  }
}

class DoubleDpadViewApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      restrictedFiducialId: restrictedFiducialId,
      forcedForward: 0,
      forcedTurn: 0,
      topSpeed: 50,
      accel: 300,
      analogControls: true,
      message: null
    }

    this.forcedTimer = setInterval(() => this.checkAndSendForce(), 250);
  }
  
  keyDown(event) {
    // console.log("DOWN", event.key);
    this.handleKeyDown(event.key);
  }
  
  keyUp(event) {
    // console.log("UP", event.key);
    this.handleKeyUp(event.key);
  }
  
  setForced(forward, turn) {
    this.setState({
      forcedForward: forward,
      forcedTurn: turn
    }, () => this.sendForce());
  }
  
  setForcedForward(forward) {
    this.setState({
      forcedForward: forward
    }, () => this.sendForce());    
  }

  setForcedTurn(turn) {
    this.setState({
      forcedTurn: turn
    }, () => this.sendForce());
  }
  
  handleKeyDown(key) {
    let send = false;
    let sendSpeed = false;
    this.setState(state => {
    switch(key) {
      case 'w':
        console.log('down w');
        send = true;
        return {
          forcedForward: 1 // (state.forcedForward || 0) + 1
        };
              
      case 'a':
        console.log('down a');
        send = true;
        return {
          forcedTurn: -1 // state.forcedTurn - 1
        };
    
      case 's':
        console.log('down s');
        send = true;
        return {
          forcedForward: -1 // (state.forcedForward > 0 ? 0 : (state.forcedForward || 0) - 1)
        };
      
      case 'd':
        console.log('down d');
        send = true;
        return {
          forcedTurn: 1 //state.forcedTurn + 1
        };
      
      case ' ':
        console.log('down <space>');
        send = true;
        return {
          forcedForward: 0,
          forcedTurn: 0
        };
        
      case 'p':
        console.log('down p');
        sendSpeed = true;
        return {
          isPaused: true
        };
      
      case 'p':
        console.log('down p');
        sendSpeed = true;
        return {
          isPaused: false
        };
      
      // speed
      case '[':
        console.log('down [');
        sendSpeed = true;
        return {
          topSpeed: this.state.topSpeed / 1.25,
          slowKeyPressed: true
        }
        
      case ']':
        console.log('down ]');
        sendSpeed = true;
        let newSpeed = this.state.topSpeed * 1.25;
        return {
          topSpeed: newSpeed > 300 ? this.state.topSpeed : newSpeed,
          speedKeyPressed: true
        }
        
      // accel
      case '{':
        console.log('down {');
        sendSpeed = true;
        return {
          accel: this.state.accel / 1.25,
          decelKeyPressed: true
        }
        
      case '}':
        console.log('down }');
        sendSpeed = true;
        let newAccel = this.state.accel * 1.25;
        return {
          accel: newAccel > 300 ? this.state.accel : newAccel,
          accelKeyPressed: true
        }
      }
    }, () => {
      if (send) {
        this.sendForce();
      } else if (sendSpeed) {
        this.sendSpeed();
      }
    });
    return false;
  }
  
  handleKeyUp(key) {
    let send = false;
    this.setState(state => {
      switch(key) {
      case 'w':
        console.log('up w');
        send = true;
        return {
          forcedForward: 0
        }
      case 'a':
        console.log('up a');
        send = true;
        return {
          forcedTurn: 0
        }
      case 's':
        console.log('up s');
        send = true;
        return {
          forcedForward: 0
        }
      case 'd':
        console.log('up d');
        send = true;
        return {
          forcedTurn: 0
        }
        
      // speed
      case '[':
        console.log('up [');
        return {
          slowKeyPressed: false
        }
      case ']':
        console.log('up ]');
        return {
          speedKeyPressed: false
        }              

      // accel
      case '{':
        console.log('up {');
        return {
          decelKeyPressed: false
        }
      case '}':
        console.log('up }');
        return {
          accelKeyPressed: false
        }                          
      }
    }, () => send && this.sendForce());
    return false;
  }
  
  checkAndSendForce() {
    if (this.state.forcedTurn || this.state.forcedForward) {
      this.sendForce();
    }
  }
  
  sendForce() {
    sendForce(
      this.state.restrictedFiducialId, 
      this.state.forcedForward, 
      this.state.forcedTurn, 
      this.state.topSpeed,
      this.state.accel);
  }

  sendSpeed() {
    sendSpeed(this.state.restrictedFiducialId, this.state.topSpeed, this.state.accel);
  }
  
  message(msg) {
    this.setState({
      message: msg
    });
  }
  
  connectCameraBackground() {
    var video = document.getElementById('camera');
    
    var protocol = location.protocol === "https:" ? "wss:" : "ws:";
    var wsurl = protocol + '//' + location.hostname + ':8888/webrtc'
    
    if (! this.isStreaming) {
      this.signalObj = new signal(wsurl,
        (stream) => { console.log('got a stream!', stream); video.srcObject = stream; },
        (error) => { this.message(error); },
        () => { this.message("Video channel closed."); console.log("websocket closed."); video.srcObject = null; this.isStreaming = false },
        (message) => { this.message(message); });
    }
  }
  
  componentDidMount() {
    this.connectCameraBackground();
    
    var video = document.getElementById('camera');
    video.addEventListener('canplay', (e) => { this.isStreaming = true; });
  }
  
  render() {
    let pathInProgress = this.state.pathInProgress;
    if (pathInProgress && this.state.candidate) {
      let existingPath = this.state.states[this.state.candidate].path;
      if (existingPath && existingPath.length > 0) {
        pathInProgress = [existingPath[existingPath.length-1]].concat(pathInProgress);
        console.log("using existing path!", pathInProgress);
      } else {
        pathInProgress = [this.fiducialCenter(this.state.requiredFiducialId || this.state.candidate)].concat(pathInProgress);
      }
    }
    
    var isMobile =   // will be true if running on a mobile device
      navigator.userAgent.indexOf( "Mobile" ) !== -1 || 
      navigator.userAgent.indexOf( "iPhone" ) !== -1 || 
      navigator.userAgent.indexOf( "Android" ) !== -1 || 
      navigator.userAgent.indexOf( "Windows Phone" ) !== -1 ;
    
    return <div tabIndex="0"
        onKeyDown={this.keyDown.bind(this)}
        onKeyUp={this.keyUp.bind(this)} >
      <MessageBox message={this.state.message} />
      <div className={"buttons"}>
        <p className="info">
          Top Speed: <strong>{Math.round(this.state.topSpeed*10)/10}</strong><br />
          <KeyButton pressed={this.state.slowKeyPressed} handler={this} keyChar="[" />
          <KeyButton pressed={this.state.speedKeyPressed} handler={this} keyChar="]" />
          <br />
          Acceleration: <strong>{Math.round(this.state.accel*10)/10}</strong>
          <br />
          <KeyButton pressed={this.state.decelKeyPressed} handler={this} keyChar="{" />
          <KeyButton pressed={this.state.accelKeyPressed} handler={this} keyChar="}" />
        </p>
        <div className="keyGroup">
          <p><strong>Control Style</strong><br />
            Digital 
              <SliderToggle 
                toggle={() => this.setState(state => {return {analogControls: ! state.analogControls}; })}
                toggled={this.state.analogControls} /> 
              Analog<br />
          </p>
          {this.state.analogControls ? 
            <div>
              {isMobile 
                ? <SpeedDragTarget forcedForward={this.state.forcedForward} forcedTurn={this.state.forcedTurn} update={this.setForcedForward.bind(this)}/>
                : <ForceDragTarget forcedForward={this.state.forcedForward} forcedTurn={this.state.forcedTurn} update={this.setForced.bind(this)}/>
              }
            </div> :
            [ <br />,
              <KeyButton pressed={this.state.forcedForward > 0} handler={this} keyChar="w" />,
              <br />,
              <KeyButton pressed={this.state.forcedTurn < 0} handler={this} keyChar="a" />,
              <KeyButton pressed={this.state.forcedForward < 0} handler={this} keyChar="s" />,
              <KeyButton pressed={this.state.forcedTurn > 0} handler={this} keyChar="d" />,
              <br />,
              <br />,
              <br />,
              <br />,
              <br />
            ]
          }
        </div>
      </div>
      {isMobile && this.state.analogControls ?                 
        <div className="buttons right">
          <TurnDragTarget update={this.setForcedTurn.bind(this)} />
        </div> : ""
      }
    </div>
  }
}

function MessageBox(props) {
  if (! props.message) {
    return "";
  }
  return <div className="messagebox">{props.message}</div>
}

class DragViewApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      states: {},
      restrictedFiducialId: restrictedFiducialId,
      forcedForward: 0,
      forcedTurn: 0,
      topSpeed: 50,
      accel: 300,
      analogControls: true
    }
    
    this.forcedTimer = setInterval(() => this.checkAndSendForce(), 250);
  }
  
  fiducialCenter(key) {
    let loc = this.state.states[key];
    return loc && centerOf(loc.location);
  }
  fiducialPathEnd(key) {
    let loc = this.state.states[key];
    return loc && loc.path && loc.path.length > 0 && loc.path[loc.path.length-1];
  }

  mousePosition(event, touchId) {
    var touchIndex = 0;
    if (typeof touchId == "number") {
      touchIndex = event.nativeEvent.touches.indexOf(touch => touch.identifier == touchId);
      if (touchIndex < 0) {
        return null;
      }
    }
    if (! ('pageX' in event) && ! (event.nativeEvent.touches.length > 0)) {
      return null;
    }
    let bounds = ReactDOM.findDOMNode(this.svg).getBoundingClientRect();
    return {
      x: ('pageX' in event ? event.pageX : event.nativeEvent.touches[touchIndex].pageX) / bounds.width, 
      y: ('pageY' in event ? event.pageY : event.nativeEvent.touches[touchIndex].pageY) / bounds.height
    }
  }
  
  nearestFiducial(point) {
    let keys = Object.keys(this.state.states)
    if (this.state.restrictedFiducialId !== null) {
      keys = keys.filter(k => k == this.state.restrictedFiducialId);
    }
    return keys.reduce((p, k) => {
      if (distance(this.fiducialPathEnd(k) || this.fiducialCenter(k), point) < distance(this.fiducialPathEnd(p) || this.fiducialCenter(p), point)) {
        return k;
      } else {
        return p;
      }
    }, null);
  }
  
  isSvgEvent(event) {
    return event.target === this.svg;
  }
  
  startEvent(point, isOrienting) {
    if (isOrienting) {
      let candidate = this.nearestFiducial(point);
      let pathEnd = this.fiducialPathEnd(candidate) || this.fiducialCenter(candidate);
      console.log("shift-mouse down with candidate", candidate);
      this.setState(state => ({
        candidate: candidate,
        finalOrientation: point
      }), () => this.processOrientation());
    } else {
      let candidate = this.nearestFiducial(point);
      let center = this.fiducialCenter(candidate);
      console.log("mouse down with candidate", candidate);
      this.setState(state => ({
        candidate: candidate,
        pathInProgress: (candidate && state.states[candidate].path) ? [point] : (center ? [center, point] : [point]),
        nextPoint: point,
        finalOrientation: null
      }), () => this.processDrag());          
    }
  }
  
  mouseDown(event, touchId) {
    // if (! this.isSvgEvent(event)) { return; }
    if (event.shiftKey) {
      this.orienting = true;
    } else {
      this.dragging = true;
    }
    let point = this.mousePosition(event);
    this.startEvent(point, this.orienting);
  }
  
  touchStart(event) {
    if (event.touches.length > 1 && ! this.orienting) {
      this.orienting = event.touches.filter(id => id != this.dragging)[0].identifier;
      let point = this.mousePosition(event, this.orienting);
      this.startEvent(point, true);
    } else {
      this.dragging = event.touches[0].identifier;
      let point = this.mousePosition(event, this.dragging);
      this.startEvent(point, false);
    }
    event.preventDefault();
    return false;
  }
  
  // these events trigger when over the path object too, annoying!
  moveEvent(point, isOrienting) {
    // if (! this.isSvgEvent(event)) { return; }
    if (! point) {
      return;
    }
    if (! isOrienting) {
      this.setState(state => ({
        pathInProgress: state.pathInProgress ? state.pathInProgress.concat([point]) : [point],
        nextPoint: point
      }), () => this.processDrag());
    } else {
      this.setState(state => ({
        finalOrientation: point
      }), () => this.processOrientation());
    }
  }
  
  mouseMove(event) {
    if (this.orienting || this.dragging) {
      let point = this.mousePosition(event)
      this.moveEvent(point, this.orienting);
    }
  }
  
  touchMove(event) {
    let dragPoint = this.mousePosition(event, this.dragging);
    this.moveEvent(dragPoint, false);
    let orientPoint = this.mousePosition(event, this.orienting);
    this.moveEvent(orientPoint, true);
    event.preventDefault();
    return false;
  }

  upEvent(point, isOrienting) {
    // if (! this.isSvgEvent(event)) { return; }
    if (! isOrienting) { 
      this.dragging = false;
      if (! point) {
        this.processDrag(true);
        return;
      }
      this.setState(state => ({
        pathInProgress: (state.pathInProgress && point) ? state.pathInProgress.concat([point]) : (point ? [point] : state.pathInProgress),
        nextPoint: point
      }), () => this.processDrag(true));
    } else {
      this.orienting = false;
      if (! point) {
        this.processOrientation(true);
        return;
      }
      this.setState(state => ({
        finalOrientation: point
      }), () => this.processOrientation(true));
    }
  }

  mouseUp(event) {
    if (this.orienting || this.dragging) {
      this.upEvent(this.mousePosition(event), this.orienting);
    }
  }
  
  mouseLeave(event) {
    this.mouseUp(event);
  }
        
  touchEnd(event) {
    if (this.dragging && event.nativeEvent.touches.findIndex(touch => touch.identifier == this.dragging) < 0) {
      this.upEvent(this.mousePosition(event, this.dragging), false);
    }
    if (this.orienting && event.nativeEvent.touches.findIndex(touch => touch.identifier == this.orienting) < 0) {
      this.upEvent(this.mousePosition(event, this.orienting), true);
    }
    event.preventDefault();
    return false;
  }
  
  touchCancel(event) {
    return this.touchEnd(event);
  }
  
  keyDown(event) {
    // console.log("DOWN", event.key);
    this.handleKeyDown(event.key);
  }
  
  keyUp(event) {
    // console.log("UP", event.key);
    this.handleKeyUp(event.key);
  }
  
  setForced(forward, turn) {
    this.setState({
      forcedForward: forward,
      forcedTurn: turn
    }, () => this.sendForce());
  }
  
  selectChairbot(id) {
    this.setState(state => ({
      restrictedFiducialId: state.restrictedFiducialId == id ? null : Number(id)
    }));
  }
  
  handleKeyDown(key) {
    if (key >= '0' && key <= '9') {
      this.selectChairbot(key);
    } else if (key == '-') {
      this.setState({
        restrictedFiducialId: null
      });
    } else {
      let send = false;
      let sendSpeed = false;
      this.setState(state => {
      switch(key) {
        case 'w':
          console.log('down w');
          send = true;
          return {
            forcedForward: 1 // (state.forcedForward || 0) + 1
          };
                
        case 'a':
          console.log('down a');
          send = true;
          return {
            forcedTurn: -1 // state.forcedTurn - 1
          };
      
        case 's':
          console.log('down s');
          send = true;
          return {
            forcedForward: -1 // (state.forcedForward > 0 ? 0 : (state.forcedForward || 0) - 1)
          };
        
        case 'd':
          console.log('down d');
          send = true;
          return {
            forcedTurn: 1 //state.forcedTurn + 1
          };
        
        case ' ':
          console.log('down <space>');
          send = true;
          return {
            forcedForward: 0,
            forcedTurn: 0
          };
          
        case 'p':
          console.log('down p');
          sendSpeed = true;
          return {
            isPaused: true
          };
        
        case 'p':
          console.log('down p');
          sendSpeed = true;
          return {
            isPaused: false
          };
        
        // speed
        case '[':
          console.log('down [');
          sendSpeed = true;
          return {
            topSpeed: this.state.topSpeed / 1.25,
            slowKeyPressed: true
          }
          
        case ']':
          console.log('down ]');
          sendSpeed = true;
          let newSpeed = this.state.topSpeed * 1.25;
          return {
            topSpeed: newSpeed > 300 ? this.state.topSpeed : newSpeed,
            speedKeyPressed: true
          }
          
        // accel
        case '{':
          console.log('down {');
          sendSpeed = true;
          return {
            accel: this.state.accel / 1.25,
            decelKeyPressed: true
          }
          
        case '}':
          console.log('down }');
          sendSpeed = true;
          let newAccel = this.state.accel * 1.25;
          return {
            accel: newAccel > 300 ? this.state.accel : newAccel,
            accelKeyPressed: true
          }
        }
      }, () => {
        if (send) {
          this.sendForce();
        } else if (sendSpeed) {
          this.sendSpeed();
        }
      });
    }
    return false;
  }
  
  handleKeyUp(key) {
    let send = false;
    this.setState(state => {
      switch(key) {
      case 'w':
        console.log('up w');
        send = true;
        return {
          forcedForward: 0
        }
      case 'a':
        console.log('up a');
        send = true;
        return {
          forcedTurn: 0
        }
      case 's':
        console.log('up s');
        send = true;
        return {
          forcedForward: 0
        }
      case 'd':
        console.log('up d');
        send = true;
        return {
          forcedTurn: 0
        }
        
      // speed
      case '[':
        console.log('up [');
        return {
          slowKeyPressed: false
        }
      case ']':
        console.log('up ]');
        return {
          speedKeyPressed: false
        }              

      // accel
      case '{':
        console.log('up {');
        return {
          decelKeyPressed: false
        }
      case '}':
        console.log('up }');
        return {
          accelKeyPressed: false
        }                          
      }
    }, () => send && this.sendForce());
    return false;
  }
  
  checkAndSendForce() {
    if (this.state.forcedTurn || this.state.forcedForward) {
      this.sendForce();
    }
  }
  
  sendForce() {
    sendForce(
      this.state.restrictedFiducialId, 
      this.state.forcedForward, 
      this.state.forcedTurn, 
      this.state.topSpeed,
      this.state.accel);
  }

  sendSpeed() {
    sendSpeed(this.state.restrictedFiducialId, this.state.topSpeed, this.state.accel);
  }

  processDrag(final) {        
    appendToPath(this.state.restrictedFiducialId || this.state.candidate, [this.state.nextPoint], this.state.topSpeed, this.state.accel);
    if (final) {
      this.setState({
        candidate: null,
        pathInProgress: null,
        nextPoint: null
      });
    } else {
      this.setState({
        nextPoint: null
      });
    }
  }

  processOrientation(final) {        
    sendOrientation(this.state.restrictedFiducialId || this.state.candidate, this.state.finalOrientation, this.state.topSpeed, this.state.accel);
    if (final) {
      this.setState({
        candidate: null,
        finalOrientation: null
      });
    }
  }
        
  render() {
    let pathInProgress = this.state.pathInProgress;
    if (pathInProgress && this.state.candidate) {
      let existingPath = this.state.states[this.state.candidate].path;
      if (existingPath && existingPath.length > 0) {
        pathInProgress = [existingPath[existingPath.length-1]].concat(pathInProgress);
        console.log("using existing path!", pathInProgress);
      } else {
        pathInProgress = [this.fiducialCenter(this.state.requiredFiducialId || this.state.candidate)].concat(pathInProgress);
      }
    }
    
    return <div tabIndex="0"
        onKeyDown={this.keyDown.bind(this)}
        onKeyUp={this.keyUp.bind(this)} >
      <div className={"buttons" + (this.state.restrictedFiducialId ? " double" : "")}>
        <p className="info">
          Drag on the screen, starting from a chairbot, to request a path. <br /><br /><strong>{this.state.restrictedFiducialId ? `You control chairbot #${this.state.restrictedFiducialId}.` : "You can control any chairbot."}</strong><br /><br />
          Speed: <strong>{Math.round(this.state.topSpeed*10)/10}</strong><br />
          <KeyButton pressed={this.state.slowKeyPressed} handler={this} keyChar="[" />
          <KeyButton pressed={this.state.speedKeyPressed} handler={this} keyChar="]" />
          <br />
          Acceleration: <strong>{Math.round(this.state.accel*10)/10}</strong>
          <br />
          <KeyButton pressed={this.state.decelKeyPressed} handler={this} keyChar="{" />
          <KeyButton pressed={this.state.accelKeyPressed} handler={this} keyChar="}" />
        </p>
        {this.state.restrictedFiducialId ? <div className="keyGroup">
          <p><strong>Alternative Controls</strong><br />
            Digital 
            <SliderToggle 
              toggle={() => this.setState(state => {return {analogControls: ! state.analogControls}; })}
              toggled={this.state.analogControls} /> 
            Analog<br />
          </p>
            {this.state.analogControls ? 
              <ForceDragTarget forcedForward={this.state.forcedForward} forcedTurn={this.state.forcedTurn} update={this.setForced.bind(this)}/> :
              [ <KeyButton pressed={this.state.forcedForward > 0} handler={this} keyChar="w" />,
                <br />,
                <KeyButton pressed={this.state.forcedTurn < 0} handler={this} keyChar="a" />,
                <KeyButton pressed={this.state.forcedForward < 0} handler={this} keyChar="s" />,
                <KeyButton pressed={this.state.forcedTurn > 0} handler={this} keyChar="d" />,
                <br />
              ]
            }
            {this.state.isPaused ? <KeyButton pressed={false} handler={this} keyChar="r" text="Resume" /> : <KeyButton pressed={false} handler={this} keyChar="p" text="Pause" />} <KeyButton pressed={false} handler={this} keyChar=" " text="Stop" />

        </div> : ''}
      </div>
      <svg 
        id="drag-view" 
        viewBox="0 0 1000 1000" 
        preserveAspectRatio="none"
        ref={(ref) => this.svg = ref}
        onMouseDown={this.mouseDown.bind(this)}
        onTouchStart={this.touchStart.bind(this)}
        onMouseMove={this.mouseMove.bind(this)}
        onTouchMove={this.touchMove.bind(this)}
        onMouseUp={this.mouseUp.bind(this)}
        onMouseLeave={this.mouseLeave.bind(this)} 
        onTouchEnd={this.touchEnd.bind(this)}
        onTouchCancel={this.touchEnd.bind(this)} >
          {Object.keys(this.state.states).map(key =>
            <ChairBot 
              status={this.state.states[key]} 
              highlight={key == this.state.candidate} key={`chair-${key}`} 
              isDraggable={this.state.restrictedFiducialId === null || key == this.state.restrictedFiducialId /* == intentional to allow type conversion */}
              selectChairbot={() => this.selectChairbot(key)} />
          )}
          {pathInProgress ? <g stroke="#0a0"><PathView path={pathInProgress} finalTick={this.state.finalOrientation} /></g> : ''}
      </svg>
    </div>
  }
  
  componentDidMount() {
    // console.log("Drag View App mounted!");
    theViewer = this;
  }
  
  handleUpdate(status) {
    // console.log("update!", status);        
    this.setState(state => {
      let newStates = {};
      newStates[status.id] = Object.assign({}, state.states[status.id] || {}, status);

      // clear path in progress if we've gotten update on path!
      let clearPathInProgress = status.id == this.state.candidate || status.id == this.state.restrictedFiducialId;
      
      return {
        states: Object.assign({}, state.states, newStates),
        pathInProgress: clearPathInProgress ? null : state.pathInProgress
      };
    });
  }
}
