import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';
import { PixelShader } from 'three/examples/jsm/shaders/PixelShader.js';

import Between from 'between.js';
import * as dat from 'dat.gui';

const App = function () {

    const scope = this;

    // Global variables
    const scene: THREE.Scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });

    let composer: EffectComposer;
    let pixelPass: ShaderPass;
    let rgbShift: ShaderPass;

    const gui = new dat.GUI();
    let controls: OrbitControls;
    let camera: THREE.PerspectiveCamera;

    this.postprocessing = true;

    let mouse: THREE.Vector2 = new THREE.Vector2();

    const disksNumber: Number = 5;

    const postprocessingParams = {
        enabled: true,
        pixelSize: 6,
        rgbShift: 0.002,
    }

    // Scene variables
    const pedestalData = {
        towerHeight: 12,
        towerRadius: 2,
        baseHeight: 2,
        baseRadius: 9,
        padding: 20,
    };

    const playHanoiArgs = {
        from: 0,
        to: 2,
        temp: 1,
        diskNumber: disksNumber,
        delay: 200,
    }

    const torusData = {
        tube: 0.8,
        radialSegments: 16,
        tubularSegments: 32,
        arc: 2*Math.PI, 
        verticalPadding: 1.2,
    };
    const torusRadius = (number, current) => { return pedestalData.towerRadius+(number-current)*1.2};

    const towersXPos = [...Array(3).keys()].map(i => i*pedestalData.padding);
    const disksByTowers: THREE.Mesh[][] = [[], [], []];
    
    this.initThreeJs = function() {
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.025, 200);
        controls = new OrbitControls(camera, renderer.domElement);

        camera.position.set(pedestalData.padding+pedestalData.towerRadius/2, 20, 30);
        controls.target.set(pedestalData.padding+pedestalData.towerRadius/2, 5, 0);
        controls.update();

        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor( 0x000000, 1 );
        renderer.setPixelRatio( window.devicePixelRatio );

        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap

        document.getElementById('canvas').appendChild(renderer.domElement);

        // postprocessing

        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));

     
        pixelPass = new ShaderPass(PixelShader);
        pixelPass.uniforms["pixelSize"].value = postprocessingParams.pixelSize;
        pixelPass.uniforms["resolution"].value = new THREE.Vector2( window.innerWidth, window.innerHeight).multiplyScalar( window.devicePixelRatio);
        composer.addPass(pixelPass);

        rgbShift = new ShaderPass(RGBShiftShader);
        rgbShift.uniforms["amount"].value = postprocessingParams.rgbShift;
        composer.addPass(rgbShift);
    }

    this.initGui = function() {
        const cmdFolder = gui.addFolder('commands');

        cmdFolder.add(playHanoiArgs, 'from', 0, 2, 1);
        cmdFolder.add(playHanoiArgs, 'to', 0, 2, 1);
        cmdFolder.add(playHanoiArgs, 'temp', 0, 2, 1);
        cmdFolder.add(playHanoiArgs, 'diskNumber', 0, disksNumber, 1);
        cmdFolder.add(playHanoiArgs, 'delay', 10, 1000, 1);
        cmdFolder.add(scope,'playHanoi');
        cmdFolder.add({move: () => {
            const anim = this.moveFromTo(playHanoiArgs.from, playHanoiArgs.to)
            if(anim) anim.play();
        }}, 'move');
        cmdFolder.open();

        const postProcessingFolder = gui.addFolder('post Processing');
        postProcessingFolder.add(postprocessingParams, 'enabled').onChange(this.updateGUI);
        postProcessingFolder.add(postprocessingParams, 'pixelSize', 1, 20, 1).onChange(this.updateGUI);
        postProcessingFolder.add(postprocessingParams, 'rgbShift', 0, 0.005, 0.0001).onChange(this.updateGUI);
        postProcessingFolder.open();
    }

    this.updateGUI = function() {
        pixelPass.uniforms["pixelSize"].value = postprocessingParams.pixelSize;
        rgbShift.uniforms["amount"].value = postprocessingParams.rgbShift;
    }

    this.moveFromTo = function(from, to, callback, delay = 700) {
        const pop: THREE.Mesh = disksByTowers[from].pop();
        const ease = Between.Easing.Cubic.InOut;
        if(pop != undefined) {
            return new Between(pop.position.y, pedestalData.towerHeight + pedestalData.baseHeight + 2).time(delay)
            .on('update', (value) => { pop.position.y = value;})
            .easing(ease)
            .on('complete', () => {
                new Between(pop.position.x, towersXPos[to]).time(delay)
                .on('update', (value) => { pop.position.x = value;})
                .easing(ease)
                .on('complete', () => {
                    new Between(pop.position.y, this.getTopHeight(to)).time(delay)
                    .on('update', (value) => { pop.position.y = value;})
                    .easing(ease)
                    .on('complete', () => {
                        disksByTowers[to].push(pop);
                        if(callback)
                            callback();
                    });
                });
            });
        }else {
            console.log('undefined pop');
            return undefined;
        }
    }
    
    this.genHanoiMovesList = function(number, from, to, temp) {
        if(number <= 0)
            return [];
        return [...this.genHanoiMovesList(number-1, from, temp, to), [from, to] , ...this.genHanoiMovesList(number-1, temp, to, from)];
    }

    this.playHanoi = function() {
        const {diskNumber, from, to, temp, delay} = playHanoiArgs;
        const moves = this.genHanoiMovesList(diskNumber, from, to, temp).reverse();

        const newAnim = function () {
            const pop = moves.pop();
            if(pop) {
                console.log('from:', pop[0], '  to:', pop[1]);
                scope.moveFromTo(pop[0], pop[1], newAnim, delay);
            }
        }
        newAnim();
    }

    this.setToTower = function(torus, n) {
        torus.position.set(towersXPos[n], this.getTopHeight(n), 0);
    }

    this.getTopHeight = function(n) {
        if(disksByTowers[n].length > 0) {
            const lastInTowerHeight = disksByTowers[n][disksByTowers[n].length-1].position.y;
            return lastInTowerHeight + torusData.verticalPadding;
        }else {
            return pedestalData.baseHeight + torusData.verticalPadding/2;
        }
    }

    this.initDisks = function(n: Number) {
        const torusMat = new THREE.MeshPhongMaterial({color: 0xffff55, shininess: 10});
        // const torusWireframeMat = new THREE.MeshBasicMaterial( { color: 0x000000, wireframe: true, transparent: true } );

        for(let i = 0; i < n ; ++i) {
            const torusGeom = new THREE.TorusGeometry(torusRadius(n, i), torusData.tube, torusData.radialSegments, torusData.tubularSegments);
            torusGeom.rotateX(-Math.PI /2);

            const torus = new THREE.Mesh(torusGeom, torusMat);

            // const torusWireframe = new THREE.Mesh(torusGeom, torusWireframeMat);
            // torus.add(torusWireframe);

            torus.castShadow = true;
            torus.receiveShadow = true;
            
            scope.setToTower(torus, 0);
            disksByTowers[0].push(torus);

            scene.add(torus);
        }
    }

    this.setupScene = function() {
        scene.background = new THREE.Color(0xe0e0e0);
        scene.fog = new THREE.Fog(0xe0e0e0, 30, 150);

        // lights

        scene.add( new THREE.AmbientLight( 0x222222 ) );
       
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(50, 50, 50);

        dirLight.castShadow = true;

        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;

        const d = 200;
        dirLight.shadow.camera.left = - d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = - d;
        dirLight.shadow.camera.far = 1000;

        scene.add(dirLight);

        // light helper
        // const helper = new THREE.CameraHelper(dirLight.shadow.camera);
        // scene.add(helper);

        // ground
        const groundGeom: THREE.PlaneBufferGeometry = new THREE.PlaneBufferGeometry(400, 400);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const ground = new THREE.Mesh( groundGeom, groundMat);
        ground.rotation.x = -Math.PI /2;
        ground.receiveShadow = true;
        scene.add(ground);

        // grid
        // const grid = new THREE.GridHelper(400, 80, 0x000000, 0x000000);
        // grid.material.opacity = 0.2;
        // grid.material.transparent = true;
        // scene.add(grid);
        
        // tower and socles
        const baseGeom = new THREE.CylinderGeometry(pedestalData.towerRadius, pedestalData.towerRadius, pedestalData.towerHeight, 32);
        baseGeom.translate(0, pedestalData.towerHeight/2 + pedestalData.baseHeight, 0);
        const towerGeom = new THREE.CylinderGeometry(pedestalData.baseRadius, pedestalData.baseRadius, pedestalData.baseHeight, 32);
        towerGeom.translate(0, pedestalData.baseHeight/2, 0);
        const pedestalMat = new THREE.MeshPhongMaterial({color: 0xffffff, shininess: 10});
        // const pedestalWireframeMat = new THREE.MeshBasicMaterial({color: 0x000000, wireframe: true, transparent: true});

        const pedestalGeom = new THREE.Geometry();
        pedestalGeom.merge(baseGeom);
        pedestalGeom.merge(towerGeom);
        

        towersXPos.forEach(posx => {
            const pedestal = new THREE.Mesh(pedestalGeom, pedestalMat);

            // const pedestalWireframe = new THREE.Mesh(pedestalGeom, pedestalWireframeMat);
            // pedestal.add(pedestalWireframe);

            pedestal.castShadow = true;
            pedestal.receiveShadow = true;

            pedestal.position.x = posx;
            scene.add(pedestal);
        });
    }

    this.render = function() {
        if (postprocessingParams.enabled) {
            composer.render();
        } else {
            renderer.render(scene, camera);
        }
    }

    this.animate = function () {
        controls.update();
        scope.render();
        requestAnimationFrame(scope.animate);
    };

    // events handlers
    const onWindowResize = function() {
        const h = window.innerHeight
        const w = window.innerWidth;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        composer.setSize(w, h);
        pixelPass.uniforms[ "resolution" ].value.set(w, h).multiplyScalar(window.devicePixelRatio);
    }
    
    const onDocumentMouseDown  = function(e) {
        // console.log("mousedown");
        // do nothing
    }

    const onDocumentMouseMove = function(e) {
        mouse.set(e.clientX, e.clientY); // update mouse
    }

    const onWheel = function(e) {
        // do nothing
    }

    const onKeyDown = function(evt) {
        // do nothing (evt.keyCode)        
    }

    const onKeyUp = function(evt) {
        // do nothing
    }

    this.connect = function () {        
        window.addEventListener('resize', onWindowResize);
        window.addEventListener("wheel", onWheel);
        document.addEventListener('mousemove', onDocumentMouseMove);
        document.addEventListener('mousedown', onDocumentMouseDown);
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
	};

	this.disconnect = function () {
        window.removeEventListener('resize', onWindowResize);
        window.removeEventListener("wheel", onWheel);
        document.removeEventListener('mousemove', onDocumentMouseMove);
        document.removeEventListener('mousedown', onDocumentMouseDown);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('keyup', onKeyUp);
    };

    this.init = function() {
        scope.initThreeJs();
        scope.initGui();
        // scope.initOthers();
        scope.setupScene();
        scope.initDisks(disksNumber);

        scope.connect(); // add listeners
        scope.animate(); // start animation loop
    }();

};

window.addEventListener("load", function() {
    const app = new App();    
});

