import {Agent} from "./agent.js";
import {collision_get, collision_reset, draw_truss} from "./canvas.js";
import {Obstacle} from "./obstacle.js";
import {CONFIGURATION} from './configuration.js';

// parameters
let agents = [];
let obstacles = [];
let lastTimestamp = null;
let animationActive = false;
let simulationSpeed = 1;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
// controls
const btnPlay = document.getElementById('btn-play');
const btnStep = document.getElementById('btn-step');
const btnStop = document.getElementById('btn-stop');
// theme
const themeDiv = document.getElementById('theme');
let theme = themeDiv.classList.contains('dark') ? CONFIGURATION.theme.dark : CONFIGURATION.theme.light;
const lblPlay = document.getElementById('lbl-play');
const lblTheme = document.getElementById('lbl-theme');
window.theme_onclick = function () {
    const themeDiv = document.getElementById('theme');
    const icon = document.querySelector('#btn-theme i');
    const goingDark = !themeDiv.classList.contains('dark');
    themeDiv.classList.toggle('dark', goingDark);
    themeDiv.classList.toggle('light', !goingDark);
    icon.className = goingDark ? 'bi bi-sun' : 'bi bi-moon';
    if (lblTheme) lblTheme.textContent = goingDark ? 'Light' : 'Dark';
    for (const agent of agents || []) {
        agent.colorTrail = goingDark ? CONFIGURATION.theme.dark.colorTrail : CONFIGURATION.theme.light.colorTrail;
        agent.colorPath = goingDark ? CONFIGURATION.theme.dark.colorPath : CONFIGURATION.theme.light.colorPath;
    }
    simulation_draw();
    simulation_controls_update();
};
window.play_pause = function () {
    animationActive = !animationActive;
    if (animationActive) {
        lastTimestamp = null;
        requestAnimationFrame(simulation_animate);
    }
    simulation_controls_update();
};
window.stop_reset = function () {
    animationActive = false;
    lastTimestamp = null;
    simulation_reinstantiate_from_configs();
    simulation_draw();
    simulation_controls_update();
};
window.step_once = function () {
    if (animationActive) return;
    const dt = speedInput.value / 60; // one iteration step
    run_frame(dt);
};
const speedInput = document.getElementById('speed');
simulationSpeed = parseFloat(speedInput.value);
speedInput.addEventListener('input', () => {
    let v = parseFloat(speedInput.value);
    if (!Number.isFinite(v)) v = 1.0;
    v = Math.max(0.1, Math.min(4.0, v));
    simulationSpeed = parseFloat(v.toFixed(1));
    speedInput.value = simulationSpeed.toFixed(1);
});

function get_collision_geometry(excludeAgentName) {
    const shapes = collision_get();
    return shapes.filter(s => !(s.meta && s.meta.kind === 'agent' && s.meta.name === excludeAgentName));
}

function simulation_controls_update() {
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

function run_frame(dt) {
    for (const obstacle of obstacles) {
        obstacle.step(dt);
    }
    for (const agent of agents) {
        agent.step(performance.now(), dt, get_collision_geometry, agent.svgSize);
    }
    simulation_draw();
}

function simulation_reinstantiate_from_configs() {
    // remove existing svg clones
    if (agents) for (const agent of agents) {
        agent.undraw(ctx);
    }
    if (obstacles) for (const obstacle of obstacles) {
        obstacle.undraw(ctx);
    }
    if (CONFIGURATION.agents) {
        agents = CONFIGURATION.agents.map(cfg => new Agent({
            ...cfg,
            canvas: canvas,
            colorPath: theme.colorPath,
            colorTrail: theme.colorTrail,
            colorBodyFill: theme.colorBodyFill,
            colorBodyOutline: theme.colorBodyOutline,
        }));
    }
    if (CONFIGURATION.obstacles) {
        obstacles = CONFIGURATION.obstacles.map(cfg => new Obstacle({
            ...cfg,
            canvas: canvas,
        }));
    }
}

function simulation_animate(ts) {
    if (!animationActive) {
        return;
    }
    if (!lastTimestamp) {
        lastTimestamp = ts;
    }
    const dt = Math.min((ts - lastTimestamp) / 1000, 0.06) * simulationSpeed;
    lastTimestamp = ts;
    run_frame(dt);
    if (animationActive) {
        requestAnimationFrame(simulation_animate);
    }
}

function simulation_draw() {
    collision_reset();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const obstacle of obstacles) obstacle.draw(ctx);
    for (const agent of agents) agent.draw(ctx);
    // draw_truss(ctx, {...CONFIGURATION.environment, collision: true});
    const shapes = collision_get();
    for (const agent of agents) {
        const collisionGeometry = shapes.filter(s => !(s.meta && s.meta.kind === 'agent' && s.meta.name === agent.name));
        agent.lidar.draw(ctx, agent.p1, agent.orientation, collisionGeometry, {
            numRays: agent.lidar.numRays,
            fov: agent.lidar.fov,
            range: agent.lidar.range,
        });
    }
}


window.onload = () => {
    simulation_reinstantiate_from_configs();
    simulation_draw();
    simulation_controls_update();
    requestAnimationFrame(simulation_animate);
};

