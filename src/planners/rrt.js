import {PlannerInterface} from './planner.js';
import {draw_circle, draw_curve, draw_line, draw_text,} from '../canvas.js';

class PlannerRRTStar extends PlannerInterface {
    constructor(parameters = {}) {
        super(parameters);
        let {
            initialX = 0,
            initialY = 0,
            initialOrientation = 0,
            targetX = 100,
            targetY = 100,
            targetOrientation = 0,
            speed = 50,
            name = 'RRT*',
            maxIterations = 1000,
            stepSize = 25,
            goalSampleRate = 0.1, // probability of sampling goal
            rewireRadius = 40,
            minX = 0,
            maxX = 800,
            minY = 0,
            maxY = 600,
        } = parameters;
        this.name = name;
        this.start = {x: initialX, y: initialY};
        this.goal = {x: targetX, y: targetY};
        this.goalOrientation = targetOrientation;
        this.speed = speed;
        this.maxIterations = maxIterations;
        this.stepSize = stepSize;
        this.goalSampleRate = goalSampleRate;
        this.rewireRadius = rewireRadius;
        this.bounds = {minX, maxX, minY, maxY};
        this.nodes = [];
        this.path = null;
        this.pathLength = 0;
        this.sAlong = 0;
        this.initialized = false;
        this.lastCollisionSnapshot = null;
    }

    sample_random() {
        if (Math.random() < this.goalSampleRate) return {x: this.goal.x, y: this.goal.y};
        let x = this.bounds.minX + Math.random() * (this.bounds.maxX - this.bounds.minX);
        let y = this.bounds.minY + Math.random() * (this.bounds.maxY - this.bounds.minY);
        return {x, y};
    }

    dist(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    nearest_node_index(p) {
        let bestIdx = 0;
        let bestD = Infinity;
        for (let i = 0; i < this.nodes.length; i++) {
            let d = this.dist(this.nodes[i], p);
            if (d < bestD) {
                bestD = d;
                bestIdx = i;
            }
        }
        return bestIdx;
    }

    steer(from, to) {
        let d = this.dist(from, to);
        if (d <= this.stepSize) return {x: to.x, y: to.y};
        let ux = (to.x - from.x) / d;
        let uy = (to.y - from.y) / d;
        return {x: from.x + ux * this.stepSize, y: from.y + uy * this.stepSize};
    }

    point_in_circle(px, py, s) {
        let dx = px - s.cx;
        let dy = py - s.cy;
        return dx * dx + dy * dy <= s.r * s.r;
    }

    point_in_rect(px, py, s) {
        let cosA = Math.cos(s.angle || 0);
        let sinA = Math.sin(s.angle || 0);
        let dx = px - s.cx;
        let dy = py - s.cy;
        let lx = cosA * dx + sinA * dy;
        let ly = -sinA * dx + cosA * dy;
        return Math.abs(lx) <= s.w * 0.5 && Math.abs(ly) <= s.h * 0.5;
    }

    point_in_poly(px, py, s) {
        let inside = false;
        let verts = s.vertices || [];
        for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
            let xi = verts[i].x;
            let yi = verts[i].y;
            let xj = verts[j].x;
            let yj = verts[j].y;
            let intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi + 1e-9) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    point_collides(px, py, shapes) {
        for (let s of shapes) {
            if (s.type === 'circle' || s.r != null) {
                if (this.point_in_circle(px, py, s)) return true;
            } else if (s.type === 'rect') {
                if (this.point_in_rect(px, py, s)) return true;
            } else if (s.type === 'poly') {
                if (this.point_in_poly(px, py, s)) return true;
            }
        }
        return false;
    }

    segment_collision_free(a, b, shapes) {
        let steps = Math.ceil(this.dist(a, b) / 5);
        if (steps < 1) steps = 1;
        for (let i = 0; i <= steps; i++) {
            let t = i / steps;
            let px = a.x + t * (b.x - a.x);
            let py = a.y + t * (b.y - a.y);
            if (this.point_collides(px, py, shapes)) return false;
        }
        return true;
    }

    build_tree(shapes) {
        this.nodes = [{x: this.start.x, y: this.start.y, parent: -1, cost: 0}];
        let goalIndex = -1;
        for (let k = 0; k < this.maxIterations; k++) {
            let rnd = this.sample_random();
            let idxNear = this.nearest_node_index(rnd);
            let near = this.nodes[idxNear];
            let newPos = this.steer(near, rnd);
            if (!this.segment_collision_free(near, newPos, shapes)) continue;
            let newNode = {x: newPos.x, y: newPos.y, parent: idxNear, cost: near.cost + this.dist(near, newPos)};
            let neighbors = [];
            for (let i = 0; i < this.nodes.length; i++) {
                if (this.dist(this.nodes[i], newNode) <= this.rewireRadius) neighbors.push(i);
            }
            let minCost = newNode.cost;
            let bestParent = idxNear;
            for (let i of neighbors) {
                let cand = this.nodes[i];
                let candCost = cand.cost + this.dist(cand, newNode);
                if (candCost < minCost && this.segment_collision_free(cand, newNode, shapes)) {
                    minCost = candCost;
                    bestParent = i;
                }
            }
            newNode.cost = minCost;
            newNode.parent = bestParent;
            let newIndex = this.nodes.length;
            this.nodes.push(newNode);
            for (let i of neighbors) {
                let cand = this.nodes[i];
                let throughNew = newNode.cost + this.dist(newNode, cand);
                if (throughNew + 1e-6 < cand.cost && this.segment_collision_free(newNode, cand, shapes)) {
                    cand.parent = newIndex;
                    cand.cost = throughNew;
                }
            }
            if (this.dist(newNode, this.goal) < this.stepSize && this.segment_collision_free(newNode, this.goal, shapes)) {
                goalIndex = newIndex;
                break;
            }
        }
        if (goalIndex === -1) return false;
        this.build_path_from_goal(goalIndex, shapes);
        return true;
    }

    build_path_from_goal(goalIndex, shapes) {
        let path = [];
        let idx = goalIndex;
        while (idx !== -1) {
            let n = this.nodes[idx];
            path.push({x: n.x, y: n.y});
            idx = n.parent;
        }
        path.reverse();
        let last = path[path.length - 1];
        if (this.segment_collision_free(last, this.goal, shapes)) path.push({x: this.goal.x, y: this.goal.y});
        this.path = path;
        this.pathLength = 0;
        for (let i = 1; i < this.path.length; i++) this.pathLength += this.dist(this.path[i - 1], this.path[i]);
        this.sAlong = 0;
    }

    get_pose_along_path(s) {
        if (!this.path || this.path.length === 0) return {x: this.start.x, y: this.start.y, orientation: 0};
        if (s <= 0) {
            let p0 = this.path[0];
            let p1 = this.path[1] || this.path[0];
            let th = Math.atan2(p1.y - p0.y, p1.x - p0.x);
            return {x: p0.x, y: p0.y, orientation: th};
        }
        if (s >= this.pathLength) {
            let n = this.path.length;
            let p0 = this.path[n - 2] || this.path[n - 1];
            let p1 = this.path[n - 1];
            let th = Math.atan2(p1.y - p0.y, p1.x - p0.x);
            return {x: p1.x, y: p1.y, orientation: th};
        }
        let acc = 0;
        for (let i = 1; i < this.path.length; i++) {
            let a = this.path[i - 1];
            let b = this.path[i];
            let segL = this.dist(a, b);
            if (acc + segL >= s) {
                let t = (s - acc) / segL;
                let x = a.x + t * (b.x - a.x);
                let y = a.y + t * (b.y - a.y);
                let th = Math.atan2(b.y - a.y, b.x - a.x);
                return {x, y, orientation: th};
            }
            acc += segL;
        }
        let last = this.path[this.path.length - 1];
        return {x: last.x, y: last.y, orientation: 0};
    }

    update(ts, dt, agent, collision_geometry_get) {
        let shapes = collision_geometry_get(agent.name);
        let hits = [];
        if (agent.lidar && typeof agent.lidar.get_lidar_hits === 'function') {
            let res = agent.lidar.get_lidar_hits(() => collision_geometry_get(agent.name));
            hits = res.hits || [];
        }
        let needReplan = false;
        if (!this.initialized || !this.path || this.path.length < 2) needReplan = true;
        if (hits.length > 0) needReplan = true;
        if (needReplan) {
            this.start = {x: agent.position.x, y: agent.position.y};
            this.goal = {
                x: agent.targetX != null ? agent.targetX : this.goal.x,
                y: agent.targetY != null ? agent.targetY : this.goal.y,
            };
            this.initialized = this.build_tree(shapes);
            this.lastCollisionSnapshot = shapes.length;
            this.sAlong = 0;
        }
        if (!this.initialized || !this.path) {
            return {
                x: agent.position.x,
                y: agent.position.y,
                orientation: agent.orientation,
            };
        }
        this.sAlong += this.speed * dt;
        if (this.sAlong > this.pathLength) this.sAlong = this.pathLength;
        let pose = this.get_pose_along_path(this.sAlong);
        return pose;
    }

    draw(ctx) {
        if (this.nodes && this.nodes.length > 0) {
            ctx.save();
            ctx.globalAlpha = 0.3;
            for (let i = 1; i < this.nodes.length; i++) {
                let n = this.nodes[i];
                let p = this.nodes[n.parent];
                draw_line(ctx, {start: [p.x, p.y], end: [n.x, n.y], color: '#aaa', linewidth: 1, opacity: 0.4});
            }
            ctx.restore();
        }
        if (this.path && this.path.length > 1) {
            let pts = this.path.map(p => [p.x, p.y]);
            draw_curve(ctx, pts, {color: '#ff9800', linewidth: 2, opacity: 1, dash: [4, 4]});
        }
        draw_circle(ctx, {
            radius: 4,
            centroid: [this.start.x, this.start.y],
            colorFill: '#0f0',
            colorOutline: '#0a0',
            opacityFill: 1,
            opacityOutline: 1
        });
        draw_circle(ctx, {
            radius: 4,
            centroid: [this.goal.x, this.goal.y],
            colorFill: '#f00',
            colorOutline: '#a00',
            opacityFill: 1,
            opacityOutline: 1
        });
        draw_text(ctx, {coordinate: [this.start.x + 6, this.start.y - 6], text: this.name, color: '#666'});
    }
}

export {
    PlannerRRTStar,
};
