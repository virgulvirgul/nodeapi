module.exports = {
	index : (socket) => {
		socket.on('players', function(data){
			if (data) {
				io.sockets.emit("game-players",data);
				socket.join(data.gameId);
			}

		});
		socket.on('players-result', function(data){
			if (data) {
				io.sockets.in(data.gameId).emit("game-players-result",data);
			}

		});
		socket.on("players-engage", (data)=>{
			if (data) {
				io.sockets.emit("players-engage-result",data);
			}			
		});
	}
}