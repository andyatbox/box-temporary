import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

// --- Global Constants & Classes ---

const WAREHOUSE_SIZE = 60;
const WAREHOUSE_HEIGHT = 25;
const WALL_THICKNESS = 2;
const TEXTURE_SCALE = 18.5; 
const WIN_WIDTH = 30;
const WIN_HEIGHT = 12;
const WIN_Y_POS = 10; 

const COLOR_CONCRETE = 0x888899;
const COLOR_SKY_TOP = 0x89CFF0; 
const COLOR_SKY_BOTTOM = 0xFFA500; 
const COLOR_LIGHT_SUN = 0xFFAE42; 
const COLOR_LIGHT_POINT = 0xffffff;

const portalAngles = {
	'portal2': -Math.PI / 2,
	'portal3': Math.PI / 2
};

const CLIENT_LIST = [
	"Adidas (Ad creative)",
	"AdventHealth (Digital activation)",
	"Afterpay (Web app)",
	"Amazon (Web app, AI)",
	"BBC (Ad creative)",
	"BMW (Ad creative)",
	"Burger King (Web app, AR)",
	"Cadillac (Web app)",
	"Corona (Digital activation)",
	"Crocs (Web app)",
	"Crowne Plaza (Ad creative, Digital activation, Web app)",
	"Dyson (Ad creative)",
	"Kroger (Web app)",
	"E.L.F. Cosmetics (Web app, AI)",
	"Foot Locker (Ad creative)",
	"GM (Ad creative)",
	"JP Morgan (Web app, AR)",
	"Invesco QQQ (Ad creative, Web app)",
	"Lionsgate Films (Web app, AI)",
	"LG (Web app)",
	"L’Oréal (Web app, AI)",
	"Microsoft (Ad creative)",
	"Modelo",
	"MoMa (Web app)",
	"MTV (Ad creative, Web app)",
	"Nature Valley (Web app)",
	"Nickelodeon (Ad creative, Web app)",
	"NY Islanders (Web app)",
	"NY Life (Web app, AR)",
	"NY Yankees (Web app)",
	"Oppenheimer (Web app, AR)",
	"Oxygen (Ad creative)",
	"Paramount (Ad creative)",
	"Pepsi (Web app)",
	"Redken (Web app, AI)",
	"Showtime (Ad creative)",
	"Synchrony (Web app)",
	"TED Talks (Web app, AR)",
	"Timberland (Ad creative)",
	"Westfield (Web app, AR)",
	"Urban Decay (Web app, AI)",
	"Visa (Ad creative)",
	"Visit New Jersey (Activation)",
	"Visit Philly (Web app)",
	"Winston-Salem Open (Print Design)"
];

class PortalSystem {
	constructor(camera, scene, textureLoader) { 
		this.camera = camera;
		this.scene = scene;
		this.PORTAL_Z_POS = 0; 
		this.GROUND_Y = 0.2; 
		this.REFERENCE_DISTANCE = 10;
		this.LIGHT_DISTANCE = 8;
		this.LIGHT_HEIGHT = 3;
		this.sceneMask = new THREE.Scene();
		this.portals = [];
		this.textureLoader = textureLoader; 
		this.baseMaskGeo = new THREE.PlaneGeometry(1, 1);
		
		// Use a cylinder instead of a sphere to prevent vertical distortion and properly frame the pano height
		this.skyGeo = new THREE.CylinderGeometry(600, 600, 800, 64, 1, true);
		this.init();
	}

	init() {
		const fontUrl = 'https://39cf74b4a2d6d5dff0a4-775c46aca7cd1526d10918b0d705fa34.ssl.cf2.rackcdn.com/movement/Barlow%20Condensed%20ExtraBold_Regular.json';
		const loader = new FontLoader();
		loader.load(fontUrl, (font) => {
			this.font = font;
			this.portals.forEach(p => this.createTextMesh(p));
		});

		// Load unique skyboxes for each portal
		const panoField = this.textureLoader.load('https://39cf74b4a2d6d5dff0a4-775c46aca7cd1526d10918b0d705fa34.ssl.cf2.rackcdn.com/box/pano-field.jpg');
		panoField.colorSpace = THREE.SRGBColorSpace;
		panoField.wrapS = THREE.RepeatWrapping;
		panoField.repeat.set(2, 1); // Repeats the texture horizontally to significantly "zoom out" the image

		const panoSpace = this.textureLoader.load('https://39cf74b4a2d6d5dff0a4-775c46aca7cd1526d10918b0d705fa34.ssl.cf2.rackcdn.com/box/pano-space.jpg');
		panoSpace.colorSpace = THREE.SRGBColorSpace;
		panoSpace.wrapS = THREE.RepeatWrapping;
		panoSpace.repeat.set(2, 1); // Repeats the texture horizontally to significantly "zoom out" the image

		const portalData = [
			{ id: 'portal2', stencilRef: 2, color: 0xff6347, texture: panoSpace, text: "CONTACT" }, 
			{ id: 'portal3', stencilRef: 3, color: 0xFFD700, texture: panoField, text: "ABOUT\nBOX" }
		];
		portalData.forEach(data => this.createPortal(data));
	}

	createPortal(data) {
		const portal = { ...data };
		portal.scene = new THREE.Scene();
		
		portal.skyDepth = 0; 
		portal.targetSkyDepth = 0;
		portal.targetTextScale = 1.0;
		portal.currentTextScale = 1.0;
		
		const skyMesh = new THREE.Mesh(
			this.skyGeo,
			new THREE.MeshBasicMaterial({ map: data.texture, side: THREE.BackSide, stencilWrite: true, stencilFunc: THREE.EqualStencilFunc, stencilRef: data.stencilRef })
		);
		
		portal.scene.add(skyMesh);
		portal.skyMesh = skyMesh;
		
		const maskMat = new THREE.MeshBasicMaterial({ color: 0x000000, colorWrite: false, depthWrite: false, stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilRef: data.stencilRef, stencilZPass: THREE.ReplaceStencilOp });
		portal.mesh = new THREE.Mesh(this.baseMaskGeo, maskMat);
		this.sceneMask.add(portal.mesh);
		
		portal.textObj = new THREE.Group();
		portal.scene.add(portal.textObj);
		
		const spotLight = new THREE.SpotLight(0xffffff, 10);
		spotLight.angle = Math.PI / 6; 
		spotLight.penumbra = 0.3;
		spotLight.decay = 1.0;
		spotLight.distance = 100;
		portal.scene.add(spotLight);
		portal.scene.add(spotLight.target);
		portal.light = spotLight;
		this.portals.push(portal);
	}

	createTextMesh(portal, overrideColor) {
		if (!this.font || !portal.text) return;
		while(portal.textObj.children.length > 0){ 
			const child = portal.textObj.children[0];
			if (child.geometry) child.geometry.dispose();
			portal.textObj.remove(child); 
		}
		const lines = portal.text.split('\n');
		const lineHeight = 1.4; 
		const size = 0.65; 
		const depthVal = 0.15; // Extruded proportional to text weight
		const finalColor = overrideColor !== undefined ? overrideColor : 0xFFFFFF;
		const mat = new THREE.MeshBasicMaterial({ color: finalColor, stencilWrite: true, stencilFunc: THREE.EqualStencilFunc, stencilRef: portal.stencilRef, transparent: true, opacity: 1 });
		const sideMat = new THREE.MeshBasicMaterial({ color: 0x000000, stencilWrite: true, stencilFunc: THREE.EqualStencilFunc, stencilRef: portal.stencilRef, transparent: true, opacity: 1 });
		
		portal.textMats = [mat, sideMat];
		portal.letters = [];
		
		lines.forEach((line, i) => {
			let currentX = 0;
			const letterData = [];
			const chars = line.split('');

			chars.forEach(char => {
				if (char === ' ') {
					currentX += size * 0.4; 
					return;
				}
				const geo = new TextGeometry(char, { font: this.font, size: size, depth: depthVal, curveSegments: 4, bevelEnabled: false });
				geo.computeBoundingBox();
				const width = geo.boundingBox.max.x - geo.boundingBox.min.x;
				
				// Shift geometry so the origin is exactly in the center of the letter for a clean rotation
				geo.translate(-width / 2, 0, 0);

				const mesh = new THREE.Mesh(geo, [mat, sideMat]);
				mesh.castShadow = false;
				mesh.receiveShadow = false;
				
				const charX = currentX + width / 2;
				letterData.push({ mesh, charX });
				
				currentX += width + size * 0.05; // Base tracking
			});

			const lineWidth = currentX;
			const y = ((lines.length - 1) * lineHeight * size / 2) - (i * lineHeight * size) - (size * 0.35);

			letterData.forEach(data => {
				data.mesh.position.set(data.charX - lineWidth / 2, y, 0);
				portal.textObj.add(data.mesh);
				portal.letters.push(data.mesh);
			});
		});
	}

	updateTransforms() {
		const vFOV = THREE.MathUtils.degToRad(this.camera.fov);
		const visibleHeight = 2 * Math.tan(vFOV / 2) * this.REFERENCE_DISTANCE;
		const visibleWidth = visibleHeight * this.camera.aspect;
		const scale = 0.5;
		const finalWidth = visibleWidth * scale;
		const finalHeight = visibleHeight * scale;
		const yPos = this.GROUND_Y + (finalHeight / 2);
		const halfWidth = finalWidth / 2;

		const portal2 = this.portals.find(p => p.id === 'portal2');
		if(portal2) {
			portal2.mesh.scale.set(finalWidth, finalHeight, 1);
			portal2.mesh.position.set(-halfWidth, yPos, this.PORTAL_Z_POS);
			portal2.mesh.rotation.set(0, -Math.PI / 2, 0);
			portal2.textRestPos = new THREE.Vector3(-halfWidth + 2, yPos, this.PORTAL_Z_POS);
			portal2.textObj.rotation.set(0, -Math.PI / 2, 0); 
			portal2.textObj.position.copy(portal2.textRestPos);
			this.updateLight(portal2, new THREE.Vector3(-this.LIGHT_DISTANCE, 0, 0));
		}
		const portal3 = this.portals.find(p => p.id === 'portal3');
		if(portal3) {
			portal3.mesh.scale.set(finalWidth, finalHeight, 1);
			portal3.mesh.position.set(halfWidth, yPos, this.PORTAL_Z_POS);
			portal3.mesh.rotation.set(0, Math.PI / 2, 0);
			portal3.textRestPos = new THREE.Vector3(halfWidth - 2, yPos, this.PORTAL_Z_POS);
			portal3.textObj.rotation.set(0, Math.PI / 2, 0); 
			portal3.textObj.position.copy(portal3.textRestPos);
			this.updateLight(portal3, new THREE.Vector3(this.LIGHT_DISTANCE, 0, 0));
		}
	}

	updateLight(portal, offsetVector) {
		if(!portal.light) return;
		portal.light.position.copy(portal.mesh.position).add(offsetVector);
		portal.light.position.y += this.LIGHT_HEIGHT;
		portal.light.target.position.copy(portal.mesh.position);
	}
	
	updateText(portal, newText, overrideColor) {
		if(newText !== undefined) portal.text = newText;
		this.createTextMesh(portal, overrideColor);
	}

	render(renderer) {
		renderer.render(this.sceneMask, this.camera);
		renderer.clearDepth();
		this.portals.forEach(p => {
			renderer.render(p.scene, this.camera);
		});
	}
}

function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

// --- Three.js Initialization Function ---

const createThreeScene = (container, uiCallbacks) => {
	let animationReqId;
	let hasOrbitInteracted = false;
	let hasPortalInteracted = false;

	const loadingManager = new THREE.LoadingManager();
	loadingManager.onLoad = () => {
		uiCallbacks.onLoadComplete();
	};

	const textureLoader = new THREE.TextureLoader(loadingManager);
	const scene = new THREE.Scene();

	const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
	const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
	const ORBIT_RADIUS = isTouchDevice ? 19 : 26; 
	
	camera.position.set(0, 3, ORBIT_RADIUS); 
	
	const renderer = new THREE.WebGLRenderer({ antialias: true, stencil: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.0;
	renderer.autoClear = false;
	container.appendChild(renderer.domElement);
	
	let appMode = 'orbit'; 
	let animClock = new THREE.Clock();
	let animDuration = 2.2; 
	let animProgress = 0;
	
	const startState = { pos: new THREE.Vector3(), controlPos: new THREE.Vector3(), quat: new THREE.Quaternion() };
	const targetState = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
	const savedOrbitState = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
	const portalViewState = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };

	const mouseVec = new THREE.Vector2();
	const raycaster = new THREE.Raycaster();

	const pNormal = new THREE.Vector3();

	// Set starting camera target Azimuth to the empty space where "About Box" used to be (0).
	let targetAzimuth = 0;
	let currentAzimuth = 0;
	const SCROLL_SENSITIVITY = 0.00125; 
	let isTouchInteraction = false;
	let isUserInteracting = false;
	let wheelTimeout = null;
	let lastIsAtStart = true;
	
	let isDragging = false;
	let hasDragged = false;
	let lastDragX = 0;
	let lastDragY = 0;

	const defaultOrbitHeight = isTouchDevice ? 3 : 7; 
	const ELEV_DEFAULT = Math.asin(defaultOrbitHeight / ORBIT_RADIUS);
	let targetParallaxX = 0;
	let targetParallaxY = 0;
	let currentParallaxX = 0;
	let currentParallaxY = 0;
	const PARALLAX_FACTOR = 3.0; 
	const MOMENTUM_ZOOM_FACTOR = 4.0; 

	let activePortal = null;
	let exitingPortal = null; 
	let targetSkyboxRot = 0;
	let currentSkyboxRot = 0;
	const PORTAL_ROT_SENSITIVITY = 0.0005; 
	let pendingPortalEntry = null; 

	// Architecture Generation
	function loadTextureAndResizeMesh(url, mesh, fixedHeight) {
		return textureLoader.load(url, (tex) => {
			const img = tex.image;
			if(img) {
				const aspect = img.width / img.height;
				mesh.scale.set(fixedHeight * aspect, fixedHeight, 1);
				tex.wrapS = THREE.ClampToEdgeWrapping;
				tex.wrapT = THREE.ClampToEdgeWrapping;
				tex.repeat.set(1, 1);
			}
		});
	}

	const concreteTex = textureLoader.load('https://39cf74b4a2d6d5dff0a4-775c46aca7cd1526d10918b0d705fa34.ssl.cf2.rackcdn.com/box/concrete.jpg');
	concreteTex.wrapS = THREE.RepeatWrapping;
	concreteTex.wrapT = THREE.RepeatWrapping;
	concreteTex.colorSpace = THREE.SRGBColorSpace;

	const concrete2Tex = textureLoader.load('https://39cf74b4a2d6d5dff0a4-775c46aca7cd1526d10918b0d705fa34.ssl.cf2.rackcdn.com/box/concrete-2.jpg');
	concrete2Tex.wrapS = THREE.RepeatWrapping;
	concrete2Tex.wrapT = THREE.RepeatWrapping;
	concrete2Tex.colorSpace = THREE.SRGBColorSpace;
	
	const wallMaterial = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.8, metalness: 0.1, side: THREE.FrontSide });
	const trimMaterial = new THREE.MeshStandardMaterial({ map: concrete2Tex, roughness: 0.9, metalness: 0.1, side: THREE.FrontSide });
	const barMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1.0, metalness: 0.0 });
	const glassMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1.0, roughness: 0.1, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
	const pillarMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0.1 });

	function autoBoxUVs(geometry) {
		const posAttribute = geometry.attributes.position;
		const normalAttribute = geometry.attributes.normal;
		const uvAttribute = geometry.attributes.uv;
		const scale = TEXTURE_SCALE;
		for (let i = 0; i < posAttribute.count; i++) {
			const x = posAttribute.getX(i);
			const y = posAttribute.getY(i);
			const z = posAttribute.getZ(i);
			const nx = Math.abs(normalAttribute.getX(i));
			const ny = Math.abs(normalAttribute.getY(i));
			if (nx > 0.5) uvAttribute.setXY(i, z / scale, y / scale);
			else if (ny > 0.5) uvAttribute.setXY(i, x / scale, z / scale);
			else uvAttribute.setXY(i, x / scale, y / scale);
		}
		uvAttribute.needsUpdate = true;
	}

	function scaleCylinderUVs(geometry, radius, height) {
		const uvAttribute = geometry.attributes.uv;
		const circumference = 2 * Math.PI * radius;
		const repeatX = circumference / TEXTURE_SCALE;
		const repeatY = height / TEXTURE_SCALE;
		for (let i = 0; i < uvAttribute.count; i++) {
			uvAttribute.setXY(i, uvAttribute.getX(i) * repeatX, uvAttribute.getY(i) * repeatY);
		}
		uvAttribute.needsUpdate = true;
	}

	const sideWidth = (WAREHOUSE_SIZE - WIN_WIDTH) / 2;
	const topHeight = (WAREHOUSE_HEIGHT - (WIN_Y_POS + WIN_HEIGHT/2));
	const bottomHeight = (WIN_Y_POS - WIN_HEIGHT/2);
	
	const wallBottomGeo = new THREE.BoxGeometry(WAREHOUSE_SIZE, bottomHeight, WALL_THICKNESS);
	autoBoxUVs(wallBottomGeo);
	const wallTopGeo = new THREE.BoxGeometry(WAREHOUSE_SIZE, topHeight, WALL_THICKNESS);
	autoBoxUVs(wallTopGeo);
	const wallSideGeo = new THREE.BoxGeometry(sideWidth, WIN_HEIGHT, WALL_THICKNESS);
	autoBoxUVs(wallSideGeo);
	const wallSolidGeo = new THREE.BoxGeometry(WAREHOUSE_SIZE, WAREHOUSE_HEIGHT, WALL_THICKNESS);
	autoBoxUVs(wallSolidGeo);
	const vBarGeo = new THREE.BoxGeometry(0.3, WIN_HEIGHT, 0.3);
	const hBarGeo = new THREE.BoxGeometry(WIN_WIDTH, 0.3, 0.3);
	const floorGeo = new THREE.BoxGeometry(WAREHOUSE_SIZE + 2, 2, WAREHOUSE_SIZE + 2);
	autoBoxUVs(floorGeo);
	const ceilingGeo = new THREE.BoxGeometry(WAREHOUSE_SIZE + 2, 2, WAREHOUSE_SIZE + 2);
	autoBoxUVs(ceilingGeo);
	
	const pillarRadius = 0.8;
	const pillarGeo = new THREE.CylinderGeometry(pillarRadius, pillarRadius, WAREHOUSE_HEIGHT, 32); 
	scaleCylinderUVs(pillarGeo, pillarRadius, WAREHOUSE_HEIGHT);

	function createWall(useReflector) {
		const group = new THREE.Group();
		const bottomMats = [wallMaterial, wallMaterial, trimMaterial, wallMaterial, wallMaterial, trimMaterial];
		const bottomMesh = new THREE.Mesh(wallBottomGeo, bottomMats);
		bottomMesh.position.y = bottomHeight / 2;
		bottomMesh.castShadow = true;
		bottomMesh.receiveShadow = true;
		group.add(bottomMesh);
		const topMats = [wallMaterial, wallMaterial, wallMaterial, trimMaterial, wallMaterial, trimMaterial];
		const topMesh = new THREE.Mesh(wallTopGeo, topMats);
		topMesh.position.y = WAREHOUSE_HEIGHT - (topHeight / 2);
		topMesh.castShadow = true;
		topMesh.receiveShadow = true;
		group.add(topMesh);
		const leftMats = [trimMaterial, wallMaterial, wallMaterial, wallMaterial, wallMaterial, trimMaterial];
		const leftMesh = new THREE.Mesh(wallSideGeo, leftMats);
		leftMesh.position.set(-(WAREHOUSE_SIZE/2) + (sideWidth/2), WIN_Y_POS, 0);
		leftMesh.castShadow = true;
		leftMesh.receiveShadow = true;
		group.add(leftMesh);
		const rightMats = [wallMaterial, trimMaterial, wallMaterial, wallMaterial, wallMaterial, trimMaterial];
		const rightMesh = new THREE.Mesh(wallSideGeo, rightMats);
		rightMesh.position.set((WAREHOUSE_SIZE/2) - (sideWidth/2), WIN_Y_POS, 0);
		rightMesh.castShadow = true;
		rightMesh.receiveShadow = true;
		group.add(rightMesh);
		const numberOfVBars = 10;
		const vSpacing = WIN_WIDTH / (numberOfVBars + 1);
		for (let i = 1; i <= numberOfVBars; i++) {
			const xPos = -(WIN_WIDTH / 2) + (i * vSpacing);
			const vBar = new THREE.Mesh(vBarGeo, barMat);
			vBar.position.set(xPos, WIN_Y_POS, 0);
			vBar.castShadow = true;
			group.add(vBar);
		}
		const numberOfHBars = 3;
		const hSpacing = WIN_HEIGHT / (numberOfHBars + 1);
		for (let j = 1; j <= numberOfHBars; j++) {
			 const yOffset = -(WIN_HEIGHT / 2) + (j * hSpacing);
			 const hBar = new THREE.Mesh(hBarGeo, barMat);
			hBar.position.set(0, WIN_Y_POS + yOffset, 0);
			hBar.castShadow = true;
			group.add(hBar);
		}
		if (useReflector) {
			const glassGeo = new THREE.PlaneGeometry(WIN_WIDTH, WIN_HEIGHT);
			const glass = new THREE.Mesh(glassGeo, glassMaterial);
			glass.position.set(0, WIN_Y_POS, 0);
			group.add(glass);
		}
		return group;
	}

	function createWarehouseStructure() {
		const structure = new THREE.Group();
		const offset = WAREHOUSE_SIZE / 2;
		const back = new THREE.Mesh(wallSolidGeo, wallMaterial);
		back.position.set(0, WAREHOUSE_HEIGHT/2, -offset);
		back.receiveShadow = true; 
		back.castShadow = true;
		structure.add(back);
		const front = createWall(true);
		front.rotation.y = Math.PI;
		front.position.set(0, 0, offset);
		structure.add(front);
		const right = createWall(true);
		right.rotation.y = -Math.PI/2;
		right.position.set(offset, 0, 0);
		structure.add(right);
		const left = createWall(true);
		left.rotation.y = Math.PI/2;
		left.position.set(-offset, 0, 0);
		structure.add(left);
		const floor = new THREE.Mesh(floorGeo, trimMaterial);
		floor.position.y = -0.8; 
		floor.receiveShadow = true;
		structure.add(floor);
		const ceiling = new THREE.Mesh(ceilingGeo, trimMaterial);
		ceiling.position.y = WAREHOUSE_HEIGHT + 0.8; 
		ceiling.receiveShadow = true; 
		ceiling.castShadow = true; 
		structure.add(ceiling);
		return structure;
	}

	scene.add(createWarehouseStructure());

	const pillarPositions = [
		{x: 10, z: 10}, {x: -10, z: 10}, {x: 10, z: -10}, {x: -10, z: -10}
	];
	pillarPositions.forEach(pos => {
		const group = new THREE.Group();
		group.position.set(pos.x, 0, pos.z);
		const pillar = new THREE.Mesh(pillarGeo, pillarMaterial);
		pillar.position.y = WAREHOUSE_HEIGHT / 2;
		pillar.castShadow = true;
		pillar.receiveShadow = true;
		group.add(pillar);
		scene.add(group);
	});

	const wallHeight = 60;
	const wallGeo = new THREE.PlaneGeometry(1, 1); 
	const brickWallRight = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }));
	brickWallRight.position.set(85, 29, 0); 
	brickWallRight.rotation.y = Math.PI / 2; 
	brickWallRight.receiveShadow = true;
	scene.add(brickWallRight);
	
	const brickTex1 = loadTextureAndResizeMesh(
		'https://39cf74b4a2d6d5dff0a4-775c46aca7cd1526d10918b0d705fa34.ssl.cf2.rackcdn.com/box/bricks-1.jpg',
		brickWallRight,
		wallHeight
	);
	brickTex1.colorSpace = THREE.SRGBColorSpace;
	brickWallRight.material.map = brickTex1;

	const brickWallFront = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }));
	brickWallFront.position.set(0, 29, 85); 
	brickWallFront.rotation.y = Math.PI; 
	brickWallFront.receiveShadow = true;
	scene.add(brickWallFront);
	
	const brickTex2 = loadTextureAndResizeMesh(
		'https://39cf74b4a2d6d5dff0a4-775c46aca7cd1526d10918b0d705fa34.ssl.cf2.rackcdn.com/box/bricks-2.jpg',
		brickWallFront,
		wallHeight
	);
	brickTex2.colorSpace = THREE.SRGBColorSpace;
	brickWallFront.material.map = brickTex2;

	const nycHeight = 300; 
	const nycGroup = new THREE.Group();
	nycGroup.position.set(-750, 149, 0); 
	nycGroup.rotation.y = Math.PI / 2;
	scene.add(nycGroup);

	const nycMat = new THREE.MeshStandardMaterial({ roughness: 0.9, side: THREE.DoubleSide });
	const nycWallCenter = new THREE.Mesh(wallGeo, nycMat);
	nycWallCenter.receiveShadow = true;
	nycGroup.add(nycWallCenter);
	const nycWallLeft = new THREE.Mesh(wallGeo, nycMat);
	nycWallLeft.receiveShadow = true;
	nycGroup.add(nycWallLeft);
	const nycWallRight = new THREE.Mesh(wallGeo, nycMat);
	nycWallRight.receiveShadow = true;
	nycGroup.add(nycWallRight);

	const nycLightCenter = new THREE.SpotLight(0xffffff, 1200);
	nycLightCenter.position.set(-150, 100, 0);
	nycLightCenter.angle = Math.PI / 2.5;
	nycLightCenter.penumbra = 0.5;
	nycLightCenter.decay = 1.0;
	nycLightCenter.distance = 2500;
	scene.add(nycLightCenter);

	const nycLightLeft = new THREE.SpotLight(0xffffff, 1200);
	nycLightLeft.angle = Math.PI / 2.5;
	nycLightLeft.penumbra = 0.5;
	nycLightLeft.decay = 1.0;
	nycLightLeft.distance = 2500;
	scene.add(nycLightLeft);

	const nycLightRight = new THREE.SpotLight(0xffffff, 1200);
	nycLightRight.angle = Math.PI / 2.5;
	nycLightRight.penumbra = 0.5;
	nycLightRight.decay = 1.0;
	nycLightRight.distance = 2500;
	scene.add(nycLightRight);

	textureLoader.load('https://39cf74b4a2d6d5dff0a4-775c46aca7cd1526d10918b0d705fa34.ssl.cf2.rackcdn.com/box/nyc.jpg', (tex) => {
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.wrapS = THREE.ClampToEdgeWrapping; 
		tex.wrapT = THREE.ClampToEdgeWrapping;
		tex.repeat.set(1, 1);
		nycMat.map = tex;
		nycMat.needsUpdate = true;
		const aspect = tex.image.width / tex.image.height;
		const width = nycHeight * aspect;
		nycWallCenter.scale.set(width, nycHeight, 1);
		nycWallLeft.scale.set(width, nycHeight, 1);
		nycWallLeft.position.set(-width, 0, 0); 
		nycWallRight.scale.set(width, nycHeight, 1);
		nycWallRight.position.set(width, 0, 0); 

		nycLightLeft.position.set(-150, 100, width);
		nycLightLeft.target.position.set(-750, 149, width);
		scene.add(nycLightLeft.target);

		nycLightRight.position.set(-150, 100, -width);
		nycLightRight.target.position.set(-750, 149, -width);
		scene.add(nycLightRight.target);

		nycLightCenter.target.position.set(-750, 149, 0);
		scene.add(nycLightCenter.target);
	});

	const treeLight2 = new THREE.SpotLight(0xffffff, 150); 
	treeLight2.position.set(50, 25, 0); 
	treeLight2.angle = Math.PI / 2.5;
	treeLight2.penumbra = 0.5;
	treeLight2.decay = 1.0;
	treeLight2.distance = 100;
	treeLight2.target = brickWallRight;
	scene.add(treeLight2);

	const treeLight3 = new THREE.SpotLight(0xffffff, 150);
	treeLight3.position.set(0, 25, 50); 
	treeLight3.angle = Math.PI / 2.5;
	treeLight3.penumbra = 0.5;
	treeLight3.decay = 1.0;
	treeLight3.distance = 100;
	treeLight3.target = brickWallFront;
	scene.add(treeLight3);
	
	const fontUrl = 'https://39cf74b4a2d6d5dff0a4-775c46aca7cd1526d10918b0d705fa34.ssl.cf2.rackcdn.com/movement/Barlow%20Condensed%20ExtraBold_Regular.json';
	const loader = new FontLoader(loadingManager);
	loader.load(fontUrl, (font) => {
		const material = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.05, metalness: 0.1 });
		const boxGroup = new THREE.Group();
		scene.add(boxGroup);
		const geoB = new TextGeometry('B', { font: font, size: 10, depth: 0.5, curveSegments: 12, bevelEnabled: false });
		geoB.computeBoundingBox();
		const meshB = new THREE.Mesh(geoB, material);
		const geoO = new TextGeometry('O', { font: font, size: 10, depth: 0.5, curveSegments: 12, bevelEnabled: false });
		geoO.computeBoundingBox();
		const meshO = new THREE.Mesh(geoO, material);
		const geoX = new TextGeometry('X', { font: font, size: 10, depth: 0.5, curveSegments: 12, bevelEnabled: false });
		geoX.computeBoundingBox();
		const meshX = new THREE.Mesh(geoX, material);
		const widthB = geoB.boundingBox.max.x - geoB.boundingBox.min.x;
		const widthO = geoO.boundingBox.max.x - geoO.boundingBox.min.x;
		const widthX = geoX.boundingBox.max.x - geoX.boundingBox.min.x;
		const gap1 = 1.0; 
		const gap2 = 0.35; 
		meshB.position.set(0, 0, 0);
		meshO.position.set(widthB + gap1, 0, 0);
		meshX.position.set(widthB + gap1 + widthO + gap2, 0, 0);
		boxGroup.add(meshB);
		boxGroup.add(meshO);
		boxGroup.add(meshX);
		const totalWidth = widthB + gap1 + widthO + gap2 + widthX;
		boxGroup.position.set(-totalWidth / 2, 8, -29);
		boxGroup.children.forEach(c => { c.castShadow = true; c.receiveShadow = true; });
		
		const boxLight = new THREE.PointLight(0xffffff, 100, 30); 
		boxLight.position.set(0, 18, -25);
		boxLight.castShadow = true;
		scene.add(boxLight);
		
		const textGeo2 = new TextGeometry('Est. 2007', { font: font, size: 1.5, depth: 0.5, curveSegments: 12, bevelEnabled: false });
		textGeo2.computeBoundingBox();
		textGeo2.translate(-0.5 * (textGeo2.boundingBox.max.x - textGeo2.boundingBox.min.x), 0, 0);
		const textMesh2 = new THREE.Mesh(textGeo2, material);
		textMesh2.position.set(0, 5, -29);
		textMesh2.castShadow = true;
		textMesh2.receiveShadow = true;
		scene.add(textMesh2);
	});
	
	const skyGeo = new THREE.SphereGeometry(2000, 24, 24); 
	const vertexShader = `
		varying vec3 vWorldPosition;
		void main() {
			vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
			vWorldPosition = worldPosition.xyz;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}
	`;
	const fragmentShader = `
		uniform vec3 topColor;
		uniform vec3 bottomColor;
		uniform float offset;
		uniform float exponent;
		varying vec3 vWorldPosition;
		void main() {
			vec3 sunDir = normalize(vec3(-100.0, 50.0, 120.0));
			float dotProd = dot(normalize(vWorldPosition), sunDir);
			float h = (dotProd + 1.0) * 0.5;
			gl_FragColor = vec4( mix( topColor, bottomColor, h ), 1.0 );
		}
	`;
	const skyMat = new THREE.ShaderMaterial({
		vertexShader: vertexShader,
		fragmentShader: fragmentShader,
		uniforms: {
			topColor: { value: new THREE.Color(COLOR_SKY_TOP) },
			bottomColor: { value: new THREE.Color(COLOR_SKY_BOTTOM) },
			offset: { value: 10 },
			exponent: { value: 0.6 }
		},
		side: THREE.BackSide
	});
	const sky = new THREE.Mesh(skyGeo, skyMat);
	scene.add(sky);

	const groundGeo = new THREE.PlaneGeometry(5000, 5000);
	const groundMat = new THREE.MeshBasicMaterial({ color: 0x444444, side: THREE.FrontSide }); 
	const ground = new THREE.Mesh(groundGeo, groundMat);
	ground.rotation.x = -Math.PI / 2;
	ground.position.y = -1.05; 
	scene.add(ground);

	const shadowMat = new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.5 });
	const shadowPlane = new THREE.Mesh(groundGeo, shadowMat);
	shadowPlane.rotation.x = -Math.PI / 2;
	shadowPlane.position.y = -1.0; 
	shadowPlane.receiveShadow = true;
	scene.add(shadowPlane);

	scene.add(new THREE.AmbientLight(0xffffff, 0.4));

	const sunLight = new THREE.DirectionalLight(COLOR_LIGHT_SUN, 5.0);
	sunLight.position.set(-100, 50, 120); 
	sunLight.castShadow = true;
	sunLight.shadow.mapSize.width = 4096; 
	sunLight.shadow.mapSize.height = 4096;
	const d = 200; 
	sunLight.shadow.camera.left = -d;
	sunLight.shadow.camera.right = d;
	sunLight.shadow.camera.top = d;
	sunLight.shadow.camera.bottom = -d;
	sunLight.shadow.camera.near = 0.5;
	sunLight.shadow.camera.far = 500;
	sunLight.shadow.bias = -0.00001; 
	sunLight.shadow.normalBias = 0.02; 
	scene.add(sunLight);
	
	const lightPositions = [
		{ x: 0, z: 0 }, { x: 25, z: 25 }, { x: -25, z: 25 }, { x: 25, z: -25 }, { x: -25, z: -25 } 
	];
	lightPositions.forEach(pos => {
		const pointLight = new THREE.PointLight(COLOR_LIGHT_POINT, 50, 60, 1.5); 
		pointLight.position.set(pos.x, WAREHOUSE_HEIGHT - 2, pos.z);
		pointLight.castShadow = true;
		pointLight.shadow.bias = -0.0001;
		pointLight.shadow.normalBias = 0.01; 
		scene.add(pointLight);
	});
	
	const portalSystem = new PortalSystem(camera, scene, textureLoader);
	portalSystem.updateTransforms();

	// Event & Logic Methods

	function hideScrollIndicator() {
		if (appMode === 'orbit') {
			if (!hasOrbitInteracted) {
				hasOrbitInteracted = true;
				uiCallbacks.setScrollVisible(false);
			}
		}
	}
	
	function onPointerMove( x, y, isTouch ) {
		mouseVec.x = ( x / window.innerWidth ) * 2 - 1;
		mouseVec.y = - ( y / window.innerHeight ) * 2 + 1;

		if (appMode === 'orbit' && !isTouch) {
			targetParallaxX = mouseVec.x * (PARALLAX_FACTOR * 0.8);
			targetParallaxY = Math.max(-1.5, mouseVec.y * (PARALLAX_FACTOR * 1.0)); // Reduced altitude limits
		}
	}

	function onExitPortal() {
		if (appMode === 'in_portal') {
			appMode = 'transition_out';
			uiCallbacks.onPortalExitStart();
			uiCallbacks.setBackVisible(false);
			uiCallbacks.setUiVisible(true);
			uiCallbacks.setScrollMode('orbit');
			uiCallbacks.setActivePortalId(null);
			
			exitingPortal = activePortal; 
			activePortal = null;

			exitingPortal.targetSkyDepth = -75;
			
			startState.pos.copy(camera.position);
			startState.quat.copy(camera.quaternion);
			
			targetState.pos.copy(savedOrbitState.pos);
			targetState.quat.copy(savedOrbitState.quat);

			const angle = portalAngles[exitingPortal.id];
			const rXZ = ORBIT_RADIUS;
			startState.controlPos = new THREE.Vector3(rXZ * Math.sin(angle), 1.0, rXZ * Math.cos(angle));
			
			animProgress = 0;
			animClock.getDelta(); 
		}
	}

	function enterPortal(selectedPortal) {
		activePortal = selectedPortal;
		appMode = 'transition_in';
		
		uiCallbacks.setScrollVisible(false);
		uiCallbacks.setUiVisible(false);
		uiCallbacks.setScrollMode('portal');
		uiCallbacks.setActivePortalId(selectedPortal.id);
		
		targetSkyboxRot = selectedPortal.skyMesh.rotation.y;
		currentSkyboxRot = selectedPortal.skyMesh.rotation.y;

		activePortal.skyDepth = -75;
		activePortal.targetSkyDepth = -75;
		
		portalSystem.portals.forEach(p => p.targetTextScale = 1.0);

		const normal = new THREE.Vector3(0, 0, 1);
		normal.applyQuaternion(selectedPortal.mesh.quaternion);
		const camTargetPos = selectedPortal.mesh.position.clone().addScaledVector(normal, 5.0);

		savedOrbitState.pos.copy(camera.position);
		savedOrbitState.quat.copy(camera.quaternion);
		
		startState.pos.copy(camera.position);
		startState.quat.copy(camera.quaternion);
		
		const angle = portalAngles[selectedPortal.id];
		const rXZ = ORBIT_RADIUS;
		startState.controlPos = new THREE.Vector3(rXZ * Math.sin(angle), 1.0, rXZ * Math.cos(angle));

		targetState.pos.copy(camTargetPos);
		
		const dummyCam = camera.clone();
		dummyCam.position.copy(targetState.pos);
		dummyCam.lookAt(selectedPortal.mesh.position);
		targetState.quat.copy(dummyCam.quaternion);
		
		portalViewState.pos.copy(targetState.pos);
		portalViewState.quat.copy(targetState.quat);
		
		animProgress = 0;
		animClock.getDelta(); 
	}

	const onWindowResize = () => {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(window.innerWidth, window.innerHeight);
		
		portalSystem.updateTransforms();
		
		if (activePortal) {
			const normal = new THREE.Vector3(0, 0, 1);
			normal.applyQuaternion(activePortal.mesh.quaternion);
			
			const newPortalViewPos = activePortal.mesh.position.clone().addScaledVector(normal, 5.0);
			portalViewState.pos.copy(newPortalViewPos);

			if (appMode === 'in_portal') {
				targetState.pos.copy(newPortalViewPos);
				camera.position.copy(newPortalViewPos); 
			} 
			else if (appMode === 'transition_in') {
				targetState.pos.copy(newPortalViewPos);
			}
		}
	};

	// Listeners
	function handleDragDelta(deltaX, deltaY) {
		const effectiveDelta = -(deltaX + deltaY); 
		
		if (appMode === 'orbit') {
			const dragSensitivity = 2.5; 
			targetAzimuth += effectiveDelta * SCROLL_SENSITIVITY * dragSensitivity;
			hideScrollIndicator();
		}
	}

	const onMouseDown = (e) => {
		isDragging = true;
		hasDragged = false;
		isUserInteracting = true;
		lastDragX = e.clientX;
		lastDragY = e.clientY;
	};

	const onMouseUp = () => {
		isDragging = false;
		isUserInteracting = false;
	};

	const onMouseMove = (event) => {
		if (!isTouchDevice) onPointerMove(event.clientX, event.clientY, false);
		
		if (isDragging) {
			const deltaX = event.clientX - lastDragX;
			const deltaY = event.clientY - lastDragY;
			
			if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
				hasDragged = true;
			}
			
			lastDragX = event.clientX;
			lastDragY = event.clientY;
			
			handleDragDelta(deltaX, deltaY);
		}
	};

	const onWheel = (e) => {
		isUserInteracting = true;
		clearTimeout(wheelTimeout);
		wheelTimeout = setTimeout(() => isUserInteracting = false, 100);
		
		const delta = e.deltaY + e.deltaX;
		
		if (appMode === 'orbit') {
			hideScrollIndicator();
			isTouchInteraction = false;
			targetAzimuth += delta * SCROLL_SENSITIVITY;
		}
	};

	const onTouchStart = (e) => {
		if (e.touches.length > 0) {
			hasDragged = false;
			lastDragX = e.touches[0].clientX;
			lastDragY = e.touches[0].clientY;
			onPointerMove(lastDragX, lastDragY, true);
			isTouchInteraction = true;
			isUserInteracting = true; 
			hideScrollIndicator();
		}
	};

	const onTouchEnd = () => isUserInteracting = false;

	const onTouchMove = (event) => {
		if (event.touches.length > 0) {
			if (['orbit', 'in_portal'].includes(appMode)) {
				// Let custom scroll handle logic without interfering during portal interactions
			}
			const clientX = event.touches[0].clientX;
			const clientY = event.touches[0].clientY;
			onPointerMove(clientX, clientY, true);
			
			const deltaX = clientX - lastDragX;
			const deltaY = clientY - lastDragY;
			
			if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
				hasDragged = true;
			}
			
			lastDragX = clientX;
			lastDragY = clientY;
			
			handleDragDelta(deltaX, deltaY);
			isTouchInteraction = true;
		}
	};

	const onClick = (event) => {
		if (hasDragged) return; 
		
		if (event.clientX !== undefined && event.clientY !== undefined) {
			mouseVec.x = (event.clientX / window.innerWidth) * 2 - 1;
			mouseVec.y = -(event.clientY / window.innerHeight) * 2 + 1;
		}

		raycaster.setFromCamera(mouseVec, camera);
		
		if (appMode === 'orbit') {
			const portalMeshes = portalSystem.portals.map(p => p.mesh);
			const intersects = raycaster.intersectObjects(portalMeshes);

			if (intersects.length > 0) {
				const hit = intersects[0];
				const selectedPortal = portalSystem.portals.find(p => p.mesh === hit.object);
				hasOrbitInteracted = true;
				enterPortal(selectedPortal);
			}
		}
	};

	// Attach DOM Events
	window.addEventListener('resize', onWindowResize, false);
	container.addEventListener('mousedown', onMouseDown);
	container.addEventListener('mouseup', onMouseUp);
	container.addEventListener('mouseleave', onMouseUp);
	container.addEventListener('mousemove', onMouseMove);
	container.addEventListener('wheel', onWheel, { passive: false });
	container.addEventListener('touchstart', onTouchStart, { passive: false });
	container.addEventListener('touchend', onTouchEnd, { passive: false });
	container.addEventListener('touchmove', onTouchMove, { passive: false });
	container.addEventListener('click', onClick);
	onWindowResize();

	// Render Loop
	const colorWhite = new THREE.Color(0xffffff);
	const colorBlack = new THREE.Color(0x000000);

	function animate() {
		animationReqId = requestAnimationFrame(animate);
		
		portalSystem.portals.forEach(p => {
			p.skyDepth += (p.targetSkyDepth - p.skyDepth) * 0.015;
			p.currentTextScale += (p.targetTextScale - p.currentTextScale) * 0.15;
			if (p.textObj) p.textObj.scale.setScalar(p.currentTextScale);

			if (p.textMats) {
				const isEntering = (p === activePortal && ['transition_in', 'in_portal'].includes(appMode));
				const targetOpacity = isEntering ? 0 : 1;
				p.textMats[0].opacity += (targetOpacity - p.textMats[0].opacity) * 0.08;
				p.textMats[1].opacity += (targetOpacity - p.textMats[1].opacity) * 0.08;
			}

			if (p.skyMesh) {
				pNormal.set(0, 0, 1).applyQuaternion(p.mesh.quaternion);
				p.skyMesh.position.copy(p.mesh.position).addScaledVector(pNormal, p.skyDepth);
				if (p === activePortal && appMode === 'transition_in') {
					p.skyMesh.rotation.y += 0.0004;
					currentSkyboxRot = p.skyMesh.rotation.y;
					targetSkyboxRot = p.skyMesh.rotation.y;
				} else if (appMode !== 'in_portal') {
					p.skyMesh.rotation.y += 0.0004;
				}
			}
		});

		if (appMode === 'orbit' && !isTouchDevice) {
			 raycaster.setFromCamera(mouseVec, camera);
			 const portalMeshes = portalSystem.portals.map(p => p.mesh);
			 const intersects = raycaster.intersectObjects(portalMeshes);
			 let hoveredPortal = null;
			 if (intersects.length > 0) {
				 hoveredPortal = portalSystem.portals.find(p => p.mesh === intersects[0].object);
			 }
			 portalSystem.portals.forEach(p => {
				 p.targetTextScale = (p === hoveredPortal) ? 1.15 : 1.0;
			 });
		}
		
		if (appMode === 'in_portal') {
			currentSkyboxRot += (targetSkyboxRot - currentSkyboxRot) * 0.1;
			if(activePortal && activePortal.skyMesh) activePortal.skyMesh.rotation.y = currentSkyboxRot;
		}
		
		if (appMode === 'orbit') {
			const normalizedAzimuth = ((targetAzimuth % (Math.PI * 2)) + (Math.PI * 2)) % (Math.PI * 2);
			const threshold = 0.35; 
			const isAtStart = normalizedAzimuth < threshold || normalizedAzimuth > (Math.PI * 2 - threshold);
			
			if (isAtStart !== lastIsAtStart) {
				lastIsAtStart = isAtStart;
				uiCallbacks.setIntroVisible(isAtStart);
			}

			const dampingFactor = isTouchInteraction ? 0.08 : 0.05;
			const azimuthDiff = Math.abs(targetAzimuth - currentAzimuth);
			const zoomOffset = isTouchInteraction ? 0 : azimuthDiff * MOMENTUM_ZOOM_FACTOR; 
			currentAzimuth += (targetAzimuth - currentAzimuth) * dampingFactor;
			currentParallaxX += (targetParallaxX - currentParallaxX) * dampingFactor;
			currentParallaxY += (targetParallaxY - currentParallaxY) * dampingFactor;
			const dynamicRadius = ORBIT_RADIUS - zoomOffset;
			const y = dynamicRadius * Math.sin(ELEV_DEFAULT);
			const rXZ = dynamicRadius * Math.cos(ELEV_DEFAULT);
			const x = rXZ * Math.sin(currentAzimuth);
			const z = rXZ * Math.cos(currentAzimuth);
			camera.position.set(x + Math.cos(currentAzimuth) * currentParallaxX, y + currentParallaxY, z - Math.sin(currentAzimuth) * currentParallaxX);
			camera.lookAt(0, 0, 0);
			
			if (pendingPortalEntry && azimuthDiff < 0.05) {
				enterPortal(pendingPortalEntry);
				pendingPortalEntry = null;
			}
		} 
		else if (appMode === 'transition_in') {
			const delta = animClock.getDelta();
			animProgress += delta / animDuration;
			
			if (animProgress > 0.40 && activePortal) activePortal.targetSkyDepth = 0;

			if (animProgress >= 1) {
				animProgress = 1;
				appMode = 'in_portal';
				uiCallbacks.setBackVisible(true);
				uiCallbacks.onPortalEnterComplete();
			}
			
			const t = easeOutCubic(animProgress);
			const omt = 1 - t;
			camera.position.set(
				omt * omt * startState.pos.x + 2 * omt * t * startState.controlPos.x + t * t * targetState.pos.x,
				omt * omt * startState.pos.y + 2 * omt * t * startState.controlPos.y + t * t * targetState.pos.y,
				omt * omt * startState.pos.z + 2 * omt * t * startState.controlPos.z + t * t * targetState.pos.z
			);
			camera.quaternion.slerpQuaternions(startState.quat, targetState.quat, t);
		}
		else if (appMode === 'in_portal') {
			camera.position.copy(targetState.pos);
			camera.quaternion.copy(targetState.quat);
		}
		else if (appMode === 'transition_out') {
			const delta = animClock.getDelta();
			animProgress += delta / animDuration;
			if (animProgress >= 1) {
				animProgress = 1;
				appMode = 'orbit';
				if (!hasOrbitInteracted) uiCallbacks.setScrollVisible(true);
				exitingPortal = null;
			}
			
			const t = easeOutCubic(animProgress);
			const omt = 1 - t;
			camera.position.set(
				omt * omt * startState.pos.x + 2 * omt * t * startState.controlPos.x + t * t * targetState.pos.x,
				omt * omt * startState.pos.y + 2 * omt * t * startState.controlPos.y + t * t * targetState.pos.y,
				omt * omt * startState.pos.z + 2 * omt * t * startState.controlPos.z + t * t * targetState.pos.z
			);
			camera.quaternion.slerpQuaternions(startState.quat, targetState.quat, t);
		}

		if (appMode !== 'orbit') {
			if (lastIsAtStart) {
				lastIsAtStart = false;
				uiCallbacks.setIntroVisible(false);
			}
		}
		
		renderer.clear();
		renderer.render(scene, camera);
		portalSystem.render(renderer);
	}

	animate();

	return {
		handlePortalClick: (targetId) => {
			if (appMode === 'orbit') {
				hasOrbitInteracted = true;
				const baseAngle = portalAngles[targetId];
				const twoPi = Math.PI * 2;
				targetAzimuth = Math.round((targetAzimuth - baseAngle) / twoPi) * twoPi + baseAngle;
				const portal = portalSystem.portals.find(p => p.id === targetId);
				if (portal) {
					pendingPortalEntry = portal;
					isTouchInteraction = false; 
				}
			}
		},
		handlePortalHover: (targetId) => {
			if (appMode !== 'orbit' || isTouchDevice) return;
			hideScrollIndicator();
			const baseAngle = portalAngles[targetId];
			const twoPi = Math.PI * 2;
			targetAzimuth = Math.round((targetAzimuth - baseAngle) / twoPi) * twoPi + baseAngle;
			pendingPortalEntry = null;
			isTouchInteraction = false;
		},
		handlePortalScroll: (delta) => {
			if (appMode === 'in_portal') {
				targetSkyboxRot += delta * (PORTAL_ROT_SENSITIVITY * 8.0);
			}
		},
		handleBackClick: () => {
			onExitPortal();
		},
		dispose: () => {
			cancelAnimationFrame(animationReqId);
			window.removeEventListener('resize', onWindowResize);
			container.removeEventListener('mousedown', onMouseDown);
			container.removeEventListener('mouseup', onMouseUp);
			container.removeEventListener('mouseleave', onMouseUp);
			container.removeEventListener('mousemove', onMouseMove);
			container.removeEventListener('wheel', onWheel);
			container.removeEventListener('touchstart', onTouchStart);
			container.removeEventListener('touchend', onTouchEnd);
			container.removeEventListener('touchmove', onTouchMove);
			container.removeEventListener('click', onClick);
			renderer.dispose();
		}
	};
};

const ContactForm = () => {
	const [formData, setFormData] = useState({
		firstName: '',
		lastName: '',
		email: '',
		reason: '',
		otherReason: '',
		message: '',
		website: ''
	});
	const [status, setStatus] = useState('idle');

	const handleChange = (e) => {
		setFormData({ ...formData, [e.target.name]: e.target.value });
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (formData.website) return; // honeypot
		setStatus('submitting');
		
		const submitData = new FormData();
		submitData.append('formID', '260443365215048');
		submitData.append('q3_name[first]', formData.firstName);
		submitData.append('q3_name[last]', formData.lastName);
		submitData.append('q6_email', formData.email);
		if (formData.reason) {
			submitData.append('q7_reasonTo', formData.reason);
			if (formData.reason === 'other') {
				submitData.append('q7_reasonTo[other]', formData.otherReason);
			}
		}
		submitData.append('q5_message', formData.message);
		submitData.append('website', formData.website);

		try {
			await fetch('https://submit.jotform.com/submit/260443365215048/', {
				method: 'POST',
				body: submitData,
				mode: 'no-cors' // Allows blind submission without CORS blocking
			});
			setStatus('success');
		} catch (err) {
			setStatus('error');
		}
	};

	if (status === 'success') {
		return (
			<div className="text-center py-16 animate-fade-in">
				<h3 className="text-5xl font-spirit text-white mb-6 leading-normal">Thank You!</h3>
				<p className="text-3xl text-white/80 font-spirit font-light leading-normal">Your message has been received. We'll be in touch soon.</p>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-10 w-full font-spirit text-left">
			{/* Name Row */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
				<div>
					<label htmlFor="firstName" className="block text-white/90 text-3xl mb-3">First Name *</label>
					<input type="text" id="firstName" name="firstName" required value={formData.firstName} onChange={handleChange} className="w-full bg-white/5 border border-white/30 rounded-lg px-5 py-4 text-white text-2xl placeholder-white/40 focus:outline-none focus:border-white focus:bg-white/10 transition-colors" placeholder="Jane" />
				</div>
				<div>
					<label htmlFor="lastName" className="block text-white/90 text-3xl mb-3">Last Name *</label>
					<input type="text" id="lastName" name="lastName" required value={formData.lastName} onChange={handleChange} className="w-full bg-white/5 border border-white/30 rounded-lg px-5 py-4 text-white text-2xl placeholder-white/40 focus:outline-none focus:border-white focus:bg-white/10 transition-colors" placeholder="Doe" />
				</div>
			</div>

			{/* Email */}
			<div>
				<label htmlFor="email" className="block text-white/90 text-3xl mb-3">Email *</label>
				<input type="email" id="email" name="email" required value={formData.email} onChange={handleChange} className="w-full bg-white/5 border border-white/30 rounded-lg px-5 py-4 text-white text-2xl placeholder-white/40 focus:outline-none focus:border-white focus:bg-white/10 transition-colors" placeholder="example@example.com" />
			</div>

			{/* Reason */}
			<div>
				<label className="block text-white/90 text-3xl mb-5">Reason to connect</label>
				<div className="flex flex-col gap-5">
					{['Get a project quote', 'Partner with Box', 'Employment', 'other'].map((opt) => (
						<label key={opt} className="flex items-center gap-4 text-white/90 text-2xl cursor-pointer group">
							<div className={`w-7 h-7 rounded-full border-[3px] flex items-center justify-center transition-colors ${formData.reason === opt ? 'border-white bg-white/20' : 'border-white/40 group-hover:border-white/70'}`}>
								{formData.reason === opt && <div className="w-3.5 h-3.5 rounded-full bg-white" />}
							</div>
							<input type="radio" name="reason" value={opt} checked={formData.reason === opt} onChange={handleChange} className="hidden" />
							<span className="mt-1">{opt === 'other' ? 'Other' : opt}</span>
						</label>
					))}
				</div>
				{formData.reason === 'other' && (
					<div className="mt-5 ml-11">
						<input type="text" name="otherReason" value={formData.otherReason} onChange={handleChange} placeholder="Please type another option here" className="w-full bg-white/5 border border-white/30 rounded-lg px-5 py-4 text-white text-2xl placeholder-white/40 focus:outline-none focus:border-white focus:bg-white/10 transition-colors" />
					</div>
				)}
			</div>

			{/* Message */}
			<div>
				<label htmlFor="message" className="block text-white/90 text-3xl mb-3">Message</label>
				<textarea id="message" name="message" rows="5" value={formData.message} onChange={handleChange} className="w-full bg-white/5 border border-white/30 rounded-lg px-5 py-4 text-white text-2xl placeholder-white/40 focus:outline-none focus:border-white focus:bg-white/10 transition-colors resize-none" placeholder="How can we be of service?"></textarea>
			</div>

			{/* Honeypot */}
			<div style={{ display: 'none' }} aria-hidden="true">
				<input type="text" name="website" tabIndex="-1" value={formData.website} onChange={handleChange} />
			</div>

			{/* Submit */}
			<div className="pt-6">
				<button type="submit" disabled={status === 'submitting'} className="px-14 py-5 bg-white text-black text-3xl tracking-wider rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
					{status === 'submitting' ? 'SENDING...' : 'SEND'}
				</button>
				{status === 'error' && <p className="text-red-400 mt-5 text-2xl">Something went wrong. Please try again.</p>}
			</div>
		</form>
	);
};

const InteractiveLogo = () => {
	const mountRef = useRef(null);

	useEffect(() => {
		if (!mountRef.current) return;

		const mouseNorm = { x: 0, y: 0 };
		const baseRotation = new THREE.Euler(-1, 0.8, 0);
		const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
		let animationFrameId;

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		mountRef.current.appendChild(renderer.domElement);

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(10, 1, 0.1, 100);
		camera.position.set(0, 0, 15);
		scene.add(camera);

		const dirLight = new THREE.DirectionalLight(0xffffff, 30);
		scene.add(dirLight);

		const atLight = new THREE.DirectionalLight(0xffffff, 6);
		atLight.position.set(-0.5, -1.5, 0);
		atLight.castShadow = true;
		atLight.shadow.mapSize.width = 1024;
		atLight.shadow.mapSize.height = 1024;
		atLight.shadow.bias = -0.0005;
		scene.add(atLight);

		const group = new THREE.Group();
		group.rotation.copy(baseRotation);
		scene.add(group);

		const planeGeo = new THREE.PlaneGeometry(1, 1);
		const faceMaterial = new THREE.MeshStandardMaterial({
			color: 0x333333,
			metalness: 0.7,
			roughness: 0.3,
			side: THREE.DoubleSide
		});

		const createFace = () => {
			const mesh = new THREE.Mesh(planeGeo, faceMaterial);
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			return mesh;
		};

		const face1 = createFace();
		face1.position.set(0, 0, -0.5);
		face1.rotation.y = Math.PI;
		const face2 = createFace();
		face2.position.set(-0.5, 0, 0);
		face2.rotation.y = Math.PI / 2;
		const face3 = createFace();
		face3.position.set(0, 0.5, 0);
		face3.rotation.x = -Math.PI / 2;
		const face4 = createFace();
		face4.position.set(0, -0.5, 0);
		face4.rotation.x = Math.PI / 2;

		group.add(face1, face2, face3, face4);

		const onResize = () => {
			const currentSize = window.innerWidth >= 768 ? 125 : 80;
			camera.aspect = 1;
			camera.updateProjectionMatrix();
			renderer.setSize(currentSize, currentSize);
			renderer.domElement.style.width = `${currentSize}px`;
			renderer.domElement.style.height = `${currentSize}px`;
		};

		const onPointerMove = (e) => {
			const x = e.clientX / window.innerWidth;
			const y = e.clientY / window.innerHeight;
			mouseNorm.x = x * 2 - 1;
			mouseNorm.y = y * 2 - 1;
		};

		if (!isTouch) {
			window.addEventListener("pointermove", onPointerMove);
		}
		window.addEventListener("resize", onResize);
		onResize();

		const animate = () => {
			animationFrameId = requestAnimationFrame(animate);
			if (isTouch) {
				const time = Date.now() * 0.001;
				mouseNorm.x = Math.sin(time * 0.7) * 0.5;
				mouseNorm.y = Math.cos(time * 0.6) * 0.5;
			}
			const rotStrengthX = 0.25;
			const rotStrengthY = 0.25;
			const lerpFactor = 0.05;
			const targetX = baseRotation.x + (-mouseNorm.y) * rotStrengthX;
			const targetY = baseRotation.y + mouseNorm.x * rotStrengthY;
			group.rotation.x += (targetX - group.rotation.x) * lerpFactor;
			group.rotation.y += (targetY - group.rotation.y) * lerpFactor;
			renderer.render(scene, camera);
		};
		animate();

		return () => {
			if (!isTouch) window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("resize", onResize);
			cancelAnimationFrame(animationFrameId);
			renderer.dispose();
			if (mountRef.current && renderer.domElement) {
				mountRef.current.removeChild(renderer.domElement);
			}
		};
	}, []);

	return (
		<div className="relative z-[200] pointer-events-none inline-block">
			<div className="absolute inset-0 rounded-full bg-white/20 backdrop-blur-sm -z-10 transition-all duration-300" id="logo-bg-el"></div>
			<div ref={mountRef}></div>
		</div>
	);
};

export default function App() {
	const containerRef = useRef(null);
	const engineRef = useRef(null);
	
	const [loading, setLoading] = useState(true);
	const [scrollVisible, setScrollVisible] = useState(true);
	const [introVisible, setIntroVisible] = useState(true);
	const [scrollMode, setScrollMode] = useState('orbit');
	const [backVisible, setBackVisible] = useState(false);
	const [uiVisible, setUiVisible] = useState(true);
	const [activePortalId, setActivePortalId] = useState(null);
	const [windowHeight, setWindowHeight] = useState(window.innerHeight);
	
	// New states/refs for inside-portal HTML content
	const [portalUiVisible, setPortalUiVisible] = useState(false);
	const portalUiTimeout = useRef(null);
	
	// Virtual Scroll Refs
	const scrollViewportRef = useRef(null);
	const scrollContentRef = useRef(null);
	const scrollbarThumbRef = useRef(null);
	const targetScroll = useRef(0);
	const currentScroll = useRef(0);
	const lastScrollTop = useRef(0);

	// Reset scrolling position whenever portal UI opens up
	useEffect(() => {
		if (portalUiVisible) {
			targetScroll.current = 0;
			currentScroll.current = 0;
			lastScrollTop.current = 0;
			if (scrollContentRef.current) scrollContentRef.current.style.transform = `translateY(0px)`;
			if (scrollbarThumbRef.current) scrollbarThumbRef.current.style.transform = `translateY(0px)`;
		}
	}, [portalUiVisible]);

	// Handle Virtual Eased Scroll
	useEffect(() => {
		if (!portalUiVisible) return;

		const viewport = scrollViewportRef.current;
		const content = scrollContentRef.current;
		const thumb = scrollbarThumbRef.current;
		if (!viewport || !content) return;

		let maxScroll = Math.max(0, content.scrollHeight - viewport.clientHeight);
		
		// Use ResizeObserver to adapt to dynamic changes (like the Jotform loading and resizing)
		const resizeObserver = new ResizeObserver(() => {
			maxScroll = Math.max(0, content.scrollHeight - viewport.clientHeight);
			targetScroll.current = Math.min(targetScroll.current, maxScroll);
		});
		resizeObserver.observe(content);
		resizeObserver.observe(viewport);

		const handleWheel = (e) => {
			e.preventDefault();
			targetScroll.current += e.deltaY * 0.5; // 0.5x speed (takes twice the scrolling)
			targetScroll.current = Math.max(0, Math.min(targetScroll.current, maxScroll));
		};

		let touchStartY = 0;
		const handleTouchStart = (e) => {
			touchStartY = e.touches[0].clientY;
		};
		const handleTouchMove = (e) => {
			e.preventDefault();
			const deltaY = touchStartY - e.touches[0].clientY;
			touchStartY = e.touches[0].clientY;
			targetScroll.current += deltaY * 0.5; // 0.5x speed
			targetScroll.current = Math.max(0, Math.min(targetScroll.current, maxScroll));
		};

		viewport.addEventListener('wheel', handleWheel, { passive: false });
		viewport.addEventListener('touchstart', handleTouchStart, { passive: false });
		viewport.addEventListener('touchmove', handleTouchMove, { passive: false });

		let rAF;
		const loop = () => {
			currentScroll.current += (targetScroll.current - currentScroll.current) * 0.08; // Smooth easing

			if (content) {
				content.style.transform = `translateY(-${currentScroll.current}px)`;
			}

			if (thumb && maxScroll > 0) {
				const trackHeight = thumb.parentElement.clientHeight;
				const thumbHeight = Math.max(40, (viewport.clientHeight / content.scrollHeight) * trackHeight);
				thumb.style.height = `${thumbHeight}px`;
				const progress = currentScroll.current / maxScroll;
				const thumbY = progress * (trackHeight - thumbHeight);
				thumb.style.transform = `translateY(${thumbY}px)`;
			} else if (thumb) {
				thumb.style.height = '0px';
			}

			const delta = currentScroll.current - lastScrollTop.current;
			lastScrollTop.current = currentScroll.current;
			
			if (Math.abs(delta) > 0.01 && engineRef.current && engineRef.current.handlePortalScroll) {
				engineRef.current.handlePortalScroll(delta);
			}

			rAF = requestAnimationFrame(loop);
		};
		rAF = requestAnimationFrame(loop);

		return () => {
			resizeObserver.disconnect();
			viewport.removeEventListener('wheel', handleWheel);
			viewport.removeEventListener('touchstart', handleTouchStart);
			viewport.removeEventListener('touchmove', handleTouchMove);
			cancelAnimationFrame(rAF);
		};
	}, [portalUiVisible]);

	useEffect(() => {
		if (!containerRef.current) return;
		
		engineRef.current = createThreeScene(containerRef.current, {
			onLoadComplete: () => setLoading(false),
			setScrollVisible: (visible) => setScrollVisible(visible),
			setIntroVisible: (visible) => setIntroVisible(visible),
			setScrollMode: (mode) => setScrollMode(mode),
			setBackVisible: (visible) => setBackVisible(visible),
			setUiVisible: (visible) => setUiVisible(visible),
			setActivePortalId: (id) => setActivePortalId(id),
			onPortalEnterComplete: () => {
				portalUiTimeout.current = setTimeout(() => {
					setPortalUiVisible(true);
				}, 1000);
			},
			onPortalExitStart: () => {
				clearTimeout(portalUiTimeout.current);
				setPortalUiVisible(false);
			}
		});

		return () => {
			if (engineRef.current) engineRef.current.dispose();
			clearTimeout(portalUiTimeout.current);
		};
	}, []);

	useEffect(() => {
		const handleResize = () => setWindowHeight(window.innerHeight);
		window.addEventListener('resize', handleResize);
		handleResize();
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	return (
		<div className="m-0 overflow-hidden bg-black font-spirit font-light not-italic w-full relative" style={{ height: windowHeight }}>
			<style dangerouslySetInnerHTML={{__html: `
				@import url('https://use.typekit.net/mqn5led.css');
				.font-spirit { 
					font-family: "new-spirit-condensed", serif; 
					font-feature-settings: "ss01" 1;
					-webkit-font-feature-settings: "ss01" 1;
				}
				@keyframes infiniteScroll {
					0% { transform: translateY(0); }
					100% { transform: translateY(-50%); }
				}
				.animate-infinite-scroll { animation: infiniteScroll 1.5s linear infinite; }
				@keyframes fadeIn {
					from { opacity: 0; }
					to { opacity: 1; }
				}
				.animate-fade-in { animation: fadeIn 0.5s; }
				
				/* Custom Scrollbar for inner portal content */
				.custom-scrollbar::-webkit-scrollbar {
					width: 6px;
				}
				.custom-scrollbar::-webkit-scrollbar-track {
					background: transparent; 
				}
				.custom-scrollbar::-webkit-scrollbar-thumb {
					background: rgba(255, 255, 255, 0.2); 
					border-radius: 4px;
				}
				.custom-scrollbar::-webkit-scrollbar-thumb:hover {
					background: rgba(255, 255, 255, 0.4); 
				}
			`}} />

			{/* Loading Overlay */}
			<div className={`absolute inset-0 bg-black z-[100] flex justify-center items-center transition-opacity duration-1000 ease-out ${loading ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
				<div className="animate-spin inline-block w-12 h-12 border-[3px] border-current border-t-transparent text-white rounded-full" role="status">
					<span className="sr-only">Loading...</span>
				</div>
			</div>

			{/* Bottom Center Text */}
			<div className={`absolute flex items-center justify-center text-white border border-white bg-white/10 backdrop-blur-md px-4 py-2 rounded-md z-50 pointer-events-none transition-all duration-500 ease-in-out bottom-4 left-1/2 -translate-x-1/2 ${scrollVisible ? 'opacity-100' : 'opacity-0'}`}>
				<span className="block font-spirit text-[1rem] tracking-normal normal-case leading-none text-center whitespace-nowrap">
					Contact us for work samples. Full site coming soon!
				</span>
			</div>

			{/* Header */}
			<header className={`absolute bottom-[60px] md:bottom-[40px] left-0 w-full px-4 md:px-8 z-[25] pointer-events-none flex items-center transition-opacity duration-500 ${uiVisible ? 'opacity-100' : 'opacity-0'}`}>
				<div className={`w-[80px] md:w-[125px] shrink-0 ${uiVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}>
					<InteractiveLogo />
				</div>
				<div className={`w-[calc(100%-90px)] md:w-[calc(100%-125px)] flex justify-end items-center gap-6 md:gap-10 text-white ${uiVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}>
					<span 
						className="inline-block font-spirit text-[1.5rem] text-right transition-all duration-300 ease-in-out relative cursor-pointer opacity-80 hover:opacity-100 hover:-translate-y-0.5" 
						onClick={(e) => { e.stopPropagation(); engineRef.current?.handlePortalClick('portal3'); }}
						onMouseEnter={() => engineRef.current?.handlePortalHover('portal3')}
					>About Box</span>
					<span 
						className="inline-block font-spirit text-[1.5rem] text-right transition-all duration-300 ease-in-out relative cursor-pointer opacity-80 hover:opacity-100 hover:-translate-y-0.5" 
						onClick={(e) => { e.stopPropagation(); engineRef.current?.handlePortalClick('portal2'); }}
						onMouseEnter={() => engineRef.current?.handlePortalHover('portal2')}
					>Contact</span>
				</div>
			</header>

			{/* Intro SVG Graphic */}
			<div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full pointer-events-none z-30 transition-opacity duration-1000 ease-in-out ${!loading && introVisible && scrollMode === 'orbit' ? 'opacity-100' : 'opacity-0'}`}>
				<img 
					src="https://39cf74b4a2d6d5dff0a4-775c46aca7cd1526d10918b0d705fa34.ssl.cf2.rackcdn.com/box/intro.svg" 
					alt="Box Creative" 
					className="w-full h-auto drop-shadow-2xl" 
				/>
			</div>

			{/* Scroll Indicator */}
			<div className={`absolute flex flex-col items-center text-white z-40 pointer-events-none transition-all duration-500 ease-in-out h-[40px] border-2 border-white overflow-hidden px-[15px] box-border bottom-[180px] md:bottom-[80px] left-1/2 -translate-x-1/2 ${scrollVisible ? 'opacity-100' : 'opacity-0'}`}>
				<div className="flex flex-col animate-infinite-scroll">
					<span className="block font-spirit text-[1.2rem] tracking-normal normal-case h-[36px] leading-[36px] text-center">Scroll</span>
					<span className="block font-spirit text-[1.2rem] tracking-normal normal-case h-[36px] leading-[36px] text-center">Scroll</span>
				</div>
			</div>

			{/* Canvas Container */}
			<div ref={containerRef} className="absolute inset-0 w-full h-full block pointer-events-auto"></div>

			{/* In-Portal Scrollable HTML UI */}
			<div className={`absolute inset-0 pointer-events-none z-[30] bg-black/60 transition-opacity duration-1000 ease-in-out ${portalUiVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0'}`}>
				{/* Fixed H1 Overlay */}
				<div 
					className="absolute left-0 w-full px-8 md:px-16 z-40 pointer-events-none"
					style={{ top: windowHeight * 0.1 }}
				>
					<h1 className="text-white text-4xl md:text-6xl font-spirit border-b border-white pb-4 w-full m-0 leading-normal">
						{activePortalId === 'portal2' ? 'Contact' : 'About Box'}
					</h1>
				</div>
				
				{/* 80% Scrollable Container */}
				<div 
					ref={scrollViewportRef}
					className="absolute left-0 w-full overflow-hidden"
					style={{ top: windowHeight * 0.2, height: windowHeight * 0.8 }}
				>
					{/* Visual Scrollbar Thumb */}
					<div className="absolute right-2 top-2 bottom-2 w-1.5 bg-white/10 rounded-full z-50 pointer-events-none">
						 <div ref={scrollbarThumbRef} className="w-full bg-white/40 rounded-full" />
					</div>

					{/* Content Container */}
					<div 
						ref={scrollContentRef} 
						className="w-full px-8 md:px-16 pt-12"
						style={{ paddingBottom: windowHeight * 0.3 }}
					>
						{activePortalId === 'portal3' ? (
							<div className="max-w-[100rem] text-white font-spirit leading-normal">
								<div className="flex flex-col gap-12 max-w-5xl">
									<p className="opacity-90 text-2xl md:text-4xl font-light font-spirit leading-normal m-0">
										Box Creative is a design firm and digital marketing studio founded in 2007 by twin commercial artists Andy and Joe Weitzel. We're the product of two defining passions: trend-bending visual design and mind-bending technological innovation.
									</p>
									<p className="opacity-90 text-2xl md:text-4xl font-light font-spirit leading-normal m-0">
										Box is a design firm in the classical sense, with over 25 years of branding experience, through powerful visual identities with peripherals in print, packaging, and online. We’re always at the cusp of design trends, winning awards along the way. Our creative studio has run the full NYC gauntlet — from offices on 5th Ave to SoHo, NoLIta, and now Ridgewood, Queens.
									</p>
									<p className="opacity-90 text-2xl md:text-4xl font-light font-spirit leading-normal m-0">
										We're a digital agency known for innovation. Box was born alongside the iPhone, in the era when browsers ran Flash and the web began to experiment with immersive experiences. Year one landed us MoMA and Pepsi, both tapping us to build 3D web apps to show how high-tech they were. Today, after riding many technological waves, Box harnesses AI, AR, and VR to craft unforgettable experiences for some of the biggest brands and emboldened startups. And if you just need a clean website or mobile app — no bells, no whistles — you've come to the right place too.
									</p>
									<p className="opacity-90 text-2xl md:text-4xl font-light font-spirit leading-normal m-0">
										Box is the space where design and innovation overlap: a one-stop shop for all marketing needs. Now to name-drop familiar companies we've had the privilege of creating for:
									</p>
								</div>
								<ul className="columns-1 md:columns-3 gap-8 mt-16 pt-16 border-t border-white/20 list-none p-0">
									{CLIENT_LIST.map((client, index) => {
										const parts = client.split('(');
										const name = parts[0].trim();
										const type = parts[1] ? `(${parts[1]}` : '';
										return (
											<li key={index} className="text-2xl md:text-3xl font-light font-spirit opacity-90 mb-4 break-inside-avoid m-0">
												{name} {type && <span className="italic opacity-70">{type}</span>}
											</li>
										);
									})}
								</ul>
							</div>
						) : activePortalId === 'portal2' ? (
							<div className="max-w-[100rem] text-white font-spirit leading-normal">
								<p className="mb-16 max-w-5xl opacity-90 text-2xl md:text-4xl font-light leading-normal font-spirit">
									Thanks for stopping by! Our full portfolio is coming soon. Until then, drop us a message and let us know the kinds of work samples you'd like to see.
								</p>

								<div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-4xl mb-12 opacity-90 text-2xl md:text-3xl font-light">
									<div className="flex flex-col gap-1">
										<h1 className="text-4xl md:text-5xl font-normal mb-4 m-0 border-none pb-0">Box Creative</h1>
										<span>212-548-3753</span>
										<a href="https://www.instagram.com/boxcreative/" target="_blank" rel="noopener noreferrer" className="text-white hover:text-white no-underline hover:underline underline-offset-4 transition-all">@boxcreative</a>
									</div>
									<div className="flex flex-col gap-1 md:pt-[3.5rem]">
										<span>5714 Myrtle Ave</span>
										<span>2nd Floor</span>
										<span>Ridgewood, NY 11385</span>
									</div>
								</div>

								<div className="mb-24 w-full max-w-4xl bg-white/5 p-8 md:p-12 rounded-2xl backdrop-blur-xl border border-white/20 relative z-50">
									<ContactForm />
								</div>
							</div>
						) : null}
					</div>
				</div>
			</div>
			
			{/* Back Button */}
			<button 
				onClick={(e) => { e.stopPropagation(); engineRef.current?.handleBackClick(); }}
				className={`absolute bottom-0 right-0 m-4 shadow-[0_4px_12px_rgba(0,0,0,0.1)] bg-white/40 backdrop-blur-[12px] border border-black rounded-full text-black w-[50px] h-[50px] p-0 justify-center items-center transition-all duration-300 ease-in-out z-[50] cursor-pointer hover:bg-white/90 hover:scale-105 pointer-events-auto ${backVisible ? 'animate-fade-in flex' : 'hidden'}`}
			>
				<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="w-5 h-5 stroke-[1px]" viewBox="0 0 16 16">
					<path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z"/>
				</svg>
			</button>
		</div>
	);
}