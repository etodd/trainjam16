'use strict';

// constants
var con =
{
	camera_offset: new THREE.Vector3(),
	camera_size: 15.0,
	coin_flip_time: 0.5,
	light_tip_time: 0.25,
	light_cell_size: 3,
	collision_directions:
	{
		right: new THREE.Vector2(0.5, 0),
		left: new THREE.Vector2(-0.5, 0),
		forward: new THREE.Vector2(0, 0.5),
		backward: new THREE.Vector2(0, -0.5),
	},
	directions:
	{
		right: 0,
		left: 1,
		forward: 2,
		backward: 3,
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
	codes:
	{
		wall: [0, 0, 0],
		light: [255, 0, 0],
		coin: [0, 255, 0],
		player: [255, 255, 0],
		door: [0, 255, 255],
	},
	speed_multiplier: 1.0,
	speed_max: 5,
};

var state =
{
	level: 0,
	grid: null,
	size: new THREE.Vector2(),
	door: new THREE.Vector2(),
	door_coins: 1,
	bank_coins: 0,
	coins: [],
	light_models: [],
	player:
	{
		pos: new THREE.Vector2(),
		coins: [],
		light: 1,
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
	flicker_lights: [],
	light_models: [],
	coins: [],
	player_coins: [],
	camera_pos: new THREE.Vector2(),
	camera_pos_target: new THREE.Vector2(2, 10),
	ground: null,
	player: null,
	player_light: null,
	levels: [],
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
		door: null,
	},
};

var global =
{
	clock: new THREE.Clock(),
	mouse: new THREE.Vector2(),
	mouse_down: false,
};

// Three.js extensions

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
	graphics.player_light.position.set(0, 0, 1.5);
	graphics.player.add(graphics.player_light);

	func.load_level(state.level);

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
	state.player.coins.length = 0;
	state.player.light = 1;
	state.grid = null;
	state.coins.length = 0;
	state.bank_coins = 0;

	graphics.light_models.length = 0;

	if (graphics.ground)
	{
		graphics.scene.remove(graphics.ground);
		graphics.ground = null;
	}

	for (var i = 0; i < graphics.scenery.length; i++)
		graphics.scene.remove(graphics.scenery[i]);
	graphics.scenery.length = 0;

	graphics.flicker_lights.length = 0;

	// load new stuff
	state.level = level;

	if (graphics.levels[state.level])
		func.parse_level_texture(graphics.levels[state.level]);
	else
	{
		graphics.texture_loader.load
		(
			'lvl/' + state.level + '.png',
			func.parse_level_texture,
			func.error
		);
	}
};

func.parse_level_texture = function(texture)
{
	graphics.levels[state.level] = texture;

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

				var point_light = new THREE.PointLight(0xdd9977, 1, 5);
				point_light.position.set(0, 0, 3.0);
				graphics.flicker_lights.push(point_light);
				light.add(point_light);

			}
			else if (pixel_equals(offset, con.codes.player))
				state.player.pos.copy(pos);
			else if (canvas_data.data[offset] < 255
				&& canvas_data.data[offset + 1] === con.codes.door[1]
				&& canvas_data.data[offset + 2] === con.codes.door[2])
			{
				var door = func.add_mesh(graphics.geom.door, 0xcccc44);
				graphics.scenery.push(door);
				door.position.set(pos.x, pos.y, 0);

				state.door.set(x, y);
				state.door_coins = canvas_data.data[offset];

				var point_light = new THREE.PointLight(0xffffff, 1, 5);
				point_light.position.set(0, 0, 3.0);
				door.add(point_light);
				grid_value.mask = con.masks.door;
			}
			else if (pixel_equals(offset, con.codes.coin))
			{
				state.coins.push(
				{
					pos: pos.clone(),
					anim_time: con.coin_flip_time,
				});
			}
			state.grid[x][y] = grid_value;
		}
	}

	graphics.texture.floor.wrapS = THREE.RepeatWrapping;
	graphics.texture.floor.wrapT = THREE.RepeatWrapping;
	graphics.ground = func.add_mesh(new THREE.FloorGeometry(state.size.x, state.size.y), 0xffddcc);
	graphics.ground.material.map = graphics.texture.floor;
	
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

func.flicker_light = function(light, i, scale)
{
	if (typeof scale === 'undefined')
		scale = 1.0;
	var intensity = light.intensity = scale * (0.98 + Math.sin((global.clock.getElapsedTime() + i) * 40.0) * 0.02);
	light.distance = 5.0 * intensity;
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
	}
};

func.move_body = function(position, velocity, dt, speed_max, mask)
{
	if (typeof speed_max === 'undefined')
		speed_max = con.speed_max;
	if (typeof mask === 'undefined')
		mask = 0xffffff;
	
	var movement = velocity.clone();
	movement.multiplyScalar(dt);
	position.add(movement);

	var collided_mask = 0;

	var speed = velocity.length();
	if (speed > 0)
	{
		if (speed > speed_max)
		{
			velocity.multiplyScalar(con.speed_max / speed);
			speed = speed_max;
		}

		var coord_x = Math.floor(position.x);
		var coord_y = Math.floor(position.y);
		for (var x = coord_x - 1; x < coord_x + 2; x++)
		{
			for (var y = coord_y - 1; y < coord_y + 2; y++)
			{
				var cell = state.grid[x][y];
				if (x >= 0 && x < state.size.x
					&& y >= 0 && y < state.size.y
					&& (cell.mask & mask))
				{
					// first check cardinal directions
					var collision_dir;
					var collision = false;
					if (func.collides(position.clone().add(con.collision_directions.right), x, y))
					{
						position.x = x - 0.5;
						velocity.x = Math.min(velocity.x, 0);
						collided_mask |= cell.mask;
						collision = true;
						collision_dir = con.directions.right;
					}
					else if (func.collides(position.clone().add(con.collision_directions.left), x, y))
					{
						position.x = x + 1.5;
						velocity.x = Math.max(velocity.x, 0);
						collided_mask |= cell.mask;
						collision = true;
						collision_dir = con.directions.left;
					}
					else if (func.collides(position.clone().add(con.collision_directions.forward), x, y))
					{
						position.y = y - 0.5;
						velocity.y = Math.min(velocity.y, 0);
						collided_mask |= cell.mask;
						collision = true;
						collision_dir = con.directions.forward;
					}
					else if (func.collides(position.clone().add(con.collision_directions.backward), x, y))
					{
						position.y = y + 1.5;
						velocity.y = Math.max(velocity.y, 0);
						collided_mask |= cell.mask;
						collision = true;
						collision_dir = con.directions.backward;
					}
					else
					{
						var corner_info = func.closest_corner(position, x, y);
						if (corner_info.distance < 0.5)
						{
							var corner_to_body_normalized = position.clone().sub(corner_info.corner);
							corner_to_body_normalized.normalize();

							var adjustment = corner_to_body_normalized.clone();
							adjustment.multiplyScalar(0.5 - corner_info.distance);
							position.add(adjustment);

							var penetration_velocity = velocity.dot(corner_to_body_normalized);
							corner_to_body_normalized.multiplyScalar(penetration_velocity);
							velocity.add(corner_to_body_normalized);

							collided_mask |= cell.mask;
						}
					}

					if (collision && (cell.mask & con.masks.light))
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

		var new_speed = velocity.length();
		if (new_speed > 1.0)
		{
			velocity.multiplyScalar(speed / new_speed);
			var final_velocity = velocity.clone();
			final_velocity.multiplyScalar(dt);
			position.add(final_velocity);
		}
	}
	return collided_mask;
};

func.update = function()
{
	requestAnimationFrame(func.update);

	var dt = global.clock.getDelta();

	// player
	var player_velocity = new THREE.Vector2();
	if (state.grid && global.mouse_down)
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

		player_velocity.set(target_x - state.player.pos.x, target_y - state.player.pos.y);
		graphics.player.rotation.z = -Math.atan2(player_velocity.x, player_velocity.y);
		var coin_multiplier = 0.5 + (0.5 * (con.max_capacity - state.player.coins.length) / con.max_capacity);
		player_velocity.multiplyScalar(con.speed_multiplier * coin_multiplier);
		var mask;
		if (state.bank_coins < state.door_coins)
			mask = 0xffffff; // collide with the door, don't go through it
		else
			mask = ~con.masks.door;
		var collided_mask = func.move_body(state.player.pos, player_velocity, dt, con.speed_max * coin_multiplier, mask);
		if (collided_mask & con.masks.door)
		{
			state.bank_coins += state.player.coins.length;
			state.player.coins.length = 0;
		}

		if (Math.floor(state.player.pos.x) === state.door.x
			&& Math.floor(state.player.pos.y) === state.door.y
			&& state.bank_coins >= state.door_coins)
		{
			state.level++;
			func.load_level(state.level);
		}
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
		var diff = coin.pos.clone().sub(state.player.pos);
		if (diff.length() < 1)
		{
			if (state.player.coins.length < con.max_capacity)
			{
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
				var coin_velocity = diff.clone();
				diff.normalize();
				var dot = player_velocity.dot(diff);
				if (dot > 0.0)
				{
					coin_velocity.multiplyScalar(dot);
					func.move_body(coin.pos, coin_velocity, dt);
					graphics.coins[i].position.set(coin.pos.x, coin.pos.y, 0);
				}
			}
		}
		else
			graphics.coins[i].position.set(coin.pos.x, coin.pos.y, 0);
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

	// lights
	for (var i = 0; i < state.light_models.length; i++)
	{
		var light_model = state.light_models[i];
		if (light_model.anim_time < con.light_tip_time)
		{
			light_model.anim_time = Math.min(light_model.anim_time + dt, con.light_tip_time);
			var blend = light_model.anim_time / con.light_tip_time;
			var graphic = graphics.light_models[i];
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
				var point_light = graphic.children[0];
				graphic.remove(point_light);
			}
		}
	}

	// camera
	graphics.camera_pos_target.copy(state.player.pos);
	graphics.camera_pos.lerp(graphics.camera_pos_target, dt * 10.0);
	graphics.camera.position.set(graphics.camera_pos.x, graphics.camera_pos.y, 0).add(con.camera_offset);
	func.update_projection();

	// lights
	for (var i = 0; i < graphics.flicker_lights.length; i++)
		func.flicker_light(graphics.flicker_lights[i], i);

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
