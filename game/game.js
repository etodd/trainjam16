'use strict';

// constants
var con =
{
	camera_offset: new THREE.Vector3(),
	camera_size: 20.0,
	codes:
	{
		wall: [0, 0, 0, 255],
		light: [255, 0, 0, 255],
		coin: [0, 255, 0, 255],
		player: [255, 255, 0, 255],
	},
	speed_multiplier: 1.0,
	speed_max: 3,
};

var state =
{
	level: 0,
	grid: null,
	size: new THREE.Vector2(),
	player:
	{
		pos: new THREE.Vector2(),
		coins: 0,
	},
};

var graphics =
{
	texture_loader: new THREE.TextureLoader(),
	model_loader: new THREE.JSONLoader(),
	scene: null,
	camera: null,
	renderer: null,
	scenery: [],
	lights: [],
	camera_pos: new THREE.Vector2(),
	camera_pos_target: new THREE.Vector2(2, 10),
	ground: null,
	player: null,
	player_light: null,
	geom:
	{
		light: null,
		player: null,
		monster: null,
		wall: null,
	},
	texture:
	{
		floor: null,
		wall: null,
		door: null,
	},
};

var global =
{
	clock: new THREE.Clock(),
	mouse: new THREE.Vector2(),
	mouse_down: false,
	last_mouse_down: false,
};

// Three.js extensions

THREE.FloorGeometry = function(width, height)
{
	THREE.BufferGeometry.call(this);

	this.type = 'FloorGeometry';

	this.parameters = {
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

// procedures

var func = {};

func.init = function()
{
	global.clock.start();

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

	graphics.renderer = new THREE.WebGLRenderer({ antialias: true });
	graphics.renderer.setSize(window.innerWidth, window.innerHeight);

	graphics.renderer.gammaInput = true;
	graphics.renderer.gammaOutput = true;

	graphics.renderer.setClearColor(0x000000);
	graphics.renderer.setPixelRatio(window.devicePixelRatio);

	document.body.appendChild(graphics.renderer.domElement);

	func.on_resize();

	for (var geom_name in graphics.geom)
	{
		let local_geom_name = geom_name;
		graphics.model_loader.load('geom/' + geom_name + '.js', function(geometry, materials)
		{
			graphics.geom[local_geom_name] = geometry;
			func.check_done_loading();
		});
	}

	for (var texture_name in graphics.texture)
	{
		let local_texture_name = texture_name;
		graphics.texture_loader.load
		(
			'texture/' + texture_name + '.png',
			function(texture)
			{
				texture.minFilter = texture.magFilter = THREE.NearestFilter;
				graphics.texture[local_texture_name] = texture;
				func.check_done_loading();
			},
			func.error
		);
	}
};

func.check_done_loading = function()
{
	for (var name in graphics.geom)
	{
		if (!graphics.geom[name])
			return false;
	}

	for (var name in graphics.texture)
	{
		if (!graphics.texture[name])
			return false;
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

	graphics.player = func.add_mesh(graphics.geom.player, 0xff0000);
	graphics.player_light = new THREE.PointLight(0xaa3311, 1, 5);
	graphics.scene.add(graphics.player_light);

	func.load_level(0);

	func.update();

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

func.create_value_text = function(value, parent)
{
	var value_string = Math.pow(2, value).toString();
	var scale = value_string.length === 1 ? 1.0 : 1.5 / value_string.length;
	var text_geometry = new THREE.TextGeometry(value_string,
	{
		size: 0.6 * scale,
		height: 0.1,
		curveSegments: 2,

		font: 'helvetiker',
		weight: 'bold',
		style: 'normal',

		bevelThickness: 0,
		bevelSize: 0,
		bevelEnabled: false,

		material: 0,
		extrudeMaterial: 0
	});
	var text = func.add_mesh(text_geometry, 0xffffff, null, parent);
	text_geometry.computeBoundingBox();
	text.position.z = 0.5;
	text.position.x = -0.05 - 0.5 * (text_geometry.boundingBox.max.x - text_geometry.boundingBox.min.x);
	text.position.y = -0.5 * (text_geometry.boundingBox.max.y - text_geometry.boundingBox.min.y);
	text.value = value;
	return text;
};

func.load_level = function(level)
{
	// unload old stuff
	if (graphics.ground)
	{
		graphics.scene.remove(graphics.ground);
		graphics.ground = null;
	}

	for (var i = 0; i < graphics.scenery.length; i++)
		graphics.scene.remove(graphics.scenery[i]);
	graphics.scenery.length = 0;

	for (var i = 0; i < graphics.lights.length; i++)
		graphics.scene.remove(graphics.lights[i]);
	graphics.lights.length = 0;

	// load new stuff
	state.level = level;
	state.player.coins = 0;

	graphics.texture_loader.load
	(
		'lvl/' + state.level + '.png',
		function(texture)
		{
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
					&& canvas_data.data[offset + 2] === color[2]
					&& canvas_data.data[offset + 3] === color[3];
			};

			for (var x = 0; x < state.size.x; x++)
			{
				for (var y = 0; y < state.size.y; y++)
				{
					var grid_value = false;
					var offset = (x + (y * state.size.x)) * 4;
					if (pixel_equals(offset, con.codes.wall))
					{
						var wall = func.add_mesh(graphics.geom.wall, 0xffffff);
						wall.material.map = graphics.texture.wall;
						graphics.scenery.push(wall);
						wall.position.x = x + 0.5;
						wall.position.y = (state.size.y - y) + 0.5;
						grid_value = true;
					}
					else if (pixel_equals(offset, con.codes.light))
					{
						var light = func.add_mesh(graphics.geom.light, 0xcccc44);
						graphics.scenery.push(light);
						light.position.set(x + 0.5, (state.size.y - y) + 0.5, 0);

						var point_light = new THREE.PointLight(0xdd9977, 1, 5);
						point_light.position.set(light.position.x, light.position.y, 3.0);
						graphics.lights.push(point_light);
						graphics.scene.add(point_light);
						grid_value = true;
					}
					else if (pixel_equals(offset, con.codes.player))
					{
						state.player.pos.x = x;
						state.player.pos.y = state.size.y - y;
					}
					state.grid[x][state.size.y - y] = grid_value;
				}
			}

			graphics.texture.floor.wrapS = THREE.RepeatWrapping;
			graphics.texture.floor.wrapT = THREE.RepeatWrapping;
			graphics.ground = func.add_mesh(new THREE.FloorGeometry(state.size.x, state.size.y), 0xffddcc);
			graphics.ground.material.map = graphics.texture.floor;
		},
		func.error
	);
	
	graphics.camera_pos_target.copy(state.player.pos);
	graphics.camera_pos.copy(graphics.camera_pos_target);
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

func.flicker_light = function(light, i)
{
	var intensity = light.intensity = 0.98 + Math.sin((global.clock.getElapsedTime() + i) * 40.0) * 0.02;
	light.distance = 5.0 * intensity;
};

func.collides = function(pos, x, y)
{
	return pos.x > x && pos.x < x + 1
		&& pos.y > y && pos.y < y + 1
};

func.closest_corner = function(pos, x, y)
{
	var closest_distance = 1000;
	var closest_corner = new THREE.Vector2();
	for (var _x = x; _x < x + 2; _x++)
	{
		for (var _y = y; _y < y + 2; _y++)
		{
			var distance = new THREE.Vector2(_x, _y).sub(pos).length();
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

func.update = function()
{
	requestAnimationFrame(func.update);

	var dt = global.clock.getDelta();

	// player
	graphics.player.position.set(state.player.pos.x, state.player.pos.y, 0);
	graphics.player_light.position.set(state.player.pos.x + 0.5, state.player.pos.y - 0.5, 1.5);
	func.flicker_light(graphics.player_light, 0);

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

		var target_x = ray_start.x + (ray_end.x - ray_start.x) * d;
		var target_y = ray_start.y + (ray_end.y - ray_start.y) * d;

		var velocity = new THREE.Vector2(target_x - state.player.pos.x, target_y - state.player.pos.y);
		velocity.multiplyScalar(con.speed_multiplier);
		var speed = velocity.length();
		if (speed > 0)
		{
			if (speed > con.speed_max)
			{
				velocity.multiplyScalar(con.speed_max / speed);
				speed = con.speed_max;
			}

			var player_coord_x = Math.floor(state.player.pos.x);
			var player_coord_y = Math.floor(state.player.pos.y);
			for (var x = player_coord_x - 1; x < player_coord_x + 2; x++)
			{
				for (var y = player_coord_y - 1; y < player_coord_y + 2; y++)
				{
					if (state.grid[x][y])
					{
						// first check cardinal directions
						if (func.collides(state.player.pos.clone().add(new THREE.Vector2(0.5, 0)), x, y))
						{
							state.player.pos.x = x - 0.5;
							velocity.x = Math.min(velocity.x, 0);
						}
						else if (func.collides(state.player.pos.clone().add(new THREE.Vector2(-0.5, 0)), x, y))
						{
							state.player.pos.x = x + 1.5;
							velocity.x = Math.max(velocity.x, 0);
						}
						else if (func.collides(state.player.pos.clone().add(new THREE.Vector2(0, 0.5)), x, y))
						{
							state.player.pos.y = y - 0.5;
							velocity.y = Math.min(velocity.y, 0);
						}
						else if (func.collides(state.player.pos.clone().add(new THREE.Vector2(0, -0.5)), x, y))
						{
							state.player.pos.y = y + 1.5;
							velocity.y = Math.max(velocity.y, 0);
						}
						else
						{
							var corner_info = func.closest_corner(state.player.pos, x, y);
							if (corner_info.distance < 0.5)
							{
								var corner_to_player_normalized = state.player.pos.clone().sub(corner_info.corner);
								corner_to_player_normalized.normalize();

								var adjustment = corner_to_player_normalized.clone();
								adjustment.multiplyScalar(0.5 - corner_info.distance);
								state.player.pos.add(adjustment);

								var penetration_velocity = velocity.dot(corner_to_player_normalized);
								corner_to_player_normalized.multiplyScalar(penetration_velocity);
								velocity.add(corner_to_player_normalized);
							}
						}
					}
				}
			}

			var new_speed = velocity.length();
			if (new_speed > 0.0)
			{
				velocity.multiplyScalar(dt * (speed / new_speed));
				state.player.pos.add(velocity);
			}
		}
	}

	global.last_mouse_down = global.mouse_down;

	// camera
	graphics.camera_pos_target.copy(state.player.pos);
	graphics.camera_pos.lerp(graphics.camera_pos_target, dt * 10.0);
	graphics.camera.position.set(graphics.camera_pos.x, graphics.camera_pos.y, 0).add(con.camera_offset);
	func.update_projection();

	// lights
	for (var i = 0; i < graphics.lights.length; i++)
		func.flicker_light(graphics.lights[i], i);

	// render
	graphics.renderer.render(graphics.scene, graphics.camera);
};

func.on_resize = function()
{
	graphics.renderer.setSize(window.innerWidth, window.innerHeight);
};

func.update_projection = function()
{
	var min_size = window.innerWidth < window.innerHeight ? window.innerWidth : window.innerHeight;
	var zoom = con.camera_size / min_size;
	graphics.camera.left = -0.5 * window.innerWidth * zoom;
	graphics.camera.right = 0.5 * window.innerWidth * zoom;
	graphics.camera.top = 0.5 * window.innerHeight * zoom;
	graphics.camera.bottom = -0.5 * window.innerHeight * zoom;
	graphics.camera.updateProjectionMatrix();
};

$(document).ready(function()
{
	func.init();
});
