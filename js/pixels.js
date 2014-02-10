$(function() {
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
		};
	}
	Colors = { // static utilities for Color
		BLACK: new Color(0, 0, 0),
		BLUE: new Color(0, 0, 255),
		ORANGE: new Color(255, 132, 0),
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
		},
		fromStyleString: function(styleString) {
			var noParens = styleString.split('(')[1].split(')')[0];
			var stringVals = noParens.split(',');
			var numberVals = stringVals.map(function(val) { return parseFloat(val); });
			return new Color(numberVals[0], numberVals[1], numberVals[2], numberVals[3]);
		},
	}
	
	function Pixel(color, deathTime, interpolationFunction) {
		this.color = color.clone();
		this.deathTime = deathTime;
		this.interpolationFunction = interpolationFunction || EasingFunctions.linear;
		
		this.lifeTime = 0;
		this.alive = true;
		this.deathColor = color;
		this.position = {x: 0, y: 0};
		
		this.update = function(dt) {
			this.lifeTime += dt;
			if (this.lifeTime >= this.deathTime) {
				this.alive = false;
				return;
			}
			
			var interp = this.lifeTime / this.deathTime;
			this.color.a = 255 * (1 - interp);
		};
		
		this.draw = function(canvas, ctx, size) {
			if (!this.alive)
				return;
				
			ctx.globalAlpha = this.color.a / 255;
			ctx.fillStyle = this.color.toStyleString();
			ctx.fillRect(this.position.x, this.position.y, size, size);			
		};
	}
	Pixels = { // static utilities for Pixel
	};
	
	ScreenPositionToColorsMap = {
		BORDERING_COLORS_INTERPOLATION_RANGE: 80, // px
		colorIntervals: [], // contains list of: { screenInterval = [start, end], pixelsColor = color object }
		
		colorsAtVerticalPosition: function(verticalPosition) {
			var color = DEFAULT_COLOR;
			for (var i = 0; i < this.colorIntervals.length; i++) {
				var interval = this.colorIntervals[i].screenInterval;
				if (verticalPosition >= interval[0] && verticalPosition <= interval[1]) {
					color = this.colorIntervals[i].pixelsColor;
					//interp between bordering colors
					var interpRange = this.BORDERING_COLORS_INTERPOLATION_RANGE;
					if (i > 0 && interval[0] + interpRange >= verticalPosition) { // near previous color
						var interp = (((interval[0] + interpRange) - verticalPosition) / interpRange) * 0.5;
						var previousColor = this.colorIntervals[i - 1].pixelsColor;
						color = Colors.interpolateBetween(color, previousColor, EasingFunctions.linear, interp);
						//color = Colors.BLACK;
					} else if (i < (this.colorIntervals.length - 1) && interval[1] - interpRange <= verticalPosition) { // near next color
						var interp = ((verticalPosition - (interval[1] - interpRange)) / interpRange) * 0.5;
						var nextColor = this.colorIntervals[i + 1].pixelsColor;
						color = Colors.interpolateBetween(color, nextColor, EasingFunctions.linear, interp);
						//color = Colors.ORANGE;
					}
					break;
				}
			}
			return color;
		},
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
				while (index in this.allPixels) { // linear probing ftw
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
			
			this.allPixels[index] = new Pixel(DEFAULT_COLOR, PIXEL_DEATH_TIME);
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
			var canvasTop = pixelsCanvas.offset().top - $(window).scrollTop();
			for (i in this.allPixels) {
				var pixel = this.allPixels[i];
				pixel.update(dt);
				if (!pixel.alive) {
					this.removePixel(i);
					continue;
				}
					
				var tileX = (i % pixelsAcross);
				var tileY = Math.floor(i / pixelsAcross);
				pixel.position.x = tileX * pixelSize;
				pixel.position.y = tileY * pixelSize;
				
				var color = ScreenPositionToColorsMap.colorsAtVerticalPosition(canvasTop + pixel.position.y);
				pixel.color.r = Math.round(color.r);
				pixel.color.g = Math.round(color.g);
				pixel.color.b = Math.round(color.b);
			}
		},
		
		drawPixels: function(canvas, ctx) {
			for (i in this.allPixels) {
				this.allPixels[i].draw(canvas, ctx, pixelSize);
			}
		},
	};
	
	var NUM_PIXELS_ACROSS_VERT = 10;
	var NUM_PIXELS_ACROSS_HORIZ = 60;
	var PIXEL_DEATH_TIME = 4 * 1000; // ms
	var PIXEL_SPAWN_INTERVAL = 6; // ms
	var DEFAULT_COLOR = Colors.ORANGE;
	
	var pixelSize;
	var pixelsAcross;
	var pixelsDown;
	
	var lastUpdateTime = new Date().getTime();
	var pixelSpawnTimer = 0;
	var pixelsCanvas = $('#pixels');
	var pixelsCanvasDOM = $('#pixels')[0];
	var pixelsContext = pixelsCanvasDOM.getContext('2d');
	var contentDivs = $('.content');
	
	//Start everything off
	if (isCanvasSupported()) {
		pixelsCanvas.show();
		initPixels();
	} else {
		pixelsCanvas.hide();
		return;
	}
	
	function initPixels() {
		recalculateCanvasData();
		//PixelManager.spawnPixels({count: 100, randomInitialLifetime: true});
		
		pixelsCanvas.mousemove(canvasMouseMoveHandler);
		pixelsCanvas.on('touchstart', canvasMouseMoveHandler);
		pixelsCanvas.on('touchmove', canvasMouseMoveHandler);
		
		requestAnimFrame(function() { updatePixels(); });
	}
	
	function updatePixels() {
		var currentUpdateTime = new Date().getTime();
		var dt = currentUpdateTime - lastUpdateTime;
		lastUpdateTime = currentUpdateTime;
		
		recalculateCanvasData();
		
		pixelSpawnTimer += dt;
		if (pixelSpawnTimer >= PIXEL_SPAWN_INTERVAL) {
			var count = Math.floor(pixelSpawnTimer / PIXEL_SPAWN_INTERVAL);
			PixelManager.spawnPixels({count: count, randomInitialLifetime: true});
			pixelSpawnTimer -= PIXEL_SPAWN_INTERVAL * count;
		}
		
		PixelManager.updatePixels(dt);
				
		drawPixels();
	}
	
	function recalculateCanvasData() {
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
		
		ScreenPositionToColorsMap.colorIntervals = [];
		for	(var i = 0; i < contentDivs.length; i++) {
			var content = $(contentDivs[i]);
			var pixelsColor = content.attr('data-pixel-colors') || DEFAULT_COLOR;			
			//content.css('background-color', pixelsColor);
			
			var scrollY = $(window).scrollTop();
			var screenheight = $(window).height();
			var contentY = content.offset().top;
			var contentHeight = content.height();
			var screenInterval = [contentY - scrollY, (contentY - scrollY) + contentHeight];
			
			if (screenInterval[1] >= 0 && screenInterval[0] <= screenheight) { // filter out off-screen intervals
				ScreenPositionToColorsMap.colorIntervals.push({screenInterval: screenInterval, pixelsColor: Colors.fromStyleString(pixelsColor)});
			}
		}
		ScreenPositionToColorsMap.colorIntervals.sort(function(a, b) { return a.screenInterval[0] - b.screenInterval[0]; }); // sort by beginning of interval, ascending
	}
	
	function canvasMouseMoveHandler(evt) {
		var tileX, tileY;
		var indices = [];
		
		if (evt.originalEvent instanceof MouseEvent) {
			tileX = Math.floor(evt.offsetX / pixelSize);
			tileY = Math.floor(evt.offsetY / pixelSize);
			indices.push(tileY * pixelsAcross + tileX);
		} else if (evt.originalEvent instanceof TouchEvent) {
			evt.preventDefault(); // prevent default scrolling behavior which causes touchmove events to stop
			
			var canvasLeft = pixelsCanvas.position().left;
			var canvasTop = pixelsCanvas.position().top;
			for (var i = 0; i < evt.originalEvent.changedTouches.length; i++) {
				var touch = evt.originalEvent.changedTouches[i];				
				tileX = Math.floor((touch.clientX - canvasLeft) / pixelSize);
				tileY = Math.floor((touch.clientY - canvasTop) / pixelSize);
				if (tileX < 0 || tileY < 0)
					continue;
				indices.push(tileY * pixelsAcross + tileX);
			}
		}
		
		for (var i = 0; i < indices.length; i++) {
			PixelManager.spawnPixelAtPositionIndex(indices[i]);
			PixelManager.allPixels[indices[i]].lifeTime = 0;		
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