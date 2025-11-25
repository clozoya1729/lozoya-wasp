function evaluate_quintic(coefs, t) {
    return coefs[0] + coefs[1] * t + coefs[2] * t ** 2 + coefs[3] * t ** 3 + coefs[4] * t ** 4 + coefs[5] * t ** 5;
}

function evaluate_quintic_2d(poly, t) {
    return {x: evaluate_quintic(poly.cx, t), y: evaluate_quintic(poly.cy, t)};
}

function fit_quintic(Pa, va, Pb, vb) {
    const A = [
        [1, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 0],
        [0, 0, 2, 0, 0, 0],
        [1, 1, 1, 1, 1, 1],
        [0, 1, 2, 3, 4, 5],
        [0, 0, 2, 6, 12, 20]
    ];

    function solve(Pa, va, Pb, vb) {
        const b = [Pa, va, 0, Pb, vb, 0];
        return math.lusolve(A, b).map(r => r[0]);
    }

    return {cx: solve(Pa.x, va.x, Pb.x, vb.x), cy: solve(Pa.y, va.y, Pb.y, vb.y)};
}

function tangent_vector(theta, mag) {
    return {x: mag * Math.cos(theta), y: mag * Math.sin(theta)};
}

function quintic_tangent(poly, t) {
    const dx = poly.cx[1] + 2 * poly.cx[2] * t + 3 * poly.cx[3] * t ** 2 + 4 * poly.cx[4] * t ** 3 + 5 * poly.cx[5] * t ** 4;
    const dy = poly.cy[1] + 2 * poly.cy[2] * t + 3 * poly.cy[3] * t ** 2 + 4 * poly.cy[4] * t ** 3 + 5 * poly.cy[5] * t ** 4;
    return Math.atan2(dy, dx);
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

function get_t_for_arc_length(table, s) {
    if (s <= 0) return 0;
    if (s >= table[table.length - 1].arcLen) return 1;
    for (let i = 1; i < table.length; ++i) {
        if (s <= table[i].arcLen) {
            let t0 = table[i - 1].t;
            let t1 = table[i].t;
            let s0 = table[i - 1].arcLen;
            let s1 = table[i].arcLen;
            let f = (s - s0) / (s1 - s0);
            return t0 + f * (t1 - t0);
        }
    }
    return 1;
}

function gaussian_noise(mean = 0, stdDev = 1) {
    let u1 = Math.random();
    let u2 = Math.random();
    let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stdDev + mean;
}

function angle_difference(a, b) {
    return ((a - b + Math.PI) % (2 * Math.PI)) - Math.PI;
}

function smooth(data, windowSize = 7) {
    // smooth data with moving average
    let smoothed = [];
    for (let i = 0; i < data.length; ++i) {
        let start = Math.max(0, i - Math.floor(windowSize / 2));
        let end = Math.min(data.length - 1, i + Math.floor(windowSize / 2));
        let sum = 0, count = 0;
        for (let j = start; j <= end; ++j) {
            sum += data[j];
            count++;
        }
        smoothed.push(sum / count);
    }
    return smoothed;
}

function derivative_central(data, time) {
    // central difference derivative with variable timestep
    let result = [];
    for (let i = 0; i < data.length; i++) {
        if (i === 0) { // forward difference at start
            let dt = time[i + 1] - time[i];
            if (dt === 0) dt = 1e-6;
            result.push((data[i + 1] - data[i]) / dt);
        } else if (i === data.length - 1) { // backward difference at end
            let dt = time[i] - time[i - 1];
            if (dt === 0) dt = 1e-6;
            result.push((data[i] - data[i - 1]) / dt);
        } else { // central difference
            let dt = time[i + 1] - time[i - 1];
            if (dt === 0) dt = 1e-6;
            result.push((data[i + 1] - data[i - 1]) / dt);
        }
    }
    return result;
}


export {
    evaluate_quintic,
    fit_quintic,
    evaluate_quintic_2d,
    tangent_vector,
    quintic_tangent,
    compute_arc_length_table,
    get_t_for_arc_length,
    gaussian_noise,
    angle_difference,
    smooth,
    derivative_central
}
