$(document).ready(function(){
/*
I was not able to use the Imgur API to get a list of all the pictures in a subreddit, so I needed a way to scrape the hrefs from a subreddit gallery. YQL turned out to be a good way to get around cross-domain restrictions: 
http://developer.yahoo.com/yql/console/
*/

	var yql_query = "http://query.yahooapis.com/v1/public/yql?q=SELECT%20href%20from%20html%20WHERE%20url%3D%22http%3A%2F%2Fimgur.com%2Fr%2Faww%2Ftop%22%20and%20xpath%3D'%2F%2Fdiv%5B%40class%3D%22post%22%5D%2Fa'&format=json&callback=cbfunc";
	// raww: pics on one page, rawwr: one random pic	
	var raww = [];
	var rawwr = '';
	// board stores the tile sequence, _xy is for coordinates
	var board = [];
	var board_xy = [];
	// will add option later for harder difficulty (more tiles)
	var tile_count = 3;
	var canvas, image, tile_width, tile_height;

	// initializing board tile positions
	for(var i = 0; i < tile_count*tile_count; i++){
		board[i] = i;		
	}
	for(var i = 0; i < tile_count*tile_count; i += tile_count){			
		for(var j = 0; j < tile_count; j++){
			var obj = { x: j, y: i/tile_count };
			board_xy.push(obj);
			
			// alert(i+j + ' : ' + board_xy[i+j].x + ', ' + board_xy[i+j].y);
		}		
	}
	
	//blank_tile will hold x and y coordinates
	var blank_tile = {};	

	$.ajax({
		url: yql_query,
		dataType: 'jsonp',
		jsonpCallback: 'cbfunc',
		error: function(){ alert('Failed!'); },
		success: function(obj){
			// This gives me an array of hrefs and picks a random one
			for (var x in obj.query['results']['a']){
				raww[x] = obj.query['results']['a'][x]['href'];		
			}			
			rawwr = raww[Math.floor(Math.random()*raww.length)];			
		},
		complete: function(){
			// The 2nd ajax call uses the Imgur API to get image attributes
			$.ajax({
				url: 'https://api.imgur.com/3/gallery' + rawwr,
				type: 'GET',
				dataType: 'json',				
				success: function(obj){						
					$('#image h1').text(obj.data['title']);				
					$('#image a').attr('href', obj.data['link']);					 
					// hrefs are in the following format: /r/aww/fhWYwqW
					var lg_img = obj.data['link'].slice(0,-4) + 'l' + obj.data['link'].slice(-4);
					$('#image img').attr('src', lg_img);
				},
				// This takes care of setting up the puzzle
				complete: function(){					
					$('#image img').load(function(){
						image = document.getElementById('test');
						$('canvas').attr('width', image.width).attr('height', image.height);
						canvas = document.getElementById('n-puzzle').getContext('2d');
						// canvas.drawImage(image, 0, 0, image.width, image.height);						
						draw_puzzle(image, canvas);
						
						
					});					
				},
				error: function(){ alert('Failed!'); },
				beforeSend: function(request){			
					request.setRequestHeader('Authorization', 'Client-ID 2ad68776c1b2b30');
				}
			});
		}
	});
	var board_state = [];
	
	$('canvas').click(function(e){
		e.preventDefault();		
		
		var mouse = {			
			tile_num: Math.floor((e.pageX - $(this).offset().left) / tile_width) + tile_count * Math.floor((e.pageY - $(this).offset().top) / tile_height),
			tile_x: Math.floor((e.pageX - $(this).offset().left) / tile_width) * tile_width,
			tile_y: Math.floor((e.pageY - $(this).offset().top) / tile_height) * tile_height,
			x: Math.floor((e.pageX - $(this).offset().left) / tile_width),
			y: Math.floor((e.pageY - $(this).offset().top) / tile_height)			
		};
		
		move_tile(mouse);			
	});
	
	function move_tile(mouse){		
		if(((mouse.x == blank_tile.x + 1 || mouse.x == blank_tile.x -1) && mouse.y == blank_tile.y) || ((mouse.y == blank_tile.y + 1 || mouse.y == blank_tile.y -1) && mouse.x == blank_tile.x)){
			
			board_state[blank_tile.tile_num].tile_x = board_state[mouse.tile_num].tile_x;
			board_state[blank_tile.tile_num].tile_y = board_state[mouse.tile_num].tile_y;
			board_state[blank_tile.tile_num].tile_num = board_state[mouse.tile_num].tile_num;
			
			blank_tile = mouse;			
			
			canvas.clearRect(0,0, image.width, image.height);
			for(var i = 0; i < board.length; i++){
				//alert('test');
				if(i !== mouse.tile_num){
					canvas.drawImage(image, board_state[i].tile_x, board_state[i].tile_y, tile_width, tile_height, board_state[i].x, board_state[i].y, tile_width, tile_height);
				}				
			}			
		}		
	}
	
	function draw_puzzle(image, canvas){
		tile_width = image.width / tile_count;
		tile_height = image.height / tile_count;
		
		shuffle(board);
				
		while(!solvable(board)){
			shuffle(board);
		}		
		
		for(var i = 0; i < board.length-1; i++){
			canvas.drawImage(image, board_xy[board[i]].x * tile_width, board_xy[board[i]].y * tile_height, tile_width, tile_height, board_xy[i].x * tile_width, board_xy[i].y * tile_height, tile_width, tile_height);			
			
			board_state[i] = {
				tile_num: board[i],
				tile_x: board_xy[board[i]].x * tile_width,
				tile_y: board_xy[board[i]].y * tile_height,
				x: board_xy[i].x * tile_width,
				y: board_xy[i].y * tile_height
			};
			
		}
		
		board_state[board.length-1] = {
			tile_num: board.length-1,
			tile_x: board_xy[board.length-1].x * tile_width,
			tile_y: board_xy[board.length-1].y * tile_height,
			x: board_xy[board.length-1].x * tile_width,
			y: board_xy[board.length-1].y * tile_height
		};		
		
		blank_tile = {
			// bottom right tile is the default blank tile
			tile_num: tile_count*tile_count-1,
			tile_x: (tile_count-1)*tile_width,
			tile_y: (tile_count-1)*tile_height,
			x: board_xy[tile_count*tile_count-1].x,
			y: board_xy[tile_count*tile_count-1].y			
		};
	}
	
/* SO helped me discover this method for random sorting an array in js, which is much better than my previous usage of passing a function to sort with 0.5-rand to take advantage of the -1/0/1 accepted returns
Credit: http://stackoverflow.com/questions/962802/is-it-correct-to-use-javascript-array-sort-method-for-shuffling
 */

	function shuffle(array) {
	// modified this so the last item (blank tile) stays in position by subtracting 1 from array.length
		var tmp, current, top = array.length-1;
		if(top) while(--top) {
			current = Math.floor(Math.random() * (top + 1));
			tmp = array[current];
			array[current] = array[top];
			array[top] = tmp;
		}		
		return array;
	}
	
/* This article was extremely useful for understanding how to determine if an n-puzzle is solvable:
http://www.cs.bham.ac.uk/~mdr/teaching/modules04/java2/TilesSolvability.html
My function is probably not that efficient, but this is for small grids so it should suffice
*/
	function solvable(array){
		var tmp = 0;
		// var test_output = '';
		for(var i=0; i < array.length; i++){
			// test_output += array[i];
			for(var j=i+1; j < array.length; j++){
				if(array[i] > array[j]){ tmp++; }
			}
		}
		// if grid width is odd, tmp has to be even to be solvable
		if(tmp%2 == 0){
			return true;
		}
	}
	
});