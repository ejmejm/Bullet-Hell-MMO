var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function(req, res){
	res.sendFile(__dirname + '/client/index.html');
});
app.use('/client', express.static(__dirname + '/client'));

var port = process.env.PORT || 3000;

serv.listen(port);
console.log('Server Started');

var SOCKET_LIST = {};

var Entity = function(id){
	var self = {
		x: 0,
		y: 0,
		speed: {x: 0, y: 0},
		id: ''
	}
	self.update = function(){
		self.updatePosition();
	}
	self.updatePosition = function(){
		self.x += self.speed.x;
		self.y += self.speed.y;
	}
	return self;
}

var Player = function(id){
	var self = Entity();
	self.id = id;
	self.up = false;
	self.down = false;
	self.left = false;
	self.right = false;
	self.maxSpeed = 5;

	var superUpdate = self.update;
	self.update = function(){
		self.updateSpeed();
		superUpdate();
	}

	self.updateSpeed = function(){
		if(self.up && self.down)
			self.speed.y = 0;
		else if(self.up)
			self.speed.y = -self.maxSpeed;
		else if(self.down)
			self.speed.y = self.maxSpeed;
		else
			self.speed.y = 0;
		if(self.left && self.right)
			self.speed.x = 0;
		else if(self.left)
			self.speed.x = -self.maxSpeed;
		else if(self.right)
			self.speed.x = self.maxSpeed;
		else
			self.speed.x = 0;
	}

	Player.list[id] = self;

	return self;
}

Player.list = {};

Player.onConnect = function(socket){
	var player = Player(socket.id);

	socket.on('keyPress', function(data){
		if(data.inputId === 'up')
			player.up = data.state;
		else if(data.inputId === 'down')
			player.down = data.state;
		else if(data.inputId === 'left')
			player.left = data.state;
		else if(data.inputId === 'right')
			player.right = data.state;
	});
}

Player.onDisconnect = function(socket){
		socket.on('disconnect', function(){
			delete SOCKET_LIST[socket.id];
			delete Player.list[socket.id];
		});
}

Player.update = function(){
	var pack = [];
	for(var i in Player.list){
		var player = Player.list[i];
		player.update();
		pack.push({
			x: player.x,
			y: player.y
		});
	}
	return pack;
}
var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket){
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;

	Player.onConnect(socket);
	Player.onDisconnect(socket);
});

setInterval(function(){
	var pack = Player.update();

	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('positionUpdate', pack);
	}
}, 1000/40);
