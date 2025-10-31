function evaluate_quintic(coefs, t) {
    return coefs[0] + coefs[1] * t + coefs[2] * t ** 2 + coefs[3] * t ** 3 + coefs[4] * t ** 4 + coefs[5] * t ** 5;
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

function evaluate_quintic_2d(poly, t) {
    return {x: evaluate_quintic(poly.cx, t), y: evaluate_quintic(poly.cy, t)};
}

function tangent_vector(theta, mag) {
    return {x: mag * Math.cos(theta), y: mag * Math.sin(theta)};
}

function quintic_tangent(poly, t) {
    const dx = poly.cx[1] + 2 * poly.cx[2] * t + 3 * poly.cx[3] * t ** 2 + 4 * poly.cx[4] * t ** 3 + 5 * poly.cx[5] * t ** 4;
    const dy = poly.cy[1] + 2 * poly.cy[2] * t + 3 * poly.cy[3] * t ** 2 + 4 * poly.cy[4] * t ** 3 + 5 * poly.cy[5] * t ** 4;
    return Math.atan2(dy, dx);
}

export {
    evaluate_quintic,
    fit_quintic,
    evaluate_quintic_2d,
    tangent_vector,
    quintic_tangent,
}
