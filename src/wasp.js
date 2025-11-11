import {evaluate_quintic_2d} from './math.js';
import {draw_circle, draw_curve, draw_line} from "./canvas.js";
import {Agent} from "./agent.js";
import {Lidar} from "./sensor.js";
import {Obstacle} from "./obstacle.js";

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
        positionY: 400,
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

/*
 TODO: refactor into respective classes
 */
// lidar
let lidar = new Lidar();
const NUM_LIDAR = 9;
const LIDAR_RANGE = 60;
const LIDAR_FOV = Math.PI / 2;
//agent
const tangent3Input = document.getElementById('tangent3');
tangent3Input.addEventListener('input', () => {
    let a = agents[0];
    a.setTargetTangent(tangent3Input.value * Math.PI / 180);
    draw();
});

// end TODO

// TODO: move to canvas.js
function create_agent_svg_clone(opts = {}) {
    const size = opts.size ?? 100;
    const template = document.getElementById(opts.templateId || 'agent-template');
    const clone = template.cloneNode(true);
    clone.removeAttribute('id');
    clone.style.position = 'absolute';
    clone.style.left = '0px';
    clone.style.top = '0px';
    clone.style.width = size + 'px';
    clone.style.height = size + 'px';
    clone.style.pointerEvents = 'none';
    clone.style.transformBox = 'fill-box';
    clone.style.zIndex = String(opts.zIndex ?? 10);
    clone.dataset.anchor = opts.anchor || 'center'; // 'center' or 'origin'
    clone.style.transformOrigin = clone.dataset.anchor === 'origin' ? '0 0' : '50% 50%';
    document.body.appendChild(clone);
    return clone;
}

function sync_svg(clone, pos, theta, size) {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / canvas.width;
    const sy = rect.height / canvas.height;
    if (size != null) {
        clone.style.width = size + 'px';
        clone.style.height = size + 'px';
    }
    const w = parseFloat(clone.style.width) || 100;
    const h = parseFloat(clone.style.height) || w;
    const anchor = clone.dataset.anchor || 'center';
    const left = rect.left + window.scrollX + pos.x * sx - (anchor === 'center' ? w / 2 : 0);
    const top = rect.top + window.scrollY + pos.y * sy - (anchor === 'center' ? h / 2 : 0);
    clone.style.left = left + 'px';
    clone.style.top = top + 'px';
    if (theta != null) clone.style.transform = 'rotate(' + (theta * 180 / Math.PI) + 'deg)';
}

// end TODO

// TODO: move to sensor.js
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

function cast_lidar_circles(agentPos, theta, circles, opts = {}) {
    // raycast lidar against circles
    const num = opts.numLidar ?? NUM_LIDAR
    const fov = opts.lidarFov ?? LIDAR_FOV
    const range = opts.lidarRange ?? LIDAR_RANGE
    const steps = Math.max(1, num - 1)
    const hits = []
    const angles = []
    for (let i = 0; i < num; ++i) {
        const denom = num > 1 ? (num - 1) : 1;
        const offset = num > 1 ? (i / denom - 0.5) * fov : 0;
        const angle = theta + offset
        let best = null
        for (let j = 0; j < circles.length; ++j) {
            const c = circles[j]
            const h = ray_intersect_circle(agentPos.x, agentPos.y, angle, c.cx, c.cy, c.r, range)
            if (!h) continue
            if (!best || h.dist < best.dist) best = {...h, circleIndex: j, meta: c.meta}
        }
        if (best) hits.push({...best, angle})
        angles.push(angle)
    }
    return {hits, angles}
}

function ray_intersect_circle(x0, y0, theta, cx, cy, r, maxRange) {
    const dx = Math.cos(theta)
    const dy = Math.sin(theta)
    const ox = x0 - cx
    const oy = y0 - cy
    const A = dx * dx + dy * dy
    const B = 2 * (ox * dx + oy * dy)
    const C = ox * ox + oy * oy - r * r
    const D = B * B - 4 * A * C
    if (D < 0) return null
    const sqrtD = Math.sqrt(D)
    const t1 = (-B - sqrtD) / (2 * A)
    const t2 = (-B + sqrtD) / (2 * A)
    const eps = 1e-6;
    const t = (t1 > eps && t1 < maxRange) ? t1 : (t2 > eps && t2 < maxRange) ? t2 : null;
    if (t == null) return null
    return {x: x0 + t * dx, y: y0 + t * dy, dist: t}
}

// end TODO

function animate(ts) {
    if (!animationActive) return;
    if (!lastTimestamp) lastTimestamp = ts;
    const dt = Math.min((ts - lastTimestamp) / 1000, 0.06) * simulationSpeed;
    lastTimestamp = ts;
    for (const obs of obstacles) obs.step(dt);
    for (const o of obstacles) sync_svg(o.svg, {x: o.positionX, y: o.positionY}, 0, 3 * o.radius);
    for (const agent of agents) {
        agent.step(ts, dt, get_collision_circles, cast_lidar_circles)
        sync_svg(agent.svg, agent.p1, agent.orientation, 100);
    }
    draw();
    if (animationActive) requestAnimationFrame(animate);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const obstacle of obstacles) obstacle.draw(ctx);
    for (const agent of agents) {
        agent.draw(ctx);
        agent.draw_waypoints(ctx);
        // LIDAR rays
        const circles = get_collision_circles().filter(c => !(c.meta && c.meta.type === 'agent' && c.meta.name === agent.name));
        const cast = cast_lidar_circles(agent.p1, agent.orientation, circles, {
            numLidar: agent.numLidar,
            lidarFov: agent.lidarFov,
            lidarRange: agent.lidarRange
        })
        for (let i = 0; i < cast.angles.length; ++i) {
            const angle = cast.angles[i]
            const h = cast.hits.find(k => Math.abs(k.angle - angle) < 1e-6)
            const len = h ? h.dist : agent.lidarRange
            const x1 = agent.p1.x + len * Math.cos(angle)
            const y1 = agent.p1.y + len * Math.sin(angle)
            draw_line(ctx, {start: [agent.p1.x, agent.p1.y], end: [x1, y1], color: '#4dd0e1', opacity: 0.6})
        }
        for (const h of cast.hits) draw_circle(ctx, {
            radius: 3,
            centroid: [h.x, h.y],
            colorFill: '#f00',
            opacityFill: 1
        })
        // trajectory
        const curvePoints = [];
        for (let t = 0; t <= 1.001; t += 0.01) {
            const pt = evaluate_quintic_2d(agent.currentSpline, t);
            curvePoints.push([pt.x, pt.y]);
        }
        draw_curve(ctx, curvePoints, {color: '#ffd600', dash: [2, 8]});
    }
}

window.onload = () => {
    animationActive = true;
    lastTimestamp = null;
    agents = AGENTS_CONFIG.map(cfg => new Agent({
        ...cfg,
        lidar: new Lidar(),
        lidarRange: LIDAR_RANGE,
        lidarFov: LIDAR_FOV,
        numLidar: NUM_LIDAR
    }));
    for (const agent of agents) {
        agent.svg = create_agent_svg_clone({size: 100, anchor: 'origin'});
    }
    obstacles = OBSTACLES_CONFIG.map(cfg => new Obstacle(cfg));
    for (const o of obstacles)
        o.svg = create_agent_svg_clone({size: 3 * o.radius, anchor: 'origin'});
    draw();
    requestAnimationFrame(animate);
};
