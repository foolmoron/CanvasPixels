$(function() {
	//Pixel animation
	function Color(r, g, b, a) {
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = (a === undefined) ? 255 : a;
		
		this.toStyleString = function() {
			return 'rgba(' + this.r + ', ' + this.g + ', ' + this.b + ', ' + this.a + ')';
		};
		this.clone = function() {
			return new Color(this.r, this.g, this.b, this.a);
		}
	}
	Colors = { // static utilities for Color
		BLACK: new Color(0, 0, 0),
		BLUE: new Color(0, 0, 255),
		RED: new Color(255, 0, 0),
		WHITE: new Color(255, 255, 255),
		CLEAR: new Color(255, 255, 255, 0),
	
		interpolateBetween: function(color1, color2, interpolationFunction, interpolation) {
			var lerp = interpolationFunction(interpolation);
			return new Color(
					lerpNumbers(color1.r, color2.r, lerp),
					lerpNumbers(color1.g, color2.g, lerp),
					lerpNumbers(color1.b, color2.b, lerp),
					lerpNumbers(color1.a, color2.a, lerp)
				);
		}
	}
	
	function Pixel(color, deathTime, interpolationFunction) {
		this.color = color.clone();
		this.deathTime = deathTime;
		this.interpolationFunction = interpolationFunction || EasingFunctions.linear;
		
		this.deathColor = color
		this.lifeTime = 0;
		this.alive = true;
		
		this.update = function(dt) {
			this.lifeTime += dt;
			if (this.lifeTime >= this.deathTime) {
				this.alive = false;
				return;
			}
			
			var interp = this.lifeTime / this.deathTime;
			this.color.a = 255 * (1 - interp);
		};
		
		this.draw = function(canvas, ctx, x, y, size) {
			if (!this.alive)
				return;
				
			ctx.globalAlpha = this.color.a / 255;
			ctx.fillStyle = this.color.toStyleString();
			ctx.fillRect(x, y, size, size);			
		};
	}
	Pixels = { // static utilities for Pixel
	};
	
	PixelManager = {
		allPixels: {},
		pixelCount: 0,
		
		spawnPixels: function(options) {
			options = options || {};
			var count = options.count || 1;
			
			var maxIndex = pixelsAcross * pixelsDown;
			for (var i = 0; i < count; i++) {
				if (this.pixelCount >= maxIndex)
					return;
					
				var index = Math.floor(Math.random() * maxIndex);
				while (index in this.allPixels) { //linear probing ftw
					index = (index + 1) % maxIndex;
				}
				this.spawnPixelAtPositionIndex(index, options);
			}
		},
		
		spawnPixelAtPositionIndex: function(index, options) {
			if (index in this.allPixels)
				return;
			
			options = options || {};
			var randomInitialLifetime = options.randomInitialLifetime || false;
			
			this.allPixels[index] = new Pixel(Colors.BLUE, PIXEL_DEATH_TIME);
			if (randomInitialLifetime)
				this.allPixels[index].lifeTime = Math.random() * PIXEL_DEATH_TIME / 2;
			this.pixelCount++;
		},
		
		removePixel: function(positionIndex) {
			if (positionIndex in this.allPixels) {
				delete this.allPixels[positionIndex];
				this.pixelCount--;
			}
		},
		
		updatePixels: function(dt) {
			for (i in this.allPixels) {
				this.allPixels[i].update(dt);
				if (!this.allPixels[i].alive)
					this.removePixel(i);
			}
		},
		
		drawPixels: function(canvas, ctx) {
			for (i in this.allPixels) {
				var tileX = (i % pixelsAcross);
				var tileY = Math.floor(i / pixelsAcross);
				var x = tileX * pixelSize;
				var y = tileY * pixelSize;
				this.allPixels[i].draw(canvas, ctx, x, y, pixelSize);
			}
		},
	};
	
	var NUM_PIXELS_ACROSS_VERT = 10;
	var NUM_PIXELS_ACROSS_HORIZ = 60;
	var PIXEL_DEATH_TIME = 2 * 1000;
	var PIXEL_SPAWN_INTERVAL = (1 / 1000) * 1000;
	
	var pixelSize;
	var pixelsAcross;
	var pixelsDown;
	
	var lastUpdateTime = new Date().getTime();
	var pixelSpawnTimer = 0;
	var pixelsCanvas = $('#pixels');
	var pixelsCanvasDOM = $('#pixels')[0];
	var pixelsContext = pixelsCanvasDOM.getContext('2d');
	
	if (isCanvasSupported()) {
		pixelsCanvas.show();
		initPixels();
	} else {
		pixelsCanvas.hide();
	}
	
	function initPixels() {
		calculateCanvasDimensions();
		//PixelManager.spawnPixels({count: 100, randomInitialLifetime: true});
		
		pixelsCanvas.mousemove(canvasMouseMoveHandler);
		pixelsCanvas.on('touchmove', canvasMouseMoveHandler);
		
		requestAnimFrame(function() { updatePixels(); });
	}
	
	function updatePixels() {
		var currentUpdateTime = new Date().getTime();
		var dt = currentUpdateTime - lastUpdateTime;
		lastUpdateTime = currentUpdateTime;
		
		calculateCanvasDimensions();
		
		pixelSpawnTimer += dt;
		if (pixelSpawnTimer >= PIXEL_SPAWN_INTERVAL) {
			var count = Math.floor(pixelSpawnTimer / PIXEL_SPAWN_INTERVAL);
			PixelManager.spawnPixels({count: count, randomInitialLifetime: true});
			pixelSpawnTimer -= PIXEL_SPAWN_INTERVAL * count;
		}
		
		PixelManager.updatePixels(dt);
				
		drawPixels();
	}
	
	function calculateCanvasDimensions() {
		var height = pixelsCanvas.height(); // get CSS dimensions of box containing canvas
		var width = pixelsCanvas.width();
		pixelsCanvasDOM.height = height; // actually set canvas dimensions so it isn't stretched into its box
		pixelsCanvasDOM.width = width;
		
		var canvasVertical = height > width;
		if (canvasVertical) {
			pixelSize = width / NUM_PIXELS_ACROSS_VERT;
			pixelsAcross = NUM_PIXELS_ACROSS_VERT;
			pixelsDown = Math.ceil(height / pixelSize);
		} else {
			pixelSize = width / NUM_PIXELS_ACROSS_HORIZ;
			pixelsAcross = NUM_PIXELS_ACROSS_HORIZ;
			pixelsDown = Math.ceil(height / pixelSize);
		}
	}
	
	function canvasMouseMoveHandler(evt) {
		var tileX, tileY;
		var indices = [];
		tileX = Math.floor(evt.offsetX / pixelSize);
		tileY = Math.floor(evt.offsetY / pixelSize);
		indices.push(tileY * pixelsAcross + tileX);
		
		for (var i = 0; i < indices.length; i++) {
			PixelManager.spawnPixelAtPositionIndex(indices[i]);
			PixelManager.allPixels[indices[i]].lifeTime = 0;		
			PixelManager.allPixels[indices[i]].color = Colors.RED.clone();			
		}
	}

	function drawPixels() {
		var canvas = pixelsCanvas;
		var ctx = pixelsContext;
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		
		PixelManager.drawPixels(canvas, ctx);
			
		requestAnimFrame(function() { updatePixels(); });
	}
});

// Utilities
window.lerpNumbers = function(a, b, interpolation) {
	if (a === b)
		return a;
	return a * (1 - interpolation) + b * interpolation;
};

window.requestAnimFrame = (function(){
	return  window.requestAnimationFrame ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame ||
		function(callback) {
			window.setTimeout(callback, 1000 / 60);
		};
})();

window.isCanvasSupported = function() {
	var elem = document.createElement('canvas');
	return !!(elem.getContext && elem.getContext('2d'));
};

EasingFunctions = {
	// no easing, no acceleration
	linear: function (t) { return t },
	// accelerating from zero velocity
	easeInQuad: function (t) { return t*t },
	// decelerating to zero velocity
	easeOutQuad: function (t) { return t*(2-t) },
	// acceleration until halfway, then deceleration
	easeInOutQuad: function (t) { return t<.5 ? 2*t*t : -1+(4-2*t)*t },
	// accelerating from zero velocity 
	easeInCubic: function (t) { return t*t*t },
	// decelerating to zero velocity 
	easeOutCubic: function (t) { return (--t)*t*t+1 },
	// acceleration until halfway, then deceleration 
	easeInOutCubic: function (t) { return t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1 },
	// accelerating from zero velocity 
	easeInQuart: function (t) { return t*t*t*t },
	// decelerating to zero velocity 
	easeOutQuart: function (t) { return 1-(--t)*t*t*t },
	// acceleration until halfway, then deceleration
	easeInOutQuart: function (t) { return t<.5 ? 8*t*t*t*t : 1-8*(--t)*t*t*t },
	// accelerating from zero velocity
	easeInQuint: function (t) { return t*t*t*t*t },
	// decelerating to zero velocity
	easeOutQuint: function (t) { return 1+(--t)*t*t*t*t },
	// acceleration until halfway, then deceleration 
	easeInOutQuint: function (t) { return t<.5 ? 16*t*t*t*t*t : 1+16*(--t)*t*t*t*t }
}