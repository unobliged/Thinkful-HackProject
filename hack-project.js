$(document).ready(function(){

/* Thanks to Bruce Alderman for writing this great guide on use html5 
canvas for a sliding puzzle: 
http://www.sitepoint.com/image-manipulation-with-html5-canvas-a-sliding-puzzle-2/

I improve on it by allowing for non-square images (i.e., rectangles) and also use random shuffling (Bruce has a fixed initialization for the shuffling); this also requires that I check for solvability since roughly half of random shuffles result in unsolvable puzzles. Finally, I pull cute pictures to use for the puzzle from r/aww via the Imgur API. Other than that, I went for a somewhat different implementation of the puzzle board that made it easier (at least for me) to debug. 
*/

// Variable Declarations and Initialization

	/* I was not able to use the Imgur API to get a list of all the pictures 
	in a subreddit, so I needed a way to scrape the hrefs from a subreddit 
	gallery. YQL turned out to be a good way to get around cross-domain 
	restrictions: http://developer.yahoo.com/yql/console/ 
	*/
	var yql_query = "http://query.yahooapis.com/v1/public/yql?q=SELECT%20href%20from%20html%20WHERE%20url%3D%22http%3A%2F%2Fimgur.com%2Fr%2Faww%2Ftop%22%20and%20xpath%3D'%2F%2Fdiv%5B%40class%3D%22post%22%5D%2Fa'&format=json&callback=cbfunc";
	
	// raww: pics on one page, rawwr: one random pic	
	var raww = [];
	var rawwr = '';		
	
	/* fixed tile_count to keep difficulty low; 
	it can take up to 80 moves to optimally solve 
	a 4x4 grid but less than 30 for a 3x3 
	*/
	var tile_count = 3;
	
	/* board stores the original/shuffled tile sequence, _xy is for original 
	coordinates, board_state maintains 	both original and changed info 
	(this made for easier debugging while learning n-puzzle mechanics) 
	*/
	var board = []; // e.g., 1, 2, 3
	var board_xy = []; // e.g., (0,0), (0,1), (0,2)
	var board_state = [];
	
	// blank is board_state just for the blank tile
	var blank = {};	
	
	/* IMPORTANT: html5 canvas does NOT accept jquery objects. You will 
	need to get use regular js to get the elements and assign to variables 
	*/
	var canvas, image, tile_width, tile_height;
	
	// this is my lazy way of checking if solved
	var correct = '012345678';
	var answer = '';

	// initializing board tile positions/coordinates
	for(var i = 0; i < tile_count*tile_count; i++){
		board[i] = i;		
	}
	for(var i = 0; i < tile_count*tile_count; i += tile_count){			
		for(var j = 0; j < tile_count; j++){
			var obj = { 
				x: j, 
				y: i/tile_count 
			};
			board_xy.push(obj);
		}		
	}

	/* Picture of original board:
	0 1 2
	3 4 5
	6 7 8
	Tile 0 has the coordinates (0,0); Tile 8 is (2,2)
	*/
	
// AJAX section; also initiates sliding puzzle since picture must be loaded before generating it
	
	/* First ajax call uses YQL to scrape hrefs since Imgur 
	API can't query full gallery pages, only single images 
	*/
	$.ajax({
		url: yql_query,
		dataType: 'jsonp',
		jsonpCallback: 'cbfunc',
		error: function(){ alert('Failed!'); },
		success: function(obj){
			/* I sometimes get 'Cannot read property 'a' of null' error
			I tried the following but it did not solve it, 
			will attempt to fix later
			if(obj == null){ location.reload(); }
			*/
			for (var x in obj.query['results']['a']){
				raww[x] = obj.query['results']['a'][x]['href'];		
			}			
			rawwr = raww[Math.floor(Math.random()*raww.length)];
			var imgur_link = 'http://imgur.com' + rawwr;
			$('#container>h1>a').attr('href', imgur_link);
		},
		complete: function(){
			// The 2nd ajax call uses the Imgur API to get image attributes
			$.ajax({
				url: 'https://api.imgur.com/3/gallery' + rawwr,
				type: 'GET',
				dataType: 'json',				
				success: function(obj){				
					$('#container>h1>a').text(obj.data['title']);				 
					$('#image a').attr('href', obj.data['link']);		 
					
					// Attaching s/m/l at the end of the href alters the size
					var lg_img = obj.data['link'].slice(0,-4) + 'l' + obj.data['link'].slice(-4);
					$('#image img').attr('src', lg_img);
				},				
				complete: function(){
					// This takes care of setting up the puzzle after image load
					$('#image img').load(function(){
						image = document.getElementById('imgur');
						$('canvas').attr('width', image.width).attr('height', image.height);
						canvas = document.getElementById('n-puzzle').getContext('2d');									
						draw_puzzle(image, canvas);						
					});					
				},
				
				/* I did not opt for a default image on error since sometimes 
				even after error triggers, the api responds back; I'd rather 
				the user reload and not be confused as to what happened if it 
				responds after the error message */
				
				error: function(){ alert('Cannot get image, please reload!'); },
				beforeSend: function(request){
					// Imgur api requires a custom header, can't just use headers setting of jquery .ajax
					request.setRequestHeader('Authorization', 'Client-ID 2ad68776c1b2b30');
				}
			});
		}
	});
	
// Shows the original picture and/or hints to help solve		
	$('form#show-pic').submit(function(e){
		e.preventDefault();
		$('#image>a').toggleClass('hidden');
	});
	
	$('form#hints').submit(function(e){
		e.preventDefault();		
		$('#image>pre').toggleClass('hidden');
	});

// Clicking and sliding tiles; also checks if puzzle is solved
	$('canvas').click(function(e){
		e.preventDefault();		
		
		var mouse = {
			// mouse tile_num is the sequential tile position
			tile_num: Math.floor((e.pageX - $(this).offset().left) / tile_width) + tile_count * Math.floor((e.pageY - $(this).offset().top) / tile_height),
			tile_x: Math.floor((e.pageX - $(this).offset().left) / tile_width) * tile_width,
			tile_y: Math.floor((e.pageY - $(this).offset().top) / tile_height) * tile_height,
			x: Math.floor((e.pageX - $(this).offset().left) / tile_width),
			y: Math.floor((e.pageY - $(this).offset().top) / tile_height)		
		};
		
		slide_tile(mouse);
		solved();		
	});
	
	function slide_tile(mouse){
		// clicked tile must be adjacent to blank tile to move
		if(((mouse.x == blank.x + 1 || mouse.x == blank.x -1) && mouse.y == blank.y) || ((mouse.y == blank.y + 1 || mouse.y == blank.y -1) && mouse.x == blank.x)){
			
			// swaps mouse tile with blank tile
			board_state[blank.tile_num].tile_x = board_state[mouse.tile_num].tile_x;
			board_state[blank.tile_num].tile_y = board_state[mouse.tile_num].tile_y;
			board_state[blank.tile_num].tile_num = board_state[mouse.tile_num].tile_num;
			/* no need to pass tile_x/y to board_state[mouse.tile_num]; 
			it never gets drawn. Mouse tile becomes the new blank and 
			must get the original blank tile number (last tile) */
			board_state[mouse.tile_num].tile_num = tile_count*tile_count-1;
			blank = mouse;			
			
			/* to get the blank on the canvas, I simply don't redraw there
			after clearing the canvas since the default canvas is white */
			canvas.clearRect(0,0, image.width, image.height);
			for(var i = 0; i < board.length; i++){
				// skips the clicked tile, which is now the new blank tile
				if(i !== mouse.tile_num){
					canvas.drawImage(image, board_state[i].tile_x, board_state[i].tile_y, tile_width, tile_height, board_state[i].x, board_state[i].y, tile_width, tile_height);
				}				
			}			
		}	
	}
	
	function solved(){
		for(var x in board_state){ answer += board_state[x].tile_num; }			
		if(answer == correct){
			canvas.drawImage(image, 0, 0, image.width, image.height);
			alert('You won! Reload to play again.');			
			$('canvas').unbind('click');
			$('#container>h1').toggleClass('hidden');
			$('#container h3').hide();
			$('#image a').hide();
			$('#forms').hide();
		} else { answer = ''; }
	}

// Draws the puzzle (meant to be run ONCE). I wanted to couple the redraw and mouse click rather than have a reusable multi-purpose puzzle draw function	
	function draw_puzzle(image, canvas){
		tile_width = image.width / tile_count;
		tile_height = image.height / tile_count;		
		
		shuffle(board);  
		
		// roughly half of all n-puzzle shuffles are unsolvable
		while(!solvable(board)){
			shuffle(board);
		}		
		
		/* rather than loop twice (set board state and use that to draw puzzle),
		I draw and set board state in one pass. In drawImage, I am mapping the 
		shuffled image slice positions (board_xy[board[i]]) to the sequential 
		puzzle tile positions (board_xy[i]) */
		for(var i = 0; i < board.length-1; i++){			
			canvas.drawImage(image, board_xy[board[i]].x * tile_width, board_xy[board[i]].y * tile_height, tile_width, tile_height, board_xy[i].x * tile_width, board_xy[i].y * tile_height, tile_width, tile_height);			
			
			// board_state[0] = upper left corner tile
			board_state[i] = {
				tile_num: board[i], // board_state[0]'s shuffled tile
				
				// pixel positions for the shuffled tiles
				tile_x: board_xy[board[i]].x * tile_width, 
				tile_y: board_xy[board[i]].y * tile_height,
				// pixel positions for tiles in sequential order (1,2,3, etc.)
				x: board_xy[i].x * tile_width,
				y: board_xy[i].y * tile_height
			};			
		}
		
		// since I skip the blank tile position, this needs to be set after
		board_state[board.length-1] = {
			tile_num: board.length-1,
			tile_x: board_xy[board.length-1].x * tile_width,
			tile_y: board_xy[board.length-1].y * tile_height,
			x: board_xy[board.length-1].x * tile_width,
			y: board_xy[board.length-1].y * tile_height
		};		
		
		// blank object is separate to compare with mouse object
		blank = {
			// bottom right tile is the default blank tile
			tile_num: tile_count*tile_count-1,
			tile_x: (tile_count-1)*tile_width,
			tile_y: (tile_count-1)*tile_height,
			x: board_xy[tile_count*tile_count-1].x,
			y: board_xy[tile_count*tile_count-1].y			
		};
	}

// Found this Fisher-Yates array shuffle on Stack Overflow: http://stackoverflow.com/questions/962802/is-it-correct-to-use-javascript-array-sort-method-for-shuffling
	
	function shuffle(array) {
		/* modified shuffle by subtracting 1 from array.length 
		so the last item (blank tile) stays in position */
		var tmp, current, top = array.length-1;
		if(top) while(--top) {
			current = Math.floor(Math.random() * (top + 1));
			tmp = array[current];
			array[current] = array[top];
			array[top] = tmp;
		}		
		return array;
	}

// Excellent write-up on n-puzzle solvability here: http://www.cs.bham.ac.uk/~mdr/teaching/modules04/java2/TilesSolvability.html

	function solvable(array){
		var tmp = 0; //stores the number of inversions
		// this checks every value against every value after it
		for(var i=0; i < array.length; i++){			
			for(var j=i+1; j < array.length; j++){
				if(array[i] > array[j]){ tmp++; }
			}
		}
		/* if tile_count is odd, tmp has to be even to be solvable; 
		will update for higher difficulty later	*/	
		if(tmp%2 == 0){
			return true;
		}
	}
	
});