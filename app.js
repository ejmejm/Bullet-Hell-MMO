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

	self.getInitPack = function(){
		return {
			id: self.id,
			x: self.x,
			y: self.y
		};
	}

	self.getUpdatePack = function(){
		return {
			id: self.id,
			x: self.x,
			y: self.y
		};
	}

	Bullet.list[self.id] = self;
	initPack.bullet.push(self.getInitPack());

	return self;
}

Bullet.list = {};

Bullet.update = function(){
	var pack = [];
	for(var i in Bullet.list){
		var bullet = Bullet.list[i];
		bullet.update();
		if(bullet.remove){
			removePack.bullet.push(bullet.id);
			delete Bullet.list[i];
		}
		else{
			pack.push(bullet.getUpdatePack());
		}
	}
	return pack;
}

Bullet.getAllInitPacks = function(){
	var bullets = [];
	for(var i in Bullet.list)
		bullets.push(Bullet.list[i].getInitPack());
	return bullets;
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
			new Bullet({x: self.mousePos.x, y: self.mousePos.y}, {x: self.x+15, y: self.y+15});
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

	self.getInitPack = function(){
		return {
			id: self.id,
			x: self.x,
			y: self.y
		};
	}

	self.getUpdatePack = function(){
		return {
			id: self.id,
			x: self.x,
			y: self.y
		};
	}

	Player.list[id] = self;

	initPack.player.push(self.getInitPack());

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

	socket.emit('init', {
		player: Player.getAllInitPacks(),
		bullet: Bullet.getAllInitPacks()
	});
}

Player.onDisconnect = function(socket){
		socket.on('disconnect', function(){
			removePack.player.push(socket.id);
			delete SOCKET_LIST[socket.id];
			delete Player.list[socket.id];
		});
}

Player.update = function(){
	var pack = [];
	for(var i in Player.list){
		var player = Player.list[i];
		player.update();
		pack.push(player.getUpdatePack());
	}
	return pack;
}

Player.getAllInitPacks = function(){
	var players = [];
	for(var i in Player.list)
		players.push(Player.list[i].getInitPack());
	return players;
}

var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket){
	socket.id = Math.random();
	SOCKET_LIST[socket.id] = socket;

	Player.onConnect(socket);
	Player.onDisconnect(socket);
});

var initPack = {player: [], bullet: []};
var removePack = {player: [], bullet: []};

setInterval(function(){
	var pack = {
		player: Player.update(),
		bullet: Bullet.update()
	}

	for(var i in SOCKET_LIST){
		var socket = SOCKET_LIST[i];
		socket.emit('init', initPack);
		socket.emit('update', pack);
		socket.emit('remove', removePack);
	}
	initPack.player = [];
	initPack.bullet = [];
	removePack.player = [];
	removePack.bullet = [];
}, 1000/40);
