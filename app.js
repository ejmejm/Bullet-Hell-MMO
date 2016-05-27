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

//Entity stuff

var Entity = function(id){
	var self = {
		x: 0,
		y: 0,
		maxSpeed: 1,
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

//Bullet stuff

var Bullet = function(targetPosition, position){
	var self = Entity();
	self.maxSpeed = 10;
	self.id = Math.random();
	self.x = position.x;
	self.y = position.y;

	var direction = {};
	direction.x = targetPosition.x - position.x;
	direction.y = targetPosition.y - position.y;
	var mag = Math.sqrt(Math.pow(direction.x, 2) + Math.pow(direction.y, 2));
	direction.x /= mag;
	direction.y /= mag;

	self.speed.x = direction.x * self.maxSpeed;
	self.speed.y = direction.y * self.maxSpeed;

	self.timer = 0;
	self.remove = false;
	var superUpdate = self.update;
	self.update = function(){
		if(self.timer++ > 100)
			self.remove = true;
		superUpdate();
	}
	Bullet.list[self.id] = self;
	return self;
}

Bullet.list = {};

Bullet.update = function(){
	var pack = [];
	for(var i in Bullet.list){
		var bullet = Bullet.list[i];
		bullet.update();
		if(bullet.remove){
			delete Bullet.list[i]
		}
		else{
			pack.push({
				x: bullet.x,
				y: bullet.y
			});
		}
	}
	return pack;
}

//Player stuff

var Player = function(id){
	var self = Entity();
	self.maxSpeed = 5;
	self.id = id;
	self.up = false;
	self.down = false;
	self.left = false;
	self.right = false;
	self.shoot = false;
	self.mousePos = {x: 0, y: 0};

	var superUpdate = self.update;
	self.update = function(){
		self.updateSpeed();

		if(self.shoot)
			Bullet({x: self.mousePos.x, y: self.mousePos.y}, {x: self.x+15, y: self.y+15});

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

	socket.on('mousePress', function(data){
		if(data.inputId === 'click'){
			player.shoot = data.state;
		}
		else if(data.inputId === 'move'){
			player.mousePos.x = data.x;
			player.mousePos.y = data.y;
		}
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
	var pack = {
		player: Player.update(),
		bullet: Bullet.update()
	}

	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('positionUpdate', pack);
	}
}, 1000/40);
