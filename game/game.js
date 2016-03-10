'use strict';

// state

var constants =
{
	max_camera_size: 25.0,
	camera_offset: new THREE.Vector3(),
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
	meshes: [],
	camera_size: 1.0,
	camera_size_target: 0,
	camera_pos: new THREE.Vector2(),
	camera_pos_target: new THREE.Vector2(),
	sunlight: null,
	geom:
	{
		chandelier: null,
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
};

// procedures

var funcs = {};

funcs.init = function()
{
	global.clock.start();

	window.addEventListener('resize', funcs.on_resize, false);

	graphics.scene = new THREE.Scene();

	graphics.camera = new THREE.OrthographicCamera
	(
		-1,
		1,
		1,
		-1,
		0.1, constants.max_camera_size * 4
	);
	graphics.camera.rotation.x = Math.PI * 0.2;
	graphics.camera.rotation.y = Math.PI * 0.08;
	graphics.camera.rotation.z = Math.PI * 0.08;
	constants.camera_offset = graphics.camera.getWorldDirection().multiplyScalar(-constants.max_camera_size * 2.0);

	{
		var hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
		hemiLight.color.setHSL(0.6, 1, 0.6);
		hemiLight.groundColor.setHSL(0.095, 1, 0.75);
		hemiLight.position.set(0, 500, 0);
		graphics.scene.add(hemiLight);
	}

	{
		graphics.sunlight = new THREE.DirectionalLight(0xffffff, 1);
		graphics.sunlight.color.setHSL(0.1, 1, 0.95);
		graphics.sunlight.position.set(1, 0.5, 1.75);
		graphics.sunlight.position.multiplyScalar(50);
		graphics.scene.add(graphics.sunlight);

		graphics.sunlight.castShadow = true;

		graphics.sunlight.shadow.mapSize.width = 2048;
		graphics.sunlight.shadow.mapSize.height = 2048;

		graphics.sunlight.shadow.camera.far = constants.max_camera_size * 5.0;
		graphics.sunlight.shadow.bias = -0.001;
	}

	graphics.renderer = new THREE.WebGLRenderer({ antialias: true });
	graphics.renderer.setSize(window.innerWidth, window.innerHeight);

	graphics.renderer.gammaInput = true;
	graphics.renderer.gammaOutput = true;

	graphics.renderer.shadowMap.enabled = true;
	graphics.renderer.shadowMap.cullFace = THREE.CullFaceBack;
	graphics.renderer.shadowMap.type = THREE.PCFShadowMap;
	graphics.renderer.setClearColor(0xccddff);
	graphics.renderer.setPixelRatio(window.devicePixelRatio);

	document.body.appendChild(graphics.renderer.domElement);

	funcs.on_resize();

	for (var geom_name in graphics.geom)
	{
		let local_geom_name = geom_name;
		graphics.model_loader.load('geom/' + geom_name + '.js', function(geometry, materials)
		{
			graphics.geom[local_geom_name] = geometry;
			funcs.check_done_loading();
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
				funcs.check_done_loading();
			},
			funcs.error
		);
	}

};

funcs.check_done_loading = function()
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

	$(window).on('resize', funcs.on_resize);

	window.focus();
	$(document).on('keydown', funcs.on_keydown);
	$(document).on('keyup', funcs.on_keyup);

	$(document).on('mousedown', funcs.on_mousedown);
	$(document).on('mousemove', funcs.on_mousemove);
	$(document).on('mouseup', funcs.on_mouseup);
	$(document).on('touchstart', funcs.on_mousedown);
	$(document).on('touchmove', funcs.on_mousemove);
	$(document).on('touchend', funcs.on_mouseup);

	graphics.camera_pos.copy(graphics.camera_pos_target);
	graphics.camera_size = graphics.camera_size_target;

	funcs.animate();

	return true;
};

funcs.on_mousedown = function(event)
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

funcs.on_mousemove = function(event)
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

funcs.on_mouseup = function(event)
{
	global.swipe_pos.sub(global.swipe_start);
	if (global.swipe_pos.length() > 10.0)
		funcs.move((2 + Math.round((Math.atan2(global.swipe_pos.x, -global.swipe_pos.y) - graphics.camera.rotation.y) / (Math.PI * 0.5))) % 4);
	global.mouse_down = false;
	event.preventDefault();
};

funcs.create_value_text = function(value, parent)
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
	var text = funcs.add_mesh(text_geometry, 0xffffff, null, parent);
	text_geometry.computeBoundingBox();
	text.position.z = 0.5;
	text.position.x = -0.05 - 0.5 * (text_geometry.boundingBox.max.x - text_geometry.boundingBox.min.x);
	text.position.y = -0.5 * (text_geometry.boundingBox.max.y - text_geometry.boundingBox.min.y);
	text.value = value;
	return text;
};

funcs.load_level = function(level)
{
	for (var i = 0; i < graphics.meshes.length; i++)
		graphics.scene.remove(graphics.meshes[i]);
	graphics.meshes.length = 0;

	// load new stuff

	graphics.ground = funcs.add_mesh(new THREE.PlaneBufferGeometry(1, 1), 0xffddcc);
	graphics.texture_loader.load
	(
		'lvl' + level.difficulty + 'B.png',
		function(texture)
		{
			texture.minFilter = texture.magFilter = THREE.NearestFilter;
			graphics.ground.material.needsUpdate = true;
		},
		funcs.error
	);
	
	graphics.ground.scale.set(state.size.x, state.size.y, 1);
	graphics.ground.position.set(state.size.x * 0.5 - 0.5, state.size.y * 0.5 - 0.5, 0);

	graphics.camera_pos.copy(graphics.camera_pos_target);
	graphics.camera_size = graphics.camera_size_target;
};

funcs.add_mesh = function(geometry, color, materials, parent)
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

funcs.animate = function()
{
	requestAnimationFrame(funcs.animate);

	var dt = global.clock.getDelta();

	graphics.camera_pos.lerp(graphics.camera_pos_target, dt * 10.0);

	graphics.camera_size = graphics.camera_size < graphics.camera_size_target
		? Math.min(graphics.camera_size_target, graphics.camera_size + dt * 10.0)
		: Math.max(graphics.camera_size_target, graphics.camera_size - dt * 10.0);

	graphics.camera.position.set(graphics.camera_pos.x, graphics.camera_pos.y, 0).add(constants.camera_offset);

	funcs.update_projection();

	graphics.renderer.render(graphics.scene, graphics.camera);
};

funcs.on_resize = function()
{
	graphics.renderer.setSize(window.innerWidth, window.innerHeight);
};

funcs.update_projection = function()
{
	var min_size = window.innerWidth < window.innerHeight ? window.innerWidth : window.innerHeight;
	var zoom = graphics.camera_size / min_size;
	graphics.camera.left = -0.5 * window.innerWidth * zoom;
	graphics.camera.right = 0.5 * window.innerWidth * zoom;
	graphics.camera.top = 0.5 * window.innerHeight * zoom;
	graphics.camera.bottom = -0.5 * window.innerHeight * zoom;
	graphics.camera.updateProjectionMatrix();
};

funcs.update_camera_target = function(pos)
{
	graphics.camera_pos_target.copy(pos);
	
	var size = Math.max(state.size.x, state.size.y);
	graphics.camera_size_target = Math.min(size, constants.max_camera_size);

	var d = constants.max_camera_size * 1.5;

	graphics.sunlight.shadow.camera.left = graphics.camera_pos_target.x - d;
	graphics.sunlight.shadow.camera.right = graphics.camera_pos_target.x + d;
	graphics.sunlight.shadow.camera.top = graphics.camera_pos_target.y + d;
	graphics.sunlight.shadow.camera.bottom = graphics.camera_pos_target.y - d;
	graphics.sunlight.shadow.camera.updateProjectionMatrix();
};

$(document).ready(function()
{
	funcs.init();
});
