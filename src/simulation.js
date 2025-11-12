import {Agent} from "./agent.js";
import {draw_curve, svg_instantiate, svg_sync} from "./canvas.js";
import {evaluate_quintic_2d} from './math.js';
import {Obstacle} from "./obstacle.js";
import {cast_lidar_circles, draw_lidar, Lidar} from "./sensor.js";

// theme
let themeDark = {
    colorTrail: '#fff',
    colorSpline: '#ffd600',
    colorBodyOutline: '#fff',
    colorBodyFill: '#888',
    colorP1: '#0ff',
    colorP2: '#43a047',
    colorP3: '#1976d2',
    colorLidarNoHit: '#4dd0e1'
};
let themeLight = {
    colorTrail: '#000',
    colorSpline: '#888',
    colorBodyOutline: '#000',
    colorBodyFill: '#888',
    colorP1: '#0ff',
    colorP2: '#43a047',
    colorP3: '#1976d2',
    colorLidarNoHit: '#08f'
};
const themeDiv = document.getElementById('theme');
let theme = themeDiv.classList.contains('dark') ? themeDark : themeLight;
const lblPlay = document.getElementById('lbl-play');
const lblTheme = document.getElementById('lbl-theme');
window.theme_onclick = function () {
    const themeDiv = document.getElementById('theme');
    const icon = document.querySelector('#theme-button i');
    const goingDark = !themeDiv.classList.contains('dark');
    themeDiv.classList.toggle('dark', goingDark);
    themeDiv.classList.toggle('light', !goingDark);
    icon.className = goingDark ? 'bi bi-sun' : 'bi bi-moon';
    if (lblTheme) lblTheme.textContent = goingDark ? 'Light' : 'Dark';
    for (const agent of agents || []) {
        agent.colorTrail = goingDark ? themeDark.colorTrail : themeLight.colorTrail;
    }
    draw();
    controls_update();
};

function controls_update() {
    const icon = btnPlay.querySelector('i');
    if (animationActive) {
        icon.className = 'bi bi-pause';
        if (lblPlay) lblPlay.textContent = 'Pause';
        btnPlay.classList.add('is-playing');
        btnStep.disabled = true;
        btnStep.classList.add('is-disabled');
    } else {
        icon.className = 'bi bi-play';
        if (lblPlay) lblPlay.textContent = 'Play';
        btnPlay.classList.remove('is-playing');
        btnStep.disabled = false;
        btnStep.classList.remove('is-disabled');
    }
}

(function initThemeLabel() {
    const dark = document.getElementById('theme').classList.contains('dark');
    if (lblTheme) lblTheme.textContent = dark ? 'Light' : 'Dark';
})();

// parameters
let agents;
let obstacles;
let lastTimestamp = null;
let animationActive = false;
let simulationSpeed = 1;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const AGENTS_CONFIG = [
    {
        name: 'Agent 0',
        positionX: 100,
        positionY: 350,
        speed: 50,
        targetX: 700,
        targetY: 100,
        lidar: new Lidar(),
    },
    {
        name: 'Agent 1',
        positionX: 750,
        positionY: 300,
        speed: 50,
        targetX: 100,
        targetY: 200,
        lidar: new Lidar(),
    },
]
const OBSTACLES_CONFIG = [
    {
        name: 'Static',
        positionX: 320,
        positionY: 150,
        radius: 60,
    },
    // {
    //     name: 'Dynamic',
    //     positionX: canvas.width - 300,
    //     positionY: 300,
    //     velocityX: -20,
    // },
    // {
    //     positionX: 800 + 30,
    //     positionY: 300,
    //     velocityX: -50,
    // },
    // {
    //     positionX: 800 + 30,
    //     positionY: 100,
    //     velocityX: -10,
    // },
    // {
    //     positionX: 800 + 100,
    //     positionY: 250,
    //     velocityX: -40,
    // },
    // {
    //     positionX: 800 / 1.75,
    //     positionY: 0,
    //     velocityY: 25,
    // },
    // {
    //     positionX: 800 / 1.5,
    //     positionY: -200,
    //     velocityY: 30,
    // },
    // {
    //     positionX: 800 / 3,
    //     positionY: 100,
    //     velocityY: 20,
    // }
];
// controls
const btnPlay = document.getElementById('btn-play');
const btnStep = document.getElementById('btn-step');
const btnStop = document.getElementById('btn-stop');

// simulation
function run_frame(dt) {
    for (const obs of obstacles) obs.step(dt);
    for (const o of obstacles) svg_sync(o.svg, {x: o.positionX, y: o.positionY}, 0);
    for (const agent of agents) {
        agent.step(performance.now(), dt, get_collision_circles, cast_lidar_circles);
        svg_sync(agent.svg, agent.p1, agent.orientation);
    }
    draw();
}

function reinstantiate_from_configs() {
    // remove existing svg clones
    if (agents) for (const a of agents) {
        if (a && a.svg && a.svg.remove) a.svg.remove();
        a.svg = null;
    }
    if (obstacles) for (const o of obstacles) {
        if (o && o.svg && o.svg.remove) o.svg.remove();
        o.svg = null;
    }
    agents = AGENTS_CONFIG.map(cfg => new Agent({
        ...cfg,
        lidar: new Lidar(),
        colorTrail: theme.colorTrail,
        colorBodyFill: theme.colorBodyFill,
        colorBodyOutline: theme.colorBodyOutline,
    }));
    for (const agent of agents) {
        agent.svg = svg_instantiate('agent-template', {size: 100});
        svg_sync(agent.svg, agent.p1, agent.orientation);
    }
    obstacles = OBSTACLES_CONFIG.map(cfg => new Obstacle(cfg));
    for (const o of obstacles) {
        o.svg = svg_instantiate('agent-template', {size: 3 * o.radius});
        svg_sync(o.svg, {x: o.positionX, y: o.positionY}, 0);
    }
}

window.play_pause = function () {
    animationActive = !animationActive;
    if (animationActive) {
        lastTimestamp = null;
        requestAnimationFrame(animate);
    }
    controls_update();
};
window.stop_reset = function () {
    animationActive = false;
    lastTimestamp = null;
    reinstantiate_from_configs();
    draw();
    controls_update();
};
window.step_once = function () {
    if (animationActive) return;
    const dt = 1 / 60; // one iteration step
    run_frame(dt);
};
const speedInput = document.getElementById('speed');
simulationSpeed = parseFloat(speedInput.value);
speedInput.addEventListener('input', () => {
    let v = parseFloat(speedInput.value);
    if (!Number.isFinite(v)) v = 1.0;
    v = Math.max(0.1, Math.min(2.0, v));
    simulationSpeed = parseFloat(v.toFixed(1));
    speedInput.value = simulationSpeed.toFixed(1);
});

function get_collision_circles() {
    // builds one list of circles from obstacles + agents
    const list = []
    for (const o of obstacles) list.push({
        cx: o.positionX,
        cy: o.positionY,
        r: o.radius,
        meta: {type: 'obstacle', name: o.name}
    })
    for (const a of agents) if (a.collisionRadius > 0) list.push({
        cx: a.p1.x,
        cy: a.p1.y,
        r: a.collisionRadius,
        meta: {type: 'agent', name: a.name}
    })
    return list
}

function animate(ts) {
    if (!animationActive) return;
    if (!lastTimestamp) lastTimestamp = ts;
    const dt = Math.min((ts - lastTimestamp) / 1000, 0.06) * simulationSpeed;
    lastTimestamp = ts;
    run_frame(dt);
    if (animationActive) requestAnimationFrame(animate);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const obstacle of obstacles) obstacle.draw(ctx);
    for (const agent of agents) {
        agent.draw(ctx);
        agent.draw_waypoints(ctx);
        // lidar
        const circles = get_collision_circles().filter(c => !(c.meta && c.meta.type === 'agent' && c.meta.name === agent.name));
        draw_lidar(ctx, agent.p1, agent.orientation, circles, {
            numRays: agent.numLidar,
            fov: agent.lidarFov,
            range: agent.lidarRange,
        });
        // trajectory
        const curvePoints = [];
        for (let t = 0; t <= 1.001; t += 0.01) {
            const pt = evaluate_quintic_2d(agent.currentSpline, t);
            curvePoints.push([pt.x, pt.y]);
        }
        draw_curve(ctx, curvePoints, {
            color: theme.colorSpline,
            dash: [2, 8],
        });
    }
}

window.onload = () => {
    animationActive = false;
    lastTimestamp = null;
    reinstantiate_from_configs();
    draw();
    controls_update();
    requestAnimationFrame(animate);
};

