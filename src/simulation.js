import {Agent} from "./object/agent.js";
import {
    camera_apply,
    camera_reset,
    camera_set,
    collision_geometry_get,
    collision_geometry_reset,
    draw_grid_axes_box,
    draw_truss,
} from "./canvas.js";
import {Obstacle} from "./object/obstacle.js";
import {CONFIGURATION} from './configuration.js';
import Plotly from 'https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/+esm';

// parameters
let agents = [];
let obstacles = [];
let lastTimestamp = null;
let animationActive = false;
let simulationSpeed = 1;
let framerate = 60;
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
// theme
let theme = CONFIGURATION.theme.div.classList.contains('dark') ? CONFIGURATION.theme.dark : CONFIGURATION.theme.light;
const lblPlay = document.getElementById('lbl-play');
const lblTheme = document.getElementById('lbl-theme');
window.theme_onclick = function () {
    const icon = document.querySelector('#btn-theme i');
    const goingDark = !CONFIGURATION.theme.div.classList.contains('dark');
    CONFIGURATION.theme.div.classList.toggle('dark', goingDark);
    CONFIGURATION.theme.div.classList.toggle('light', !goingDark);
    icon.className = goingDark ? 'bi bi-sun' : 'bi bi-moon';
    if (lblTheme) lblTheme.textContent = goingDark ? 'Light' : 'Dark';
    for (const agent of agents || []) {
        agent.renderParameters.colorTrail = goingDark ? CONFIGURATION.theme.dark.colorTrail : CONFIGURATION.theme.light.colorTrail;
        agent.renderParameters.colorPath = goingDark ? CONFIGURATION.theme.dark.colorPath : CONFIGURATION.theme.light.colorPath;
    }
    simulation_draw();
    simulation_controls_update();
};
// controls
const btnPlay = document.getElementById('btn-play');
const btnStep = document.getElementById('btn-step');
const btnStop = document.getElementById('btn-stop');
const agentSelect = document.getElementById('select-agent');
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
    const dt = speedInput.value / framerate; // one iteration step
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

function populate_agent_select() {
    if (!agentSelect) return;
    agentSelect.innerHTML = '';
    agents.forEach((agent, i) => {
        const opt = document.createElement('option');
        opt.value = String(i);
        opt.textContent = agent.name || `Agent ${i}`;
        agentSelect.appendChild(opt);
    });
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

function agent_reached_target(agent, tolerance=1e-6) {
    const dx = agent.position.x - agent.targetX;
    const dy = agent.position.y - agent.targetY;
    const dist = Math.hypot(dx, dy);
    // orientation difference wrapped to [-pi, pi]
    let dtheta = agent.orientation - agent.targetOrientation;
    dtheta = Math.atan2(Math.sin(dtheta), Math.cos(dtheta));
    const posTol = 5;             // pixels
    const oriTol = Math.PI / 90;  // ~2 degrees
    return dist < posTol && Math.abs(dtheta) < oriTol;
}

function run_frame(dt) {
    for (const obstacle of obstacles) {
        obstacle.step(dt);
    }
    for (const agent of agents) {
        agent.step(performance.now(), dt, collision_geometry_get, agent.svgSize);
    }
    simulation_draw();
    let allDone = agents.length > 0 && agents.every(agent_reached_target);
    if (allDone && animationActive) {
        animationActive = false;
        simulation_controls_update();
        if (typeof window.plot_agent_timeseries === 'function') {
            window.plot_agent_timeseries();
        }
        for (const agent of agents) {
            console.log(agent);
        }
    }
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
        agents = CONFIGURATION.agents.map(configuration => new Agent({
            ...configuration,
            renderParameters: {
                canvas: canvas,
                colorPath: theme.colorPath,
                colorTrail: theme.colorTrail,
                colorBodyFill: theme.colorBodyFill,
                colorBodyOutline: theme.colorBodyOutline,
                ...configuration.renderParameters,
            },
        }));
    }
    if (CONFIGURATION.obstacles) {
        obstacles = CONFIGURATION.obstacles.map(configuration => new Obstacle({
            ...configuration,
            renderParameters: {
                canvas: canvas,
                ...configuration.renderParameters,
            },
        }));
    }
    populate_agent_select();
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
    camera_apply(ctx);
    collision_geometry_reset();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    draw_grid_axes_box(ctx, {
        boxOrigin: [0, 0],
        boxWidth: 750,
        boxHeight: 550,
        origin: [0, 0], // logical (0,0) inside box
        xStep: 50,
        yStep: 50
    });
    for (const env of CONFIGURATION.environment) {
        draw_truss(ctx, {...env.truss, collision: true});
    }
    for (const obstacle of obstacles) {
        obstacle.draw(ctx);
    }
    for (const agent of agents) {
        agent.draw(ctx);
    }
    for (const agent of agents) {
        const collisionGeometry = collision_geometry_get(agent.name);
        agent.lidar.draw(ctx, collisionGeometry);
    }
    camera_reset(ctx);
}

function plotAgentTimeSeries(trail, divId) {
    if (!trail || trail.length === 0) return;
    const t = trail.map(p => p.t);
    const x = trail.map(p => p.x);
    const y = trail.map(p => p.y);
    const theta = trail.map(p => p.orientation);
    const data = [
        {x: t, y: x, name: 'x(t)', mode: 'lines', type: 'scatter', yaxis: 'y'},
        {x: t, y: y, name: 'y(t)', mode: 'lines', type: 'scatter', yaxis: 'y2'},
        {x: t, y: theta, name: 'orientation(t)', mode: 'lines', type: 'scatter', yaxis: 'y3'},
    ];
    const layout = {
        title: 'Agent state vs time',
        xaxis: {title: '$\\mathrm{time} [\\mathrm{s}]$'},
        yaxis: {title: 'x'},
        yaxis2: {title: 'y', overlaying: 'y', side: 'right'},
        yaxis3: {title: 'orientation [rad]', anchor: 'free', overlaying: 'y', side: 'right', position: 1.1},
        legend: {orientation: 'h'},
        margin: {l: 60, r: 80, t: 40, b: 40},
    };
    const config = {responsive: true};
    Plotly.newPlot(divId, data, layout, config);
}

window.plot_agent_timeseries = function () {
    if (!agents || agents.length === 0) return;
    const index = parseInt(agentSelect.value, 10);
    const agent = agents[index];
    const trail = agent.trail;
    if (!trail || trail.length < 4) return;
    const t = trail.map(p => p.t);
    const x = trail.map(p => p.x);
    const y = trail.map(p => p.y);
    const theta = trail.map(p => p.orientation);
    const dt = t.map((ti, i) => i === 0 ? 0 : (ti - t[i - 1]));
    const deriv = (arr, dtArr) => arr.map((v, i) => i === 0 ? 0 : (arr[i] - arr[i - 1]) / (dtArr[i] || 1e-6));
    const xdot = deriv(x, dt);
    const xddot = deriv(xdot, dt);
    const xdddot = deriv(xddot, dt);
    const ydot = deriv(y, dt);
    const yddot = deriv(ydot, dt);
    const ydddot = deriv(yddot, dt);
    const thetadot = deriv(theta, dt);
    const thetaddot = deriv(thetadot, dt);
    const thetadddot = deriv(thetaddot, dt);

    // 4x1 vertical stack with shared x
    function plotStack(divId, traces, yTitles, mainTitle) {
        const data = [
            {
                x: t,
                y: traces[0],
                name: yTitles[0],
                xaxis: 'x',
                yaxis: 'y',
                mode: 'lines',
                line: {color: 'black', width: 1,}
            },
            {
                x: t,
                y: traces[1],
                name: yTitles[1],
                xaxis: 'x2',
                yaxis: 'y2',
                mode: 'lines',
                line: {color: 'black', width: 1,}
            },
            {
                x: t,
                y: traces[2],
                name: yTitles[2],
                xaxis: 'x3',
                yaxis: 'y3',
                mode: 'lines',
                line: {color: 'black', width: 1,}
            },
            {
                x: t,
                y: traces[3],
                name: yTitles[3],
                xaxis: 'x4',
                yaxis: 'y4',
                mode: 'lines',
                line: {color: 'black', width: 1,}
            },
        ];

        // per-subplot y extents
        const yMin = traces.map(arr => Math.min(...arr));
        const yMax = traces.map(arr => Math.max(...arr));
        const axisOptions = {
            linecolor: 'black',
            linewidth: 1,
            ticks: 'inside',
            mirror: 'all',
            tickfont: {
                family: 'Times New Roman',
                size: 12,
                color: 'black',
            }
        };
        // vertical lines at replan times
        const replans = agent.replans || [];
        const shapes = [];
        for (const rp of replans) {
            const tRp = rp.t;
            shapes.push(
                {
                    type: 'line',
                    xref: 'x',
                    yref: 'y',
                    x0: tRp,
                    x1: tRp,
                    y0: yMin[0],
                    y1: yMax[0],
                    line: {color: 'red', width: 1, dash: 'dot'}
                },
                {
                    type: 'line',
                    xref: 'x2',
                    yref: 'y2',
                    x0: tRp,
                    x1: tRp,
                    y0: yMin[1],
                    y1: yMax[1],
                    line: {color: 'red', width: 1, dash: 'dot'}
                },
                {
                    type: 'line',
                    xref: 'x3',
                    yref: 'y3',
                    x0: tRp,
                    x1: tRp,
                    y0: yMin[2],
                    y1: yMax[2],
                    line: {color: 'red', width: 1, dash: 'dot'}
                },
                {
                    type: 'line',
                    xref: 'x4',
                    yref: 'y4',
                    x0: tRp,
                    x1: tRp,
                    y0: yMin[3],
                    y1: yMax[3],
                    line: {color: 'red', width: 1, dash: 'dot'}
                },
            );
        }
        const layout = {
            //title: mainTitle,
            render_mode: 'svg',
            grid: {rows: 4, columns: 1, pattern: 'independent'},
            margin: {l: 50, r: 10, t: 30, b: 30},
            font: {
                family: 'Times New Roman',
                size: 12,
                color: 'black',
            },
            xaxis: {
                ...axisOptions,
            },
            xaxis2: {
                matches: 'x',
                ...axisOptions,
            },
            xaxis3: {
                matches: 'x',
                ...axisOptions,
            },
            xaxis4: {
                title: '$\\mathrm{time}\\:[\\mathrm{s}]$',
                matches: 'x',
                ...axisOptions,
            },
            yaxis: {
                title: yTitles[0],
                ...axisOptions,
            },
            yaxis2: {
                title: yTitles[1],
                ...axisOptions,
            },
            yaxis3: {
                title: yTitles[2],
                ...axisOptions,
            },
            yaxis4: {
                title: yTitles[3],
                ...axisOptions,
            },
            shapes: shapes,
            showlegend: false,
        };
        Plotly.newPlot(divId, data, layout, {responsive: true});
    }
    // Stack 1: x
    plotStack(
        'stack-x',
        [
            x,
            xdot,
            xddot,
            xdddot,
        ],
        [
            '$x(t)\\:[\\mathrm{m}]$',
            '$\\dot{x}(t)\\:[\\mathrm{m/s}]$',
            '$\\ddot{x}(t)\\:[\\mathrm{m/s^2}]$',
            '$\\dddot{x}(t)\\:[\\mathrm{m/s^3}]$',
        ],
        'X vs time'
    );
    // Stack 2: y
    plotStack(
        'stack-y',
        [
            y,
            ydot,
            yddot,
            ydddot,
        ],
        [
            '$y(t)\\:[\\mathrm{m}]$',
            '$\\dot{y}(t)\\:[\\mathrm{m/s}]$',
            '$\\ddot{y}(t)\\:[\\mathrm{m/s^2}]$',
            '$\\dddot{y}(t)\\:[\\mathrm{m/s^3}]$',
        ],
        'Y vs time'
    );
    // Stack 3: theta
    plotStack(
        'stack-theta',
        [
            theta,
            thetadot,
            thetaddot,
            thetadddot,
        ],
        [
            '$\\theta(t)\\:[\\mathrm{rad}]$',
            '$\\dot{\\theta}(t)\\:[\\mathrm{rad/s}]$',
            '$\\ddot{\\theta}(t)\\:[\\mathrm{rad/s^2}]$',
            '$\\dddot{\\theta}(t)\\:[\\mathrm{rad/s^3}]$',
        ],
        'Orientation vs time'
    );
};

window.onload = () => {
    simulation_reinstantiate_from_configs();
    camera_set({center: {x: (canvas.width / 2) - 30, y: (canvas.height / 2) - 30}, zoom: 1});
    simulation_draw();
    simulation_controls_update();
    requestAnimationFrame(simulation_animate);
};

