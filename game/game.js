'use strict';

// constants
var con =
{
	camera_offset: new THREE.Vector3(),
	camera_size: 12.0,
	coin_flip_time: 0.5,
	coin_velocity_damping: 3.0,
	damage_time: 2.0,
	light_tip_time: 0.25,
	light_cell_size: 3,
	monster_normal_speed: 2,
	monster_max_speed: 7,
	monster_detect_radius: 6,
	monster_chase_radius: 7,
	monster_damage_radius: 3,
	monster_attack_radius: 1.5,
	monster_attack_delay: 0.5,
	monster_post_attack_delay: 0.75,
	monster_scare_radius: 4,
	monster_alert_radius: 20,
	body_radius: 0.4,
	load_bar_size: new THREE.Vector2(5, 1),
	fade_time: 3,
	msg_time: 2.5,
	glare_color: new THREE.Color(1, 1, 0.7),
	level_names:
	[
		'',
		'FOYER',
		'HALLWAY',
		'LIVING ROOM',
		'STUDY',
		'YOU PULLED IT OFF!',
	],
	collision_directions:
	{
		right: new THREE.Vector2(0.45, 0),
		left: new THREE.Vector2(-0.45, 0),
		forward: new THREE.Vector2(0, 0.45),
		backward: new THREE.Vector2(0, -0.45),
	},
	directions:
	{
		right: 0,
		left: 1,
		forward: 2,
		backward: 3,
	},
	directions_with_diagonals:
	{
		right: 0,
		left: 1,
		forward: 2,
		backward: 3,
		right_forward: 4,
		left_forward: 5,
		right_backward: 6,
		left_backward: 7,
	},
	max_capacity: 4,
	masks:
	{
		wall: 1 << 0,
		light: 1 << 1,
		coin: 1 << 2,
		player: 1 << 3,
		door: 1 << 4,
	},
	monster_states:
	{
		normal: 0,
		chase: 1,
		attack: 2,
		alert: 3,
		hide: 4,
	},
	codes:
	{
		wall: [0, 0, 0],
		light: [255, 0, 0],
		coin: [0, 255, 0],
		player: [255, 255, 0],
		door: [0, 255, 255],
		monster: [255, 0, 255],
	},
	speed_multiplier: 2.0,
	speed_max: 5.0,
	audio:
	{
		coin: [ 'snd/coin.wav', ],
		coins: [ 'snd/coins.wav', ],
		howl: [ 'snd/howl.wav', ],
		whimper: [ 'snd/whimper.wav', ],
		door_close: [ 'snd/door_close.wav', ],
		monster_loop: [ 'snd/monster_loop.wav', ],
		menu_music: [ 'snd/menu_music.mp3' ],
		end_music: [ 'snd/end_music.mp3' ],
		attack:
		[
			'snd/attack0.wav',
			'snd/attack1.wav',
			'snd/attack2.wav',
		],
		footstep:
		[
			'snd/footstep0.wav',
			'snd/footstep1.wav',
			'snd/footstep2.wav',
			'snd/footstep3.wav',
			'snd/footstep4.wav',
			'snd/footstep5.wav',
			'snd/footstep6.wav',
		],
		light_tip:
		[
			'snd/light_tip0.wav',
			'snd/light_tip1.wav',
			'snd/light_tip2.wav',
		],
		growl:
		[
			'snd/growl0.wav',
			'snd/growl1.wav',
		],
	},
};

var state =
{
	font: null,
	level: 0,
	grid: null,
	size: new THREE.Vector2(),
	door: new THREE.Vector2(),
	door_coins: 1,
	bank_coins: 0,
	coins: [],
	light_models: [],
	monsters: [],
	player:
	{
		alive: false,
		damage_timer: 0,
		pos: new THREE.Vector2(),
		coins: [],
		light: 1,
	},
};

var graphics =
{
	overlay: null,
	load_bar: null,
	load_bar_background: null,
	logo: null,
	ui: null,
	texture_loader: new THREE.TextureLoader(),
	model_loader: new THREE.JSONLoader(),
	door_text:
	{
		bank_coins: 0,
		door_coins: 0,
		mesh: null,
	},
	msg: null,
	msg_timer: 0,
	scene: null,
	camera: null,
	renderer: null,
	scenery: [],
	flicker_lights: [],
	monsters: [],
	light_models: [],
	coins: [],
	player_coins: [],
	camera_pos: new THREE.Vector2(),
	camera_pos_target: new THREE.Vector2(2, 10),
	ground: null,
	player: null,
	reticle: null,
	player_light: null,
	level: { },
	geom:
	{
		light: null,
		player: null,
		monster: null,
		wall: null,
		coin: null,
	},
	texture:
	{
		floor: null,
		wall: null,
		glare: null,
		logo: null,
	},
};

var global =
{
	load_total: 0,
	load_count: 0,
	level_timer: 0,
	music: null,
	monster_loop_gain: null,
	audio_context: null,
	clock: new THREE.Clock(),
	mouse: new THREE.Vector2(),
	mouse_down: false,
	button_down: false,
	last_button_down: false,
	last_mouse_down: false,
	footstep_counter: 0,
};

// three.js extensions

/**
 * @author zz85 / http://www.lab4games.net/zz85/blog
 * @author alteredq / http://alteredqualia.com/
 *
 * Text = 3D Text
 *
 * parameters = {
 *  font: <THREE.Font>, // font
 *
 *  size: <float>, // size of the text
 *  height: <float>, // thickness to extrude text
 *  curveSegments: <int>, // number of points on the curves
 *
 *  bevelEnabled: <bool>, // turn on bevel
 *  bevelThickness: <float>, // how deep into text bevel goes
 *  bevelSize: <float> // how far from text outline is bevel
 * }
 */

THREE.TextGeometry = function ( text, parameters ) {

	parameters = parameters || {};

	var font = parameters.font;

	if ( font instanceof THREE.Font === false ) {

		console.error( 'THREE.TextGeometry: font parameter is not an instance of THREE.Font.' );
		return new THREE.Geometry();

	}

	var shapes = font.generateShapes( text, parameters.size, parameters.curveSegments );

	// translate parameters to ExtrudeGeometry API

	parameters.amount = parameters.height !== undefined ? parameters.height : 50;

	// defaults

	if ( parameters.bevelThickness === undefined ) parameters.bevelThickness = 10;
	if ( parameters.bevelSize === undefined ) parameters.bevelSize = 8;
	if ( parameters.bevelEnabled === undefined ) parameters.bevelEnabled = false;

	THREE.ExtrudeGeometry.call( this, shapes, parameters );

	this.type = 'TextGeometry';

};

THREE.TextGeometry.prototype = Object.create( THREE.ExtrudeGeometry.prototype );
THREE.TextGeometry.prototype.constructor = THREE.TextGeometry;

/**
 * @author zz85 / http://www.lab4games.net/zz85/blog
 * @author alteredq / http://alteredqualia.com/
 *
 * For Text operations in three.js (See TextGeometry)
 *
 * It uses techniques used in:
 *
 *	Triangulation ported from AS3
 *		Simple Polygon Triangulation
 *		http://actionsnippet.com/?p=1462
 *
 * 	A Method to triangulate shapes with holes
 *		http://www.sakri.net/blog/2009/06/12/an-approach-to-triangulating-polygons-with-holes/
 *
 */

THREE.FontUtils = {

	faces: {},

	// Just for now. face[weight][style]

	face: 'helvetiker',
	weight: 'normal',
	style: 'normal',
	size: 150,
	divisions: 10,

	getFace: function () {

		try {

			return this.faces[ this.face.toLowerCase() ][ this.weight ][ this.style ];

		} catch ( e ) {

			throw "The font " + this.face + " with " + this.weight + " weight and " + this.style + " style is missing."

		}

	},

	loadFace: function ( data ) {

		var family = data.familyName.toLowerCase();

		var ThreeFont = this;

		ThreeFont.faces[ family ] = ThreeFont.faces[ family ] || {};

		ThreeFont.faces[ family ][ data.cssFontWeight ] = ThreeFont.faces[ family ][ data.cssFontWeight ] || {};
		ThreeFont.faces[ family ][ data.cssFontWeight ][ data.cssFontStyle ] = data;

		ThreeFont.faces[ family ][ data.cssFontWeight ][ data.cssFontStyle ] = data;

		return data;

	},

	drawText: function ( text ) {

		// RenderText

		var i,
			face = this.getFace(),
			scale = this.size / face.resolution,
			offset = 0,
			chars = String( text ).split( '' ),
			length = chars.length;

		var fontPaths = [];

		for ( i = 0; i < length; i ++ ) {

			var path = new THREE.Path();

			var ret = this.extractGlyphPoints( chars[ i ], face, scale, offset, path );
			offset += ret.offset;

			fontPaths.push( ret.path );

		}

		// get the width

		var width = offset / 2;
		//
		// for ( p = 0; p < allPts.length; p++ ) {
		//
		// 	allPts[ p ].x -= width;
		//
		// }

		//var extract = this.extractPoints( allPts, characterPts );
		//extract.contour = allPts;

		//extract.paths = fontPaths;
		//extract.offset = width;

		return { paths: fontPaths, offset: width };

	},




	extractGlyphPoints: function ( c, face, scale, offset, path ) {

		var pts = [];

		var b2 = THREE.ShapeUtils.b2;
		var b3 = THREE.ShapeUtils.b3;

		var i, i2, divisions,
			outline, action, length,
			scaleX, scaleY,
			x, y, cpx, cpy, cpx0, cpy0, cpx1, cpy1, cpx2, cpy2,
			laste,
			glyph = face.glyphs[ c ] || face.glyphs[ '?' ];

		if ( ! glyph ) return;

		if ( glyph.o ) {

			outline = glyph._cachedOutline || ( glyph._cachedOutline = glyph.o.split( ' ' ) );
			length = outline.length;

			scaleX = scale;
			scaleY = scale;

			for ( i = 0; i < length; ) {

				action = outline[ i ++ ];

				//console.log( action );

				switch ( action ) {

				case 'm':

					// Move To

					x = outline[ i ++ ] * scaleX + offset;
					y = outline[ i ++ ] * scaleY;

					path.moveTo( x, y );
					break;

				case 'l':

					// Line To

					x = outline[ i ++ ] * scaleX + offset;
					y = outline[ i ++ ] * scaleY;
					path.lineTo( x, y );
					break;

				case 'q':

					// QuadraticCurveTo

					cpx  = outline[ i ++ ] * scaleX + offset;
					cpy  = outline[ i ++ ] * scaleY;
					cpx1 = outline[ i ++ ] * scaleX + offset;
					cpy1 = outline[ i ++ ] * scaleY;

					path.quadraticCurveTo( cpx1, cpy1, cpx, cpy );

					laste = pts[ pts.length - 1 ];

					if ( laste ) {

						cpx0 = laste.x;
						cpy0 = laste.y;

						for ( i2 = 1, divisions = this.divisions; i2 <= divisions; i2 ++ ) {

							var t = i2 / divisions;
							b2( t, cpx0, cpx1, cpx );
							b2( t, cpy0, cpy1, cpy );

						}

					}

					break;

				case 'b':

					// Cubic Bezier Curve

					cpx  = outline[ i ++ ] * scaleX + offset;
					cpy  = outline[ i ++ ] * scaleY;
					cpx1 = outline[ i ++ ] * scaleX + offset;
					cpy1 = outline[ i ++ ] * scaleY;
					cpx2 = outline[ i ++ ] * scaleX + offset;
					cpy2 = outline[ i ++ ] * scaleY;

					path.bezierCurveTo( cpx1, cpy1, cpx2, cpy2, cpx, cpy );

					laste = pts[ pts.length - 1 ];

					if ( laste ) {

						cpx0 = laste.x;
						cpy0 = laste.y;

						for ( i2 = 1, divisions = this.divisions; i2 <= divisions; i2 ++ ) {

							var t = i2 / divisions;
							b3( t, cpx0, cpx1, cpx2, cpx );
							b3( t, cpy0, cpy1, cpy2, cpy );

						}

					}

					break;

				}

			}

		}



		return { offset: glyph.ha * scale, path: path };

	}

};


THREE.FontUtils.generateShapes = function ( text, parameters ) {

	// Parameters

	parameters = parameters || {};

	var size = parameters.size !== undefined ? parameters.size : 100;
	var curveSegments = parameters.curveSegments !== undefined ? parameters.curveSegments : 4;

	var font = parameters.font !== undefined ? parameters.font : 'helvetiker';
	var weight = parameters.weight !== undefined ? parameters.weight : 'normal';
	var style = parameters.style !== undefined ? parameters.style : 'normal';

	THREE.FontUtils.size = size;
	THREE.FontUtils.divisions = curveSegments;

	THREE.FontUtils.face = font;
	THREE.FontUtils.weight = weight;
	THREE.FontUtils.style = style;

	// Get a Font data json object

	var data = THREE.FontUtils.drawText( text );

	var paths = data.paths;
	var shapes = [];

	for ( var p = 0, pl = paths.length; p < pl; p ++ ) {

		Array.prototype.push.apply( shapes, paths[ p ].toShapes() );

	}

	return shapes;

};

// To use the typeface.js face files, hook up the API

THREE.typeface_js = { faces: THREE.FontUtils.faces, loadFace: THREE.FontUtils.loadFace };
if ( typeof self !== 'undefined' ) self._typeface_js = THREE.typeface_js;

THREE.FloorGeometry = function(width, height)
{
	THREE.BufferGeometry.call(this);

	this.type = 'FloorGeometry';

	this.parameters =
	{
		width: width,
		height: height,
	};

	var vertices = new Float32Array(4 * 3);
	var normals = new Float32Array(4 * 3);
	var uvs = new Float32Array(4 * 2);

	var vertex = 0;
	for (var y = 0; y < 2; y++)
	{
		for (var x = 0; x < 2; x++)
		{
			var offset3 = vertex * 3;
			vertices[offset3] = x * width;
			vertices[offset3 + 1] = y * height;

			normals[offset3 + 2] = 1;

			var offset2 = vertex * 2;
			uvs[offset2] = x * width;
			uvs[offset2 + 1] = y * height;
			vertex++;
		}
	}

	var indices = new Uint16Array(6);

	indices[0] = 0;
	indices[1] = 1;
	indices[2] = 2;
	indices[3] = 1;
	indices[4] = 3;
	indices[5] = 2;

	this.setIndex(new THREE.BufferAttribute(indices, 1));
	this.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
	this.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
	this.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
};
THREE.FloorGeometry.prototype = Object.create(THREE.BufferGeometry.prototype);
THREE.FloorGeometry.prototype.constructor = THREE.FloorGeometry;

THREE.ReticleGeometry = function(width, height)
{
	THREE.BufferGeometry.call(this);

	this.type = 'ReticleGeometry';

	this.parameters =
	{
		width: width,
		height: height,
	};

	var vertices = new Float32Array(3 * 3);
	var normals = new Float32Array(3 * 3);
	var uvs = new Float32Array(3 * 2);

	var z = 0.1;
	vertices[0] = width * 0.5;
	vertices[1] = -height;
	vertices[2] = z;
	vertices[3 + 0] = 0;
	vertices[3 + 1] = 0;
	vertices[3 + 2] = z;
	vertices[3 + 0] = 0;
	vertices[6 + 0] = width * -0.5;
	vertices[6 + 1] = -height;
	vertices[6 + 2] = z;

	normals[2] = 1;
	normals[3 + 2] = 1;
	normals[6 + 2] = 1;

	uvs[0] = 0;
	uvs[1] = 0;
	uvs[1 + 0] = 0.5;
	uvs[1 + 1] = 1;
	uvs[2 + 0] = 1;
	uvs[2 + 1] = 0;

	var indices = new Uint16Array(3);

	indices[0] = 0;
	indices[1] = 1;
	indices[2] = 2;

	this.setIndex(new THREE.BufferAttribute(indices, 1));
	this.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
	this.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
	this.addAttribute('uv', new THREE.BufferAttribute(uvs, 2));
};
THREE.ReticleGeometry.prototype = Object.create(THREE.BufferGeometry.prototype);
THREE.ReticleGeometry.prototype.constructor = THREE.ReticleGeometry;

// procedures

var func = {};

func.msg = function(msg)
{
	graphics.msg_timer = state.level === 0 ? 0 : con.msg_time;
	if (graphics.msg)
		graphics.ui.remove(graphics.msg);
	if (msg)
	{
		graphics.msg = func.create_text(msg, 2.0, graphics.ui);
		graphics.msg.material = new THREE.ShaderMaterial(
		{
			vertexShader: document.getElementById('vertex_shader_unlit').textContent,
			fragmentShader: document.getElementById('fragment_shader_unlit').textContent,
		});
		graphics.msg.position.y = -3.0;
	}
	else
		graphics.msg = null;
};

func.load_audio = function(url, snds, snd_index, callback)
{
	var request = new XMLHttpRequest();
	request.open('GET', url, true);
	request.responseType = 'arraybuffer';

	request.onload = function()
	{
		global.audio_context.decodeAudioData
		(
			request.response,
			function(buffer)
			{
				if (!buffer)
				{
					console.log('error decoding file data: ' + url);
					return;
				}
				snds[snd_index] = buffer;
				callback();
			},
			function(error)
			{
				console.error('decodeAudioData error', error);
			}
		);
	};

	request.onerror = function()
	{
		console.log('HTTP request failed: ' + url);
	};

	request.send();
};

func.load_geom = function(geom_name)
{
	global.load_total++;
	graphics.model_loader.load('geom/' + geom_name + '.js', function(geometry, materials)
	{
		graphics.geom[geom_name] = geometry;
		global.load_count++;
		func.check_done_loading();
	});
};

func.init = function()
{
	global.clock.start();

	var i = 0;
	for (var name in con.level_names)
	{
		graphics.level[i] = null; // set the level up to be loaded later
		i++;
	}

	window.addEventListener('resize', func.on_resize, false);

	graphics.scene = new THREE.Scene();

	graphics.camera = new THREE.OrthographicCamera
	(
		-1,
		1,
		1,
		-1,
		0.1, con.camera_size * 4
	);
	graphics.camera.rotation.x = Math.PI * 0.2;
	graphics.camera.rotation.y = Math.PI * 0.08;
	graphics.camera.rotation.z = Math.PI * 0.08;
	con.camera_offset = graphics.camera.getWorldDirection().multiplyScalar(-con.camera_size);

	graphics.ui = new THREE.Object3D();
	graphics.ui.quaternion.setFromEuler(graphics.camera.rotation);
	graphics.scene.add(graphics.ui);

	{
		graphics.overlay = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x000000, }));
		graphics.overlay.position.z = -1;
		graphics.ui.add(graphics.overlay);
		graphics.overlay.visible = false;
	}

	{
		graphics.load_bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, }));
		graphics.load_bar.position.z = -1;
		graphics.load_bar.scale.set(0, con.load_bar_size.y, 1);
		graphics.ui.add(graphics.load_bar);
		graphics.load_bar_background = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x666666, }));
		graphics.load_bar_background.position.z = -2;
		graphics.load_bar_background.scale.set(con.load_bar_size.x, con.load_bar_size.y, 1);
		graphics.ui.add(graphics.load_bar_background);
	}

	graphics.renderer = new THREE.WebGLRenderer({ antialias: true });
	graphics.renderer.setSize(window.innerWidth, window.innerHeight);

	graphics.renderer.gammaInput = true;
	graphics.renderer.gammaOutput = true;

	graphics.renderer.setClearColor(0x000000);
	graphics.renderer.setPixelRatio(window.devicePixelRatio);

	document.body.appendChild(graphics.renderer.domElement);

	func.on_resize();

	for (var geom_name in graphics.geom)
		func.load_geom(geom_name);

	for (var texture_name in graphics.texture)
	{
		global.load_total++;
		graphics.texture[texture_name] = graphics.texture_loader.load
		(
			'texture/' + texture_name + '.png',
			function(texture)
			{
				texture.minFilter = texture.magFilter = THREE.NearestFilter;
				global.load_count++;
				func.check_done_loading();
			},
			func.error
		);
	}

	for (var level_name in graphics.level)
	{
		global.load_total++;
		graphics.level[level_name] = graphics.texture_loader.load
		(
			'lvl/' + level_name + '.png',
			function(texture)
			{
				global.load_count++;
				func.check_done_loading();
			},
			func.error
		);
	}

	global.load_total++;
	new THREE.FontLoader().load('helvetiker_bold.typeface.js', function (response)
	{
		graphics.font = response;
		global.load_count++;
		func.check_done_loading();
	});

	var AudioContext = window.AudioContext || window.webkitAudioContext;
	global.audio_context = new AudioContext();

	var sounds = [];
	for (var snd_name in con.audio)
	{
		var snds = con.audio[snd_name];
		for (var i = 0; i < snds.length; i++)
		{
			var url = snds[i];
			global.load_total++;
			func.load_audio(url, snds, i, function(buffer)
			{
				global.load_count++;
				func.check_done_loading();
			});
		}
	}

	$(window).on('resize', func.on_resize);

	window.focus();
	$(document).on('keydown', func.on_keydown);
	$(document).on('keyup', func.on_keyup);

	$(document).on('mousedown', func.on_mousedown);
	$(document).on('mousemove', func.on_mousemove);
	$(document).on('mouseup', func.on_mouseup);
	$(document).on('touchstart', func.on_mousedown);
	$(document).on('touchmove', func.on_mousemove);
	$(document).on('touchend', func.on_mouseup);

	func.update();
};

func.audio = function(snds, volume, min_time_threshold)
{
	if (typeof min_time_threshold !== 'undefined')
	{
		// don't play the sound if we recently played it within the time threshold
		if (snds.time_last_played && (new Date() - snds.time_last_played) > min_time_threshold * 1000.0)
			return; // don't play the sound
	}
	if (typeof volume === 'undefined')
		volume = 1.0;

	if (volume > 0.0)
	{
		var source = global.audio_context.createBufferSource();

		// choose a sound
		if (snds.length > 1)
		{
			var index;
			do
			{
				index = Math.floor(Math.random() * snds.length);
			}
			while (index === snds.last_played);
			snds.last_played = index;
			source.buffer = snds[index];
		}
		else
			source.buffer = snds[0];

		snds.time_last_played = new Date();
		var gain = global.audio_context.createGain();
		source.connect(gain);
		gain.connect(global.audio_context.destination);
		gain.gain.value = volume;
		source.start(0);
	}
};

func.check_done_loading = function()
{
	if (global.load_count < global.load_total)
		return false;

	graphics.ui.remove(graphics.load_bar);
	graphics.ui.remove(graphics.load_bar_background);
	graphics.load_bar = null;
	graphics.load_bar_background = null;

	// monster loop
	{
		var source = global.audio_context.createBufferSource();
		source.buffer = con.audio.monster_loop[0];
		source.loop = true;
		var gain = global.audio_context.createGain();
		source.connect(gain);
		gain.connect(global.audio_context.destination);
		gain.gain.value = 0.0;
		global.monster_loop_gain = gain;
		source.start(0);
	}

	graphics.geom.glares = new THREE.Geometry();
	graphics.geom.glares.vertices.push(new THREE.Vector3(0.8, 0, 2.5));
	graphics.geom.glares.vertices.push(new THREE.Vector3(-0.8, 0, 2.5));
	graphics.geom.glares.vertices.push(new THREE.Vector3(0, 0.8, 2.5));
	graphics.geom.glares.vertices.push(new THREE.Vector3(0, -0.8, 2.5));

	graphics.player = func.add_mesh(graphics.geom.player, 0xff0000);
	graphics.player_light = new THREE.PointLight(0xaa3311, 1, 5);
	graphics.player_light.position.set(0, 0, 1.5);
	graphics.player.add(graphics.player_light);
	graphics.reticle = func.add_mesh(new THREE.ReticleGeometry(0.4, 0.6), 0xff0000);
	graphics.player.add(graphics.reticle);

	func.load_level(state.level);

	return true;
};

func.on_mousedown = function(event)
{
	if (event.touches)
	{
		if (event.touches.length === 1)
			global.mouse.set(event.touches[0].pageX, event.touches[0].pageY);
	}
	else
		global.mouse.set(event.clientX, event.clientY);
	global.mouse_down = true;
	event.preventDefault();
};

func.on_mousemove = function(event)
{
	if (event.touches)
	{
		if (event.touches.length === 1)
			global.mouse.set(event.touches[0].pageX, event.touches[0].pageY);
	}
	else
		global.mouse.set(event.clientX, event.clientY);
	event.preventDefault();
};

func.on_mouseup = function(event)
{
	global.mouse_down = false;
	event.preventDefault();
};

func.create_text = function(value, size, parent)
{
	var scale = value.length === 1 ? 1.0 : 1.0 / Math.sqrt(value.length);
	var text_geometry = new THREE.TextGeometry(value,
	{
		size: size * scale,
		height: 0,
		curveSegments: 2,

		font: graphics.font,
		weight: 'bold',
		style: 'normal',

		bevelThickness: 0,
		bevelSize: 0,
		bevelEnabled: false,

		material: 0,
		extrudeMaterial: 0
	});
	var text = func.add_mesh(text_geometry, 0xff0000, null, parent);
	text_geometry.computeBoundingBox();
	text.position.x = -0.05 - 0.5 * (text_geometry.boundingBox.max.x - text_geometry.boundingBox.min.x);
	text.position.y = -0.5 * (text_geometry.boundingBox.max.y - text_geometry.boundingBox.min.y);
	return text;
};

func.music = function(snds)
{
	var source = global.audio_context.createBufferSource();
	source.buffer = snds[0];
	source.loop = true;
	source.connect(global.audio_context.destination);
	source.start(0);
	return source;
};

func.refresh_door_text = function()
{
	if (graphics.door_text.mesh)
		graphics.door.remove(graphics.door_text.mesh);
	if (state.door_coins > 0)
	{
		var text = func.create_text(state.bank_coins + ' / ' + state.door_coins, 1.0, graphics.door);
		text.position.z = 1.05;
		graphics.door_text.mesh = text;
	}

	graphics.door_text.bank_coins = state.bank_coins;
	graphics.door_text.door_coins = state.door_coins;
};

func.monster_spawn = function(pos)
{
	state.monsters.push(
	{
		pos: pos.clone(),
		path: [],
		state: con.monster_states.normal,
		timer: 0, // used for interval stuff like recalculating paths every x seconds
		timer2: 0, // used for accumulative stuff, like a vision timer before the monster is alerted
	});

	var monster = func.add_mesh(graphics.geom.monster, 0x000000);
	monster.position.set(pos.x, pos.y, 0);
	graphics.scenery.push(monster);
	graphics.monsters.push(monster);
};

func.load_level = function(level)
{
	// unload old stuff
	state.player.coins.length = 0;
	state.player.light = 1;
	state.grid = null;
	state.coins.length = 0;
	state.bank_coins = 0;
	state.light_models.length = 0;
	state.monsters.length = 0;

	graphics.logo = null;
	graphics.light_models.length = 0;
	graphics.monsters.length = 0;
	graphics.door_text.mesh = null;
	if (global.music)
	{
		global.music.stop();
		global.music = null;
	}

	if (graphics.ground)
	{
		graphics.scene.remove(graphics.ground);
		graphics.ground = null;
	}

	for (var i = 0; i < graphics.scenery.length; i++)
		graphics.scenery[i].parent.remove(graphics.scenery[i]);
	graphics.scenery.length = 0;

	graphics.flicker_lights.length = 0;

	// load new stuff
	state.level = level;
	state.player.alive = state.level !== 0 && state.level !== con.level_names.length - 1;
	global.level_timer = 0;

	var texture = graphics.level[state.level];

	state.size.x = texture.image.width;
	state.size.y = texture.image.height;

	state.grid = new Array(state.size.x);
	for (var i = 0; i < state.grid.length; i++)
		state.grid[i] = new Array(state.size.y);

	// read image data
	var canvas = document.createElement('canvas');
	canvas.width = texture.image.width;
	canvas.height = texture.image.height;
	var ctx = canvas.getContext('2d');
	ctx.drawImage(texture.image, 0, 0, texture.image.width, texture.image.height, 0, 0, texture.image.width, texture.image.height);
	var canvas_data = ctx.getImageData(0, 0, texture.image.width, texture.image.height);

	var pixel_equals = function(offset, color)
	{
		return canvas_data.data[offset] === color[0]
			&& canvas_data.data[offset + 1] === color[1]
			&& canvas_data.data[offset + 2] === color[2];
	};

	var pos = new THREE.Vector2();
	for (var x = 0; x < state.size.x; x++)
	{
		for (var y = 0; y < state.size.y; y++)
		{
			var grid_value =
			{
				mask: 0,
				id: 0,
			};
			var offset = (x + (((state.size.y - 1) - y) * state.size.x)) * 4;
			pos.set(x + 0.5, y + 0.5);
			if (pixel_equals(offset, con.codes.wall))
			{
				var wall = func.add_mesh(graphics.geom.wall, 0xffffff);
				wall.material.map = graphics.texture.wall;
				graphics.scenery.push(wall);
				wall.position.set(pos.x, pos.y, 0);
				grid_value.mask = con.masks.wall;
			}
			else if (pixel_equals(offset, con.codes.light))
			{
				state.light_models.push(
				{
					pos: pos.clone(),
					on: true,
					anim_time: con.light_tip_time,
					anim_dir: 0,
				});
				grid_value.mask = con.masks.light;
				grid_value.id = state.light_models.length - 1;

				var light = func.add_mesh(graphics.geom.light, 0xcccc44);
				graphics.scenery.push(light);
				light.position.set(pos.x, pos.y, 0);
				graphics.light_models.push(light);

				// candle glares

				var glare_material = new THREE.PointsMaterial({ size: 35, sizeAttenuation: false, map: graphics.texture.glare, transparent: true });
				glare_material.color.copy(con.glare_color);

				var particles = new THREE.Points(graphics.geom.glares, glare_material);
				light.add(particles);

				var point_light = new THREE.PointLight(0xdd9977, 1, 5);
				point_light.position.set(0, 0, 3.0);
				graphics.flicker_lights.push(point_light);
				light.add(point_light);

			}
			else if (pixel_equals(offset, con.codes.monster))
				func.monster_spawn(pos);
			else if (pixel_equals(offset, con.codes.player))
				state.player.pos.copy(pos);
			else if (canvas_data.data[offset] < 255
				&& canvas_data.data[offset + 1] === con.codes.door[1]
				&& canvas_data.data[offset + 2] === con.codes.door[2])
			{
				graphics.door = new THREE.Object3D();
				graphics.door.position.set(pos.x, pos.y, 0);
				graphics.scene.add(graphics.door);
				graphics.scenery.push(graphics.door);

				state.door.set(x, y);
				state.door_coins = canvas_data.data[offset];

				var point_light = new THREE.PointLight(0xffffff, 1, 5);
				point_light.position.set(0, 0, 3.0);
				graphics.door.add(point_light);
				grid_value.mask = con.masks.door;

				func.refresh_door_text();
			}
			else if (pixel_equals(offset, con.codes.coin))
			{
				state.coins.push(
				{
					pos: pos.clone(),
					velocity: new THREE.Vector2(),
				});
			}
			state.grid[x][y] = grid_value;
		}
	}

	graphics.texture.floor.wrapS = THREE.RepeatWrapping;
	graphics.texture.floor.wrapT = THREE.RepeatWrapping;
	graphics.ground = func.add_mesh(new THREE.FloorGeometry(state.size.x, state.size.y), 0xffddcc);
	graphics.ground.material.map = graphics.texture.floor;
	
	if (state.player.alive)
		graphics.camera_pos_target.copy(state.player.pos);
	else
		graphics.camera_pos_target.set(state.size.x * 0.5, 4);
	graphics.camera_pos.copy(graphics.camera_pos_target);
	
	func.msg(con.level_names[state.level]);

	if (state.level === 0)
	{
		var material = new THREE.SpriteMaterial({ map: graphics.texture.logo, color: 0xffffff, });
		graphics.logo = new THREE.Sprite(material);
		graphics.scenery.push(graphics.logo);
		graphics.ui.add(graphics.logo);
		global.music = func.music(con.audio.menu_music);
	}
	else if (state.level === con.level_names.length - 1)
		global.music = func.music(con.audio.end_music);
	else
		func.audio(con.audio.door_close);
};

func.coord = function(pos)
{
	return new THREE.Vector2(Math.floor(pos.x), Math.floor(pos.y));
};

func.cell_hash = function(pos)
{
	return pos.x + (pos.y * state.size.x);
};

func.random_goal = function(start, radius, filter)
{
	var points = [];
	var visited = {};

	var queue = [];
	queue.push(func.coord(start));

	while (queue.length > 0)
	{
		var coord = queue.pop(0);
		visited[func.cell_hash(coord)] = true;
		
		for (var dir_name in con.directions)
		{
			var adjacent = coord.clone();
			func.move_dir(adjacent, con.directions[dir_name]);
			if (adjacent.clone().sub(start).length() < radius)
			{
				var hash = func.cell_hash(adjacent);
				if (!visited[hash] && state.grid[adjacent.x][adjacent.y].mask === 0)
				{
					queue.push(adjacent);
					if (typeof filter === 'undefined' || filter(adjacent))
						points.push(adjacent);
				}
			}
		}
	}

	if (points.length === 0)
		return null;
	else
		return points[Math.floor(Math.random() * points.length)];
};

func.astar = function(start, end, path)
{
	start = func.coord(start);

	path.length = 0;

	var queue = [];
	queue.push(start);

	var travel_scores = {};
	var parents = {};
	var estimate_scores = {};

	var start_hash = func.cell_hash(start);
	travel_scores[start_hash] = 0;
	estimate_scores[start_hash] = end.clone().sub(start).length();

	var end_hash = func.cell_hash(func.coord(end));

	var priority_sort = function(a, b)
	{
		var a_hash = func.cell_hash(a);
		var b_hash = func.cell_hash(b);
		var a_score = travel_scores[a_hash] + estimate_scores[a_hash];
		var b_score = travel_scores[b_hash] + estimate_scores[b_hash];
		return b_score - a_score;
	};

	while (queue.length > 0)
	{
		queue.sort(priority_sort);
		var coord = queue.pop(0);

		var parent_travel_score = travel_scores[func.cell_hash(coord)];
		
		for (var dir_name in con.directions)
		{
			var adjacent = coord.clone();
			func.move_dir(adjacent, con.directions[dir_name]);
			if (state.grid[adjacent.x][adjacent.y].mask === 0)
			{
				var hash = func.cell_hash(adjacent);
				var existing_travel_score = travel_scores[hash];
				if (hash === end_hash)
				{
					// reconstruct path
					path.push(end);
					var current = coord;
					while (current)
					{
						path.splice(0, 0, current);
						current = parents[func.cell_hash(current)];
					}

					// remove start point; we're already there
					path.splice(0, 1);

					// simplify path
					for (var i = 0; i < path.length - 1; i++)
					{
						var coord = path[i];
						var adjacent_obstacle = false;
						for (var dir_name in con.directions_with_diagonals)
						{
							var adjacent = coord.clone();
							func.move_dir(adjacent, con.directions[dir_name]);
							if (state.grid[adjacent.x][adjacent.y].mask !== 0)
							{
								adjacent_obstacle = true;
								break;
							}
						}

						if (!adjacent_obstacle)
						{
							// no obstacles around waypoint; remove it
							path.splice(i, 1);
							i--;
						}
					}

					return true;
				}
				else
				{
					var travel_score = parent_travel_score + 1;
					if (typeof existing_travel_score === 'undefined')
					{
						parents[hash] = coord;
						travel_scores[hash] = travel_score;
						estimate_scores[hash] = end.clone().sub(adjacent).length();
						queue.push(adjacent);
					}
					else if (existing_travel_score > parent_travel_score + 1)
					{
						parents[hash] = coord;
						travel_scores[hash] = travel_score;
					}
				}
			}
		}
	}
	return false;
};

func.add_mesh = function(geometry, color, materials, parent)
{
	var material;
	if (materials)
	{
		var material_clones = new Array(materials.length);
		var c = new THREE.Color(color);
		for (var i = 0; i < materials.length; i++)
		{
			material_clones[i] = new THREE.MeshPhongMaterial({ color: materials[i].color, specular: 0x000000 });
			material_clones[i].color.multiply(c);
		}
		material = new THREE.MeshFaceMaterial(material_clones);
	}
	else
		material = new THREE.MeshPhongMaterial({ color: color, specular: 0x000000 });
	var mesh = new THREE.Mesh(geometry, material);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	if (parent)
		parent.add(mesh);
	else
		graphics.scene.add(mesh);
	return mesh;
};

func.flicker_light = function(light, i, scale)
{
	if (typeof scale === 'undefined')
		scale = 1.0;
	var intensity = light.intensity = scale * func.flicker(i);
	light.distance = 5.0 * intensity;
};

func.flicker = function(i, amount)
{
	if (typeof amount === 'undefined')
		amount = 0.02;
	return (1 - amount) + Math.sin((global.clock.getElapsedTime() + i) * 40.0) * amount;
};

func.collides = function(pos, x, y)
{
	return pos.x > x && pos.x < x + 1
		&& pos.y > y && pos.y < y + 1;
};

func.closest_corner = function(pos, x, y)
{
	var closest_distance = 1000;
	var closest_corner = new THREE.Vector2();
	var diff = new THREE.Vector2();
	for (var _x = x; _x < x + 2; _x++)
	{
		for (var _y = y; _y < y + 2; _y++)
		{
			var distance = diff.set(_x, _y).sub(pos).length();
			if (distance < closest_distance)
			{
				closest_corner.set(_x, _y);
				closest_distance = distance;
			}
		}
	}

	return {
		corner: closest_corner,
		distance: closest_distance,
	};
};

func.move_dir = function(pos, dir)
{
	switch (dir)
	{
		case con.directions.right:
			pos.x += 1;
			break;
		case con.directions.left:
			pos.x -= 1;
			break;
		case con.directions.forward:
			pos.y += 1;
			break;
		case con.directions.backward:
			pos.y -= 1;
			break;
		case con.directions.right_forward:
			pos.x += 1;
			pos.y += 1;
			break;
		case con.directions.left_forward:
			pos.x -= 1;
			pos.y += 1;
			break;
		case con.directions.right_backward:
			pos.x += 1;
			pos.y -= 1;
			break;
		case con.directions.left_backward:
			pos.x -= 1;
			pos.y -= 1;
			break;
	}
};

func.move_body = function(position, velocity, dt, speed_max, mask, tip_lights)
{
	if (typeof speed_max === 'undefined')
		speed_max = con.speed_max;
	if (typeof mask === 'undefined')
		mask = 0xffffff;
	
	var speed = velocity.length();
	if (speed > speed_max)
	{
		velocity.multiplyScalar(speed_max / speed);
		speed = speed_max;
	}

	var movement = velocity.clone();
	movement.multiplyScalar(dt);
	position.add(movement);

	var collided_mask = 0;

	if (speed > 0)
	{
		var coord = func.coord(position);
		for (var x = coord.x - 1; x < coord.x + 2; x++)
		{
			if (x < 0 || x >= state.size.x)
				continue;
			for (var y = coord.y - 1; y < coord.y + 2; y++)
			{
				if (y < 0 || y >= state.size.y)
					continue;

				var cell = state.grid[x][y];
				if (cell.mask & mask)
				{
					// first check cardinal directions
					var collision_dir;
					var collision = false;
					if (velocity.x > 0 && func.collides(position.clone().add(con.collision_directions.right), x, y))
					{
						position.x = x - con.body_radius;
						velocity.x = 0;
						collided_mask |= cell.mask;
						collision = true;
						collision_dir = con.directions.right;
					}
					if (velocity.x < 0 && func.collides(position.clone().add(con.collision_directions.left), x, y))
					{
						position.x = x + 1 + con.body_radius;
						velocity.x = 0;
						collided_mask |= cell.mask;
						collision = true;
						collision_dir = con.directions.left;
					}
					if (velocity.y > 0 && func.collides(position.clone().add(con.collision_directions.forward), x, y))
					{
						position.y = y - con.body_radius;
						velocity.y = 0;
						collided_mask |= cell.mask;
						collision = true;
						collision_dir = con.directions.forward;
					}
					else if (velocity.y < 0 && func.collides(position.clone().add(con.collision_directions.backward), x, y))
					{
						position.y = y + 1 + con.body_radius;
						velocity.y = 0;
						collided_mask |= cell.mask;
						collision = true;
						collision_dir = con.directions.backward;
					}
					else
					{
						var corner_info = func.closest_corner(position, x, y);
						if (corner_info.distance < con.body_radius)
						{
							var corner_to_body_normalized = position.clone().sub(corner_info.corner);
							corner_to_body_normalized.normalize();

							var adjustment = corner_to_body_normalized.clone();
							adjustment.multiplyScalar(con.body_radius - corner_info.distance);
							position.add(adjustment);

							var penetration_velocity = velocity.dot(corner_to_body_normalized);
							corner_to_body_normalized.multiplyScalar(penetration_velocity);
							velocity.add(corner_to_body_normalized);

							collided_mask |= cell.mask;

							collision = true;
							var to_cell = new THREE.Vector2(x, y).sub(position);
							if (Math.abs(to_cell.x) > Math.abs(to_cell.y))
								collision_dir = to_cell.x < 0 ? con.directions.left : con.directions.right;
							else
								collision_dir = to_cell.y < 0 ? con.directions.backward : con.directions.forward;
						}
					}

					if (collision && tip_lights && (cell.mask & con.masks.light))
					{
						var light_model = state.light_models[cell.id];
						if (light_model.on)
						{
							// light takes up more cells now
							// first make sure nothing is in the way
							var new_cell_coord = new THREE.Vector2(x, y);
							var conflict = false;
							for (var j = 0; j < con.light_cell_size - 1; j++)
							{
								func.move_dir(new_cell_coord, collision_dir);
								if (new_cell_coord.x < 0 || new_cell_coord.x >= state.size.x
									|| new_cell_coord.y < 0 || new_cell_coord.y >= state.size.y
									|| state.grid[new_cell_coord.x][new_cell_coord.y].mask !== 0)
								{
									conflict = true;
									break;
								}
							}

							if (!conflict)
							{
								// knock it over
								func.audio(con.audio.light_tip);
								new_cell_coord.set(x, y);
								for (var j = 0; j < con.light_cell_size - 1; j++)
								{
									func.move_dir(new_cell_coord, collision_dir);

									var new_cell = state.grid[new_cell_coord.x][new_cell_coord.y];
									new_cell.mask = con.masks.light;
									new_cell.id = cell.id;
								}

								light_model.on = false;
								light_model.anim_time = 0;
								light_model.anim_dir = collision_dir;
							}
						}
					}
				}
			}
		}
	}
	return collided_mask;
};

func.monster_move = function(monster, speed, dt)
{
	if (monster.path.length > 0)
	{
		var cell = monster.path[0];
		var to_cell = cell.clone().add(new THREE.Vector2(0.5, 0.5)).sub(monster.pos);
		if (to_cell.length() < 0.25)
		{
			// move on to the next waypoint
			monster.path.splice(0, 1);
			func.monster_move(monster, speed, dt);
		}
		else
		{
			// keep moving toward cell
			to_cell.normalize();
			to_cell.multiplyScalar(speed);
			var collided_mask = func.move_body(monster.pos, to_cell, dt, speed, 0xffffff, false);
			if (collided_mask !== 0) // hit an obstacle; recalculate
				func.astar(monster.pos, monster.path[monster.path.length - 1], monster.path);
		}
	}
};

func.monster_check_attack = function(monster)
{
	if (state.player.alive && monster.pos.clone().sub(state.player.pos).length() < con.monster_attack_radius)
	{
		monster.state = con.monster_states.attack;
		monster.timer = con.monster_attack_delay;
		monster.path.length = 0;
		func.audio(con.audio.growl);
	}
};

func.cell_is_far_from_player = function(cell)
{
	return cell.clone().sub(state.player.pos).length() > 12;
};

func.cell_is_very_far_from_player = function(cell)
{
	return cell.clone().sub(state.player.pos).length() > 20;
};

func.gamepad = function()
{
	if (navigator.getGamepads)
	{
		var gamepads = navigator.getGamepads();
		if (gamepads.length > 0)
		{
			var gamepad = gamepads[0];
			if (gamepad && gamepad.connected)
				return gamepad;
		}
	}
	return null;
};

func.update = function()
{
	requestAnimationFrame(func.update);

	var dt = global.clock.getDelta();

	if (global.load_count < global.load_total)
	{
		graphics.load_bar.scale.x = con.load_bar_size.x * (global.load_count / global.load_total);
		graphics.load_bar.position.x = con.load_bar_size.x * -0.5 + (graphics.load_bar.scale.x * 0.5);
	}
	else
	{
		global.button_down = false;
		var gamepad = func.gamepad();
		if (gamepad)
		{
			for (var i = 0; i < gamepad.buttons.length; i++)
			{
				if (gamepad.buttons[i].pressed)
				{
					global.button_down = true;
					break;
				}
			}
		}

		global.level_timer += dt;

		// player
		if (state.player.damage_timer > 0)
			state.player.damage_timer -= dt;

		if (state.grid && state.player.alive)
		{
			// movement controls
			var player_velocity = new THREE.Vector2();

			// mouse controls
			if (global.mouse_down)
			{
				var view_proj = graphics.camera.projectionMatrix.clone();
				view_proj.multiply(graphics.camera.matrixWorldInverse);

				var inv_view_proj = new THREE.Matrix4();
				inv_view_proj.getInverse(view_proj);

				var mouse_x = (global.mouse.x / window.innerWidth) * 2.0 - 1.0;
				var mouse_y = (1.0 - (global.mouse.y / window.innerHeight)) * 2.0 - 1.0;
				var ray =
				[
					mouse_x, mouse_y, 0.0,
					mouse_x, mouse_y, 1.0,
				];

				inv_view_proj.applyToVector3Array(ray);

				// intersect with plane
				var ray_start = new THREE.Vector3(ray[0], ray[1], ray[2]);
				var ray_end = new THREE.Vector3(ray[3], ray[4], ray[5]);
				var d = ray_start.z / (ray_start.z - ray_end.z);

				var target = new THREE.Vector2
				(
					ray_start.x + (ray_end.x - ray_start.x) * d,
					ray_start.y + (ray_end.y - ray_start.y) * d
				);

				player_velocity.copy(target).sub(state.player.pos);
			}

			// gamepad controls
			if (gamepad)
			{
				var stick = new THREE.Vector2(gamepad.axes[0], -gamepad.axes[1]);
				if (stick.length() > 0.1)
					player_velocity.copy(stick).multiplyScalar(con.speed_max / Math.max(1, stick.length()));
			}

			// apply movement
			if (player_velocity.lengthSq() > 0)
			{
				graphics.player.rotation.z = -Math.atan2(player_velocity.x, player_velocity.y);

				var coin_multiplier = 0.6 + (0.4 * (con.max_capacity - state.player.coins.length) / con.max_capacity);
				var current_speed_max = con.speed_max * coin_multiplier;

				graphics.reticle.visible = true;
				graphics.reticle.position.y = Math.min(con.speed_max / con.speed_multiplier, Math.max(1, player_velocity.length()));

				player_velocity.multiplyScalar(con.speed_multiplier * coin_multiplier);
				var mask;
				if (state.bank_coins < state.door_coins)
					mask = 0xffffff; // collide with the door, don't go through it
				else
					mask = ~con.masks.door;

				var collided_mask = func.move_body(state.player.pos, player_velocity, dt, current_speed_max, mask, true);

				if ((collided_mask & con.masks.door) && state.player.coins.length > 0)
				{
					func.audio(con.audio.coins);
					state.bank_coins += state.player.coins.length;
					state.player.coins.length = 0;

					var spawn_point = func.random_goal(state.player.pos, 50, func.cell_is_very_far_from_player);
					if (spawn_point !== null)
					{
						func.monster_spawn(spawn_point);
						func.msg('+1 MONSTER');
					}
				}

				// footsteps
				var speed = player_velocity.length();
				if (speed > 0)
				{
					global.footstep_counter += Math.max(1, speed) * dt;
					if (global.footstep_counter > 1.5)
					{
						func.audio(con.audio.footstep, Math.max(0.1, (speed / current_speed_max) * 0.4));
						global.footstep_counter = 0;
					}
				}

				// door
				if (Math.floor(state.player.pos.x) === state.door.x
					&& Math.floor(state.player.pos.y) === state.door.y
					&& state.bank_coins >= state.door_coins)
				{
					state.level++;
					func.load_level(state.level);
				}
			}
			else
				graphics.reticle.visible = false;
		}

		graphics.player.position.set(state.player.pos.x, state.player.pos.y, 0);
		state.player.light = Math.max(0, state.player.light + dt * -0.0035);
		func.flicker_light(graphics.player_light, 0, state.player.light);

		// coins
		while (graphics.coins.length < state.coins.length)
			graphics.coins.push(func.add_mesh(graphics.geom.coin, 0xffff00));
		for (var i = 0; i < state.coins.length; i++)
		{
			var coin = state.coins[i];
			var graphic = graphics.coins[i];
			var diff = coin.pos.clone().sub(state.player.pos);
			if (coin.velocity.lengthSq() > 0)
			{
				// damp velocity
				var normalized = coin.velocity.clone();
				normalized.normalize();
				coin.velocity.sub(normalized.multiplyScalar(Math.min(dt * con.coin_velocity_damping, coin.velocity.length())));
				// move coin
				func.move_body(coin.pos, coin.velocity, dt, con.speed_max * 2, 0xffffff, false);
			}

			if (state.player.alive && diff.length() < 1)
			{
				if (state.player.coins.length < con.max_capacity && state.player.damage_timer <= 0)
				{
					func.audio(con.audio.coin);
					state.player.coins.push(
					{
						pos: coin.pos,
						anim_time: 0,
					});
					state.coins.splice(i, 1);
					i--;
				}
				else
				{
					// push coin around
					diff.normalize();
					var dot = player_velocity.dot(diff);
					if (dot > 0.0)
					{
						var coin_velocity = diff.clone();
						coin_velocity.multiplyScalar(dot);
						func.move_body(coin.pos, coin_velocity, dt);
						graphic.position.set(coin.pos.x, coin.pos.y, 0);
					}
				}
			}
			else
				graphic.position.set(coin.pos.x, coin.pos.y, 0);
		}
		while (graphics.coins.length > state.coins.length)
		{
			graphics.scene.remove(graphics.coins[graphics.coins.length - 1]);
			graphics.coins.length--;
		}

		// player coins
		while (graphics.player_coins.length < state.player.coins.length)
		{
			var coin = func.add_mesh(graphics.geom.coin, 0xffff00);
			graphics.player_coins.push(coin);
		}
		var coin_end_pos = new THREE.Vector3();
		for (var i = 0; i < state.player.coins.length; i++)
		{
			var coin = state.player.coins[i];
			var graphic = graphics.player_coins[i];
			coin_end_pos.set(state.player.pos.x, state.player.pos.y, 1 + i * 0.3);
			if (coin.anim_time < con.coin_flip_time)
			{
				coin.anim_time += dt;
				var blend = coin.anim_time / con.coin_flip_time;
				graphic.position.set(coin.pos.x, coin.pos.y, 0);
				graphic.position.lerp(coin_end_pos, blend);
				graphic.position.z += Math.sin(blend * Math.PI) * 2.0;
				graphic.rotation.set((1.0 - blend) * Math.PI * 4.0, 0, 0);
			}
			else
			{
				graphic.position.copy(coin_end_pos);
				graphic.rotation.set(0, 0, 0);
			}
		}
		while (graphics.player_coins.length > state.player.coins.length)
		{
			graphics.scene.remove(graphics.player_coins[graphics.player_coins.length - 1]);
			graphics.player_coins.length--;
		}

		// monsters
		var closest_monster = -1;
		for (var i = 0; i < state.monsters.length; i++)
		{
			var monster = state.monsters[i];
			var graphic = graphics.monsters[i];
			var distance = monster.pos.clone().sub(graphics.camera_pos).length();
			if (closest_monster < 0 || distance < closest_monster)
				closest_monster = distance;
			switch (monster.state)
			{
				case con.monster_states.normal: // wandering
					if (monster.path.length === 0)
					{
						monster.timer -= dt;
						if (monster.timer < 0.0)
						{
							func.astar(monster.pos, func.random_goal(monster.pos, 10), monster.path);
							monster.timer = 0.5 + Math.random() * 3.0;
						}
					}
					func.monster_move(monster, con.monster_normal_speed, dt);

					if (state.player.alive)
					{
						if (state.player.pos.clone().sub(monster.pos).length() < con.monster_detect_radius)
							monster.timer2 += dt;
						else
							monster.timer2 = 0;
						if (monster.timer2 > 1.0)
						{
							monster.state = con.monster_states.chase;
							monster.path.length = 0;
						}
					}
					else
						monster.timer2 = 0;

					func.monster_check_attack(monster);
					break;
				case con.monster_states.chase: // chasing the player
					monster.timer -= dt;
					if (monster.timer < 0 || monster.path.length === 0)
					{
						monster.timer = 0.5;
						if (state.player.alive && state.player.pos.clone().sub(monster.pos).length() < con.monster_chase_radius)
							func.astar(monster.pos, state.player.pos, monster.path); // update path
						else if (monster.path.length === 0)
						{
							// followed path, can't find them
							monster.state = con.monster_states.normal;
							monster.path.length = 0;
							monster.timer = 3.0;
						}
					}

					if (monster.path.length > 0)
					{
						func.monster_move(monster, con.monster_max_speed, dt);
						func.monster_check_attack(monster);
					}
					break;
				case con.monster_states.attack: // attacking the player
					var original_timer = monster.timer;
					monster.timer -= dt;
					if (monster.timer < 0)
					{
						if (original_timer >= 0.0)
						{
							// attack
							func.audio(con.audio.attack);
							if (state.player.alive && state.player.pos.clone().sub(monster.pos).length() < con.monster_damage_radius)
							{
								// hit; do damage
								if (state.player.coins.length > 0)
								{
									// take coins
									state.player.damage_timer = con.damage_time;
									for (var j = 0; j < state.player.coins.length; j++)
									{
										var pos = func.random_goal(state.player.pos, 2);
										state.coins.push(
										{
											pos: pos,
											velocity: pos.clone().sub(state.player.pos).multiplyScalar(4),
										});
									}
									state.player.coins.length = 0;
									func.audio(con.audio.coins);
								}
								else
								{
									// they're dead
									state.player.alive = false;
									func.msg('YOU DIED');
									monster.rotation = 0;
									monster.state = con.monster_states.normal;
									monster.path.length = 0;
									monster.timer = 3.0;
								}
							}
							else
							{
								// missed; keep chasing
							}
						}
						else if (monster.timer < -con.monster_post_attack_delay)
						{
							// attack is done
							monster.rotation = 0;
							monster.state = state.player.alive ? con.monster_states.chase : con.monster_states.normal;
							monster.timer = 0;
							monster.path.length = 0;
						}
					}
					break;
				case con.monster_states.alert: // checking out a noise
					if (state.player.alive && state.player.pos.clone().sub(monster.pos).length() < con.monster_detect_radius)
					{
						monster.state = con.monster_states.chase;
						monster.timer = 0;
						monster.path.length = 0;
					}
					else if (monster.path.length === 0)
					{
						monster.state = con.monster_states.normal;
						monster.timer = 3.0;
					}
					func.monster_move(monster, con.monster_max_speed, dt);
					func.monster_check_attack(monster);
					break;
				case con.monster_states.hide: // hiding from the player
					if (monster.path.length === 0)
					{
						// done hiding
						monster.state = con.monster_states.normal;
						monster.timer = 3.0;
					}
					else
						func.monster_move(monster, con.monster_max_speed, dt);
					break;
			}
			graphic.position.set(monster.pos.x, monster.pos.y, 0);
			if (monster.state === con.monster_states.attack)
			{
				if (monster.timer > 0)
					graphic.rotation.z = 0;
				else
					graphic.rotation.z = (monster.timer / -con.monster_post_attack_delay) * Math.PI * 2.0;
				graphic.scale.set(con.monster_damage_radius / 0.77, con.monster_damage_radius / 0.77, 1);
			}
			else
			{
				graphic.rotation.z = 0;
				graphic.scale.set(1, 1, 1);
			}
		}
		if (closest_monster > 0)
			global.monster_loop_gain.gain.value = Math.max(0, 0.25 * (1.0 - (closest_monster / (con.camera_size * 0.75))));
		else
			global.monster_loop_gain.gain.value = 0.0;

		// door text
		if (graphics.door
			&& (graphics.door_text.bank_coins !== state.bank_coins || graphics.door_text.door_coins !== state.door_coins))
			func.refresh_door_text();

		// lights
		for (var i = 0; i < state.light_models.length; i++)
		{
			var light_model = state.light_models[i];
			var graphic = graphics.light_models[i];

			if (light_model.on)
			{
				var glares = graphic.children[0];
				glares.material.color.copy(con.glare_color);
				glares.material.color.multiplyScalar(func.flicker(i, 0.05));
			}

			if (light_model.anim_time < con.light_tip_time)
			{
				light_model.anim_time = Math.min(light_model.anim_time + dt, con.light_tip_time);
				var blend = light_model.anim_time / con.light_tip_time;
				// rotate the model
				switch (light_model.anim_dir)
				{
					case con.directions.right:
						graphic.rotation.set(0, Math.PI * 0.5 * blend, 0);
						break;
					case con.directions.left:
						graphic.rotation.set(0, Math.PI * -0.5 * blend, 0);
						break;
					case con.directions.forward:
						graphic.rotation.set(Math.PI * -0.5 * blend, 0, 0);
						break;
					case con.directions.backward:
						graphic.rotation.set(Math.PI * 0.5 * blend, 0, 0);
						break;
				}
				if (blend == 1.0)
				{
					// kill the light
					var point_light = graphic.children[1];
					point_light.color.set(0, 0, 0);
					var glares = graphic.children[0];
					graphic.remove(glares);

					// alert any monsters nearby
					for (var j = 0; j < state.monsters.length; j++)
					{
						var monster = state.monsters[j];
						var distance = monster.pos.clone().sub(light_model.pos).length();
						if (distance < con.monster_scare_radius)
						{
							// run away
							var path = [];
							func.astar(monster.pos, func.random_goal(light_model.pos, 30, func.cell_is_far_from_player), path);
							if (path.length > 0)
							{
								func.audio(con.audio.whimper, 1.0, 10.0);
								monster.state = con.monster_states.hide;
								monster.path = path;
							}
						}
						else if (monster.state === con.monster_states.normal && distance < con.monster_alert_radius)
						{
							var path = [];
							func.astar(monster.pos, func.random_goal(light_model.pos, 2), path);
							if (path.length > 0)
							{
								func.audio(con.audio.howl, 1.0, 10.0);
								monster.state = con.monster_states.alert;
								monster.path = path;
							}
						}
					}
				}
			}
		}

		// camera
		if (state.player.alive)
			graphics.camera_pos_target.copy(state.player.pos);

		graphics.camera_pos.lerp(graphics.camera_pos_target, dt * 10.0);
		graphics.camera.position.set(graphics.camera_pos.x, graphics.camera_pos.y, 0).add(con.camera_offset);

		// lights
		for (var i = 0; i < graphics.flicker_lights.length; i++)
			func.flicker_light(graphics.flicker_lights[i], i);
		
		// ui
		if (graphics.msg_timer > 0)
		{
			graphics.msg_timer -= dt;
			if (state.player.alive && graphics.msg_timer <= 0)
			{
				graphics.ui.remove(graphics.msg);
				graphics.msg = null;
			}
		}
		else if (!state.player.alive &&
			((global.mouse_down && !global.last_mouse_down) || (global.button_down && !global.last_button_down)))
		{
			// player is dead, msg timer is up, and player is clicking
			// time to transition levels
			if (state.level === 0) // title
				func.load_level(1); // start the game
			else if (state.level === con.level_names.length - 1) // last level
				func.load_level(0); // start over
			else
				func.load_level(state.level); // reload level
		}

		// player model visibility
		if (state.player.alive)
		{
			if (state.player.damage_timer <= 0)
				graphics.player.visible = true;
			else
				graphics.player.visible = state.player.damage_timer % 0.1 < 0.05;
		}
		else
			graphics.player.visible = false;

		global.last_mouse_down = global.mouse_down;
		global.last_button_down = global.button_down;

		// overlay
		if (global.level_timer < con.fade_time)
		{
			graphics.overlay.visible = true;
			graphics.overlay.scale.set(graphics.camera.right - graphics.camera.left, graphics.camera.top - graphics.camera.bottom, 1);
			graphics.overlay.material.opacity = 1.0 - (global.level_timer / con.fade_time);
		}
		else
			graphics.overlay.visible = false;
	}

	graphics.ui.position.copy(graphics.camera.position).add(con.camera_offset.clone().multiplyScalar(-0.1));

	// update projection matrix
	{
		var min_size = window.innerWidth < window.innerHeight ? window.innerWidth : window.innerHeight;
		var zoom = con.camera_size / min_size;

		if (graphics.logo)
		{
			var aspect = graphics.texture.logo.image.width / graphics.texture.logo.image.height;
			graphics.logo.scale.set(0.01 * aspect * min_size, 0.01 * min_size, 1);
		}
	}

	graphics.camera.left = -0.5 * window.innerWidth * zoom;
	graphics.camera.right = 0.5 * window.innerWidth * zoom;
	graphics.camera.top = 0.5 * window.innerHeight * zoom;
	graphics.camera.bottom = -0.5 * window.innerHeight * zoom;
	graphics.camera.updateProjectionMatrix();

	// render
	graphics.renderer.render(graphics.scene, graphics.camera);
};

func.on_resize = function()
{
	graphics.renderer.setSize(window.innerWidth, window.innerHeight);
};

$(document).ready(function()
{
	func.init();
});
