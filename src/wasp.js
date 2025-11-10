import {evaluate_quintic_2d, fit_quintic, quintic_tangent, tangent_vector} from './math.js';
import {draw_circle, draw_curve, draw_line, draw_rectangle, draw_tangent, draw_text} from "./canvas.js";
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
        positionX: 100,
        positionY: 350,
        speed: 100,
        targetX: 700, targetY: 100
    },
    {
        positionX: 700,
        positionY: 400,
        speed: 60,
        targetX: 100, targetY: 100
    },
]
const OBSTACLES_CONFIG = [
    {
        positionX: 320,
        positionY: 150,
        radius: 60,
    },
    {
        positionX: canvas.width + 30,
        positionY: 200,
        velocityX: -58,
    },
    // {
    //     positionX: 800 + 30,
    //     positionY: 200,
    //     velocityX: -55,
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
const AVOIDANCE_RESET_DELAY = 500;
const P2_AVOID_DIST = 40;
const P2_SIDE_DIST = -40;
let arcLengthTable = [];
let agentArcLen = 0;
let agentSpeed = 60;
const tangent3Input = document.getElementById('tangent3');
const P1_start = {x: 100, y: 350};
const P1_start_theta = -Math.PI / 3;
const P3 = {x: 700, y: 100};
const tangentScaleFrac = 0.5;
let tangentAngles = [P1_start_theta, 0, 0];
let points = [{...P1_start}, {...P3}, {...P3}];
let currentSpline = null;
let agentDots = [];
let lastDotTime = null;
let avoidanceActive = false;
let avoidanceRestore = false;
let avoidanceClearTime = null;
const agentSvg = create_agent_svg_clone({size: 100, anchor: 'origin'});
tangentAngles[2] = tangent3Input.value * Math.PI / 180;
tangent3Input.addEventListener('input', () => {
    tangentAngles[2] = tangent3Input.value * Math.PI / 180;
    if (points[1].x === points[2].x && points[1].y === points[2].y) {
        update_spline_from_p1_to_p2();
        draw();
    }
});
// obstacle
let blobRadius = 30;
let blobX = canvas.width + blobRadius;
let blobY = 200;
let blobSpeed = 58;
const OBSTACLE = {x: 320, y: 150, r: 60};
const BLOB = {
    get x() {
        return blobX;
    }, get y() {
        return blobY;
    }, r: blobRadius
};
const blobSvg = create_agent_svg_clone({size: 4 * blobRadius, anchor: 'origin'});

// end TODO

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

function compute_arc_length_table(spline, segments = 200) {
    let table = [];
    let prev = evaluate_quintic_2d(spline, 0);
    let acc = 0;
    table.push({t: 0, arcLen: 0});
    for (let i = 1; i <= segments; ++i) {
        let t = i / segments;
        let pt = evaluate_quintic_2d(spline, t);
        acc += Math.hypot(pt.x - prev.x, pt.y - prev.y);
        table.push({t: t, arcLen: acc});
        prev = pt;
    }
    return table;
}

function get_t_for_arclength(table, s) {
    if (s <= 0) return 0;
    if (s >= table[table.length - 1].arcLen) return 1;
    for (let i = 1; i < table.length; ++i) {
        if (s <= table[i].arcLen) {
            let t0 = table[i - 1].t, t1 = table[i].t;
            let s0 = table[i - 1].arcLen, s1 = table[i].arcLen;
            let frac = (s - s0) / (s1 - s0);
            return t0 + frac * (t1 - t0);
        }
    }
    return 1;
}

function get_lidar_hits(agent, theta) {
    let hits = [];
    let angles = [];
    for (let i = 0; i < NUM_LIDAR; ++i) {
        let offset = (i / (NUM_LIDAR - 1) - 0.5) * LIDAR_FOV;
        let angle = theta + offset;
        let hit1 = ray_intersect(agent.x, agent.y, angle, OBSTACLE.x, OBSTACLE.y, OBSTACLE.r, LIDAR_RANGE);
        let hit2 = ray_intersect(agent.x, agent.y, angle, BLOB.x, BLOB.y, BLOB.r, LIDAR_RANGE);
        let best = null;
        if (hit1 && hit2) best = hit1.dist < hit2.dist ? hit1 : hit2;
        else if (hit1) best = hit1;
        else if (hit2) best = hit2;
        if (best) hits.push({...best, angle});
        angles.push(angle);
    }
    return {hits, angles};
}

function ray_intersect(x0, y0, theta, cx, cy, r, maxRange) {
    let dx = Math.cos(theta);
    let dy = Math.sin(theta);
    let ox = x0 - cx;
    let oy = y0 - cy;
    let A = dx * dx + dy * dy;
    let B = 2 * (ox * dx + oy * dy);
    let C = ox * ox + oy * oy - r * r;
    let D = B * B - 4 * A * C;
    if (D < 0) return null;
    let t1 = (-B - Math.sqrt(D)) / (2 * A);
    let t2 = (-B + Math.sqrt(D)) / (2 * A);
    let t = (t1 > 0 && t1 < maxRange) ? t1 : (t2 > 0 && t2 < maxRange) ? t2 : null;
    if (t == null) return null;
    return {x: x0 + t * dx, y: y0 + t * dy, dist: t};
}

function compute_avoid_p2(p1, p3, lidarHits) {
    let fx = p3.x - p1.x;
    let fy = p3.y - p1.y;
    let fwd_mag = Math.hypot(fx, fy);
    if (fwd_mag < 1e-6) return {x: p1.x + P2_AVOID_DIST, y: p1.y};
    let fwd = {x: fx / fwd_mag, y: fy / fwd_mag};
    let left = {x: -fwd.y, y: fwd.x};
    let left_count = 0, right_count = 0;
    for (let hit of lidarHits) {
        let vx = hit.x - p1.x;
        let vy = hit.y - p1.y;
        let det = fwd.x * vy - fwd.y * vx;
        if (det > 0) left_count++;
        else if (det < 0) right_count++;
    }
    let side = 0;
    if (left_count > right_count) side = 1;
    else if (right_count > left_count) side = -1;
    return {
        x: p1.x + fwd.x * P2_AVOID_DIST + side * left.x * P2_SIDE_DIST,
        y: p1.y + fwd.y * P2_AVOID_DIST + side * left.y * P2_SIDE_DIST
    };
}

function update_spline_from_p1_to_p2() {
    const segLen = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y) * tangentScaleFrac;
    const va = tangent_vector(tangentAngles[0], segLen);
    let theta_p2;
    if (points[1].x === points[2].x && points[1].y === points[2].y) {
        theta_p2 = tangentAngles[2];
    } else {
        theta_p2 = Math.atan2(points[2].y - points[1].y, points[2].x - points[1].x);
    }
    tangentAngles[1] = theta_p2;
    const vb = tangent_vector(theta_p2, segLen);
    currentSpline = fit_quintic(points[0], va, points[1], vb);
    arcLengthTable = compute_arc_length_table(currentSpline, 200);
    agentArcLen = 0; // always start agent at t=0 for new spline
}

function spline_get_points() {
    let curvePoints = [];
    for (let t = 0; t <= 1.001; t += 0.01) {
        let pt = evaluate_quintic_2d(currentSpline, t);
        curvePoints.push([pt.x, pt.y]);
    }
    return curvePoints;
}

function animate(ts) {
    if (!animationActive) return;
    if (!lastTimestamp) lastTimestamp = ts;
    let dt = Math.min((ts - lastTimestamp) / 1000, 0.06) * simulationSpeed;
    lastTimestamp = ts;
    for (const obs of obstacles) obs.step(dt);
    blobX -= blobSpeed * dt;
    if (blobX < -blobRadius) blobX = canvas.width + blobRadius;
    let theta = tangentAngles[0];
    let {hits: lidarHits} = get_lidar_hits(points[0], theta);
    // activate avoidance if needed
    if (!avoidanceActive && lidarHits.length > 0) {
        avoidanceActive = true;
        avoidanceRestore = false;
        avoidanceClearTime = null;
        let avoidP2 = compute_avoid_p2(points[0], points[2], lidarHits);
        points[1].x = avoidP2.x;
        points[1].y = avoidP2.y;
        update_spline_from_p1_to_p2();
    }
    // if avoidance is active and no lidar hits, start/reset timer
    if (avoidanceActive && lidarHits.length === 0) {
        if (avoidanceClearTime === null) {
            avoidanceClearTime = ts;
        } else if (ts - avoidanceClearTime > AVOIDANCE_RESET_DELAY) {
            // Instantly snap P2 back to P3 after delay
            points[1].x = points[2].x;
            points[1].y = points[2].y;
            avoidanceActive = false;
            avoidanceClearTime = null;
            update_spline_from_p1_to_p2();
        }
    } else if (lidarHits.length > 0) {
        avoidanceClearTime = null; // reset timer if hits reappear
    }
    if (avoidanceRestore) {
        let dx = points[2].x - points[1].x;
        let dy = points[2].y - points[1].y;
        let dist = Math.hypot(dx, dy);
        let step = Math.min(2000 * dt, dist);
        if (dist > 1) {
            points[1].x += dx / dist * step;
            points[1].y += dy / dist * step;
            update_spline_from_p1_to_p2();
        } else {
            points[1].x = points[2].x;
            points[1].y = points[2].y;
            avoidanceActive = false;
            avoidanceRestore = false;
            update_spline_from_p1_to_p2();
        }
    }
    // FOR INSTANT P2->P3
    /*
    if (avoidanceRestore) {
        points[1].x = points[2].x;
        points[1].y = points[2].y;
        avoidanceActive = false;
        avoidanceRestore = false;
        updateSplineFromCurrentAgentToP2();
    }
     */
    agentArcLen += agentSpeed * dt;
    let totalArcLen = arcLengthTable[arcLengthTable.length - 1].arcLen;
    if (agentArcLen >= totalArcLen) {
        agentArcLen = totalArcLen;
        animationActive = false;
    }
    let t = get_t_for_arclength(arcLengthTable, agentArcLen);
    let p = evaluate_quintic_2d(currentSpline, t);
    let thetaAgent = quintic_tangent(currentSpline, t);
    points[0].x = p.x;
    points[0].y = p.y;
    tangentAngles[0] = thetaAgent;
    for (const agent of agents) {
        agent.step(ts, dt, p);
    }
    sync_svg(agentSvg, points[0], tangentAngles[0], 100);
    sync_svg(blobSvg, {x: BLOB.x, y: BLOB.y}, 0, 3 * blobRadius);
    draw();
    if (animationActive) requestAnimationFrame(animate);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const obstacle of obstacles) obstacle.draw(ctx);
    for (const agent of agents) agent.draw(ctx);
    let curvePoints = spline_get_points();
    let theta = tangentAngles[0];
    let {hits: lidarHits, angles: lidarAngles} = get_lidar_hits(points[0], theta);
    for (let i = 0; i < lidarAngles.length; ++i) {
        let angle = lidarAngles[i];
        let x1 = points[0].x + LIDAR_RANGE * Math.cos(angle);
        let y1 = points[0].y + LIDAR_RANGE * Math.sin(angle);
        draw_line(ctx, [points[0].x, points[0].y], [x1, y1], '#4dd0e1', 1, 0.5);
    }
    for (let hit of lidarHits) {
        draw_circle(ctx, 3, [hit.x, hit.y], '#f00', 1, 1, true)
    }
    draw_text(ctx, [points[2].x - 34, points[2].y + 24], 'Target (P3)', '10px', "#fff");
    draw_text(ctx, [points[1].x - 38, points[1].y - 16], 'Waypoint (P2)', '10px', '#fff');
    draw_text(ctx, [points[0].x - 55, points[0].y - 22], 'Agent (P1)', '10px', '#fff');
    draw_waypoint(ctx, 0, points[0], tangentAngles[0], "#0ff");
    draw_waypoint(ctx, 8, points[1], tangentAngles[1], "#43a047");
    draw_waypoint(ctx, 4, points[2], tangentAngles[2], "#1976d2");
    draw_rectangle(ctx, {coordinate: [points[0].x, points[0].y], orientation: tangentAngles[0], opacityFill: 0.5});
    draw_circle(ctx, LIDAR_RANGE, [points[0].x, points[0].y], '#00bcd4', 1, 0.1, true);
    draw_curve(ctx, curvePoints, '#ffd600', 1, 1, [6, 4]);
}

function draw_waypoint(ctx, radius, position, orientation, color) {
    draw_circle(ctx, radius, [position.x, position.y], color);
    draw_tangent(ctx, position, orientation, color);

}

window.onload = () => {
    /*
    TODO: refactor into Agent class
     */
    points[0] = {...P1_start};
    tangentAngles[0] = P1_start_theta;
    points[1] = {...P3};
    points[2] = {...P3};
    tangentAngles[1] = tangentAngles[2];
    agentArcLen = 0;
    animationActive = true;
    lastTimestamp = null;
    agentDots = [];
    lastDotTime = null;
    avoidanceActive = false;
    avoidanceRestore = false;
    // end TODO
    agents = AGENTS_CONFIG.map(cfg => new Agent(cfg));
    obstacles = OBSTACLES_CONFIG.map(cfg => new Obstacle(cfg));
    update_spline_from_p1_to_p2();
    draw();
    requestAnimationFrame(animate);
};
