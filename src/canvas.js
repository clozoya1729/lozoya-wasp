let COLLISION_SHAPES = [];

class SVG {
    constructor(canvas, templateId, parameters = {}) {
        let {
            anchor = 'origin',
            orientation = 0,
            position = {x: 0, y: 0},
            size = 100,
            zIndex = 10,
        } = parameters;
        this.canvas = canvas;
        this.anchor = anchor;
        this.orientation = orientation;
        this.position = position;
        this.size = size;
        this.templateId = templateId;
        this.template = document.getElementById(this.templateId);
        if (!this.template) {
            throw new Error('SVG template not found: ' + this.templateId);
        }
        this.svg = this.template.cloneNode(true);
        this.svg.removeAttribute('id');
        this.svg.style.position = 'absolute';
        this.svg.style.left = '0px';
        this.svg.style.top = '0px';
        this.svg.style.width = size + 'px';
        this.svg.style.height = size + 'px';
        this.svg.style.pointerEvents = 'none';
        this.svg.style.transformBox = 'fill-box';
        this.svg.style.zIndex = String(zIndex);
        this.svg.dataset.anchor = anchor;
        this.svg.style.transformOrigin = this.svg.dataset.anchor === 'origin' ? '0 0' : '50% 50%';
        document.body.appendChild(this.svg);
    }

    sync() {
        const rect = this.canvas.getBoundingClientRect();
        const sx = rect.width / this.canvas.width;
        const sy = rect.height / this.canvas.height;
        if (this.size != null) {
            this.svg.style.width = this.size + 'px';
            this.svg.style.height = this.size + 'px';
        }
        const w = parseFloat(this.svg.style.width) || this.size;
        const h = parseFloat(this.svg.style.height) || w;
        const left = rect.left + window.scrollX + this.position.x * sx - (this.anchor === 'center' ? w / 2 : 0);
        const top = rect.top + window.scrollY + this.position.y * sy - (this.anchor === 'center' ? h / 2 : 0);
        this.svg.style.left = left + 'px';
        this.svg.style.top = top + 'px';
        if (this.orientation != null) {
            this.svg.style.transform = 'rotate(' + (this.orientation * 180 / Math.PI) + 'deg)';
        }
    }
}

// global camera state
let CAMERA = {
    center: {x: 0, y: 0},
    zoom: 1
};

function camera_set(parameters = {}) {
    // set new camera parameters
    const {center, zoom} = parameters;
    if (center) {
        CAMERA.center.x = center.x;
        CAMERA.center.y = center.y;
    }
    if (zoom !== undefined) {
        CAMERA.zoom = Math.max(0.01, zoom); // avoid negative/zero zoom
    }
}

function camera_apply(ctx) {
    // apply camera transform before drawing
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);     // reset
    ctx.translate(w / 2, h / 2);            // move to canvas center
    ctx.scale(CAMERA.zoom, CAMERA.zoom);    // zoom
    ctx.translate(-CAMERA.center.x, -CAMERA.center.y); // center view on target
}

function camera_reset(ctx) {
    // restore normal canvas transform after drawing
    ctx.setTransform(1, 0, 0, 1, 0, 0);
}


function draw_circle(ctx, parameters = {}) {
    let {
        radius = 1,
        centroid = [0, 0],
        colorFill = '#fff',
        colorOutline = '#fff',
        opacityFill = 0.1,
        opacityOutline = 1,
        linewidth = 1,
        dash = [],
        collision = false,
        meta = null,
    } = parameters;
    ctx.save();
    ctx.lineWidth = linewidth;
    ctx.strokeStyle = colorOutline;
    ctx.globalAlpha = opacityOutline;
    ctx.beginPath();
    ctx.arc(centroid[0], centroid[1], radius, 0, 2 * Math.PI);
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.globalAlpha = opacityFill;
    ctx.fillStyle = colorFill;
    ctx.fill();
    ctx.setLineDash([]);
    ctx.restore();
    if (collision) {
        collision_geometry_register({type: 'circle', cx: centroid[0], cy: centroid[1], r: radius, meta});
    }
}

function draw_curve(ctx, points, parameters = {}) {
    let {
        color = '#888',
        linewidth = 1,
        opacity = 1,
        dash = [],
    } = parameters;
    if (!points || points.length === 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = linewidth;
    ctx.globalAlpha = opacity;
    if (dash && dash.length) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
    }
    ctx.stroke();
    if (dash && dash.length) ctx.setLineDash([]);
    ctx.restore();
}

function draw_grid_axes(ctx, parameters = {}) {
    let {
        origin = [0, 0],
        xStep = 50,
        yStep = 50,
        colorGrid = '#888',
        colorAxes = '#000',
        lineWidthGrid = 1,
        lineWidthAxes = 1,
        opacityGrid = 0.2,
        opacityAxes = 1,
        dashGrid = [],
        dashAxes = [],
        drawTickMarks = true,
        labelTicks = true,
        tickSize = 6,            // tick size in pixels
        font = '10pt Times New Roman',     // label font
        labelOffset = 3          // small padding for text
    } = parameters;
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const x0 = origin[0];
    const y0 = origin[1];
    ctx.save();
    // GRID LINES
    ctx.lineWidth = lineWidthGrid;
    ctx.strokeStyle = colorGrid;
    ctx.globalAlpha = opacityGrid;
    if (dashGrid.length) ctx.setLineDash(dashGrid);
    // vertical grid lines
    if (xStep > 0) {
        for (let x = x0; x <= w; x += xStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let x = x0 - xStep; x >= 0; x -= xStep) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
    }
    // horizontal grid lines
    if (yStep > 0) {
        for (let y = y0; y <= h; y += yStep) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        for (let y = y0 - yStep; y >= 0; y -= yStep) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
    }
    // AXES
    ctx.setLineDash([]);
    ctx.lineWidth = lineWidthAxes;
    ctx.strokeStyle = colorAxes;
    ctx.globalAlpha = opacityAxes;
    if (dashAxes.length) ctx.setLineDash(dashAxes);
    // y-axis
    if (x0 >= 0 && x0 <= w) {
        ctx.beginPath();
        ctx.moveTo(x0, 0);
        ctx.lineTo(x0, h);
        ctx.stroke();
    }
    // x-axis
    if (y0 >= 0 && y0 <= h) {
        ctx.beginPath();
        ctx.moveTo(0, y0);
        ctx.lineTo(w, y0);
        ctx.stroke();
    }
    // TICKS & LABELS
    if (drawTickMarks || labelTicks) {
        ctx.setLineDash([]);
        ctx.strokeStyle = colorAxes;
        ctx.fillStyle = colorAxes;
        ctx.lineWidth = 1;
        ctx.font = font;
        ctx.globalAlpha = opacityAxes;
        // ticks along x-axis (horizontal axis)
        if (y0 >= 0 && y0 <= h && xStep > 0) {
            for (let x = x0; x <= w; x += xStep) {
                if (drawTickMarks) {
                    ctx.beginPath();
                    ctx.moveTo(x, y0 - tickSize / 2);
                    ctx.lineTo(x, y0 + tickSize / 2);
                    ctx.stroke();
                }
                if (labelTicks) {
                    const text = String(x - x0);
                    const width = ctx.measureText(text).width;
                    ctx.fillText(
                        text,
                        x - width / 2,                   // CENTER horizontally
                        y0 - tickSize - labelOffset      // above axis
                    );
                }
            }
            for (let x = x0 - xStep; x >= 0; x -= xStep) {
                if (drawTickMarks) {
                    ctx.beginPath();
                    ctx.moveTo(x, y0 - tickSize / 2);
                    ctx.lineTo(x, y0 + tickSize / 2);
                    ctx.stroke();
                }
                if (labelTicks) {
                    const text = String(x - x0);
                    const width = ctx.measureText(text).width;
                    ctx.fillText(
                        text,
                        x - width / 2,                   // CENTER horizontally
                        y0 - tickSize - labelOffset
                    );
                }
            }
        }
        // ticks along y-axis (vertical axis)
        if (x0 >= 0 && x0 <= w && yStep > 0) {
            for (let y = y0; y <= h; y += yStep) {
                if (drawTickMarks) {
                    ctx.beginPath();
                    ctx.moveTo(x0 - tickSize / 2, y);
                    ctx.lineTo(x0 + tickSize / 2, y);
                    ctx.stroke();
                }
                if (labelTicks) {
                    const value = y - y0; // y increases downward
                    const text = String(value);
                    const width = ctx.measureText(text).width;
                    ctx.fillText(
                        text,
                        x0 - tickSize - labelOffset - width, // LEFT of axis
                        y + labelOffset
                    );
                }
            }
            for (let y = y0 - yStep; y >= 0; y -= yStep) {
                if (drawTickMarks) {
                    ctx.beginPath();
                    ctx.moveTo(x0 - tickSize / 2, y);
                    ctx.lineTo(x0 + tickSize / 2, y);
                    ctx.stroke();
                }
                if (labelTicks) {
                    const value = y - y0; // y increases downward
                    const text = String(value);
                    const width = ctx.measureText(text).width;
                    ctx.fillText(
                        text,
                        x0 - tickSize - labelOffset - width, // LEFT of axis
                        y + labelOffset
                    );
                }
            }
        }
    }
    ctx.restore();
}

function draw_grid_axes_box(ctx, parameters = {}) {
    let {
        boxOrigin = [0, 0],   // top-left corner of box (pixel coords)
        boxWidth = 400,
        boxHeight = 300,
        origin = [0, 0],      // logical origin inside the box (pixel coords)
        xStep = 50,
        yStep = 50,
        colorGrid = '#888',
        colorAxes = '#000',
        lineWidthGrid = 1,
        lineWidthAxes = 1,
        opacityGrid = 0.2,
        opacityAxes = 1,
        dashGrid = [],
        dashAxes = [],
        drawTickMarks = true,
        labelTicks = true,
        tickSize = 6,
        font = '8pt Times New Roman',
        labelOffset = 3
    } = parameters;
    const boxLeft = boxOrigin[0];
    const boxTop = boxOrigin[1];
    const boxRight = boxLeft + boxWidth;
    const boxBottom = boxTop + boxHeight;
    const x0 = origin[0];
    const y0 = origin[1];
    ctx.save();
    // GRID LINES (clipped to box only)
    ctx.save();
    ctx.beginPath();
    ctx.rect(boxLeft, boxTop, boxWidth, boxHeight);
    ctx.clip();
    ctx.lineWidth = lineWidthGrid;
    ctx.strokeStyle = colorGrid;
    ctx.globalAlpha = opacityGrid;
    if (dashGrid.length) ctx.setLineDash(dashGrid);
    if (xStep > 0) {
        for (let x = x0; x <= boxRight; x += xStep) {
            if (x < boxLeft) continue;
            ctx.beginPath();
            ctx.moveTo(x, boxTop);
            ctx.lineTo(x, boxBottom);
            ctx.stroke();
        }
        for (let x = x0 - xStep; x >= boxLeft; x -= xStep) {
            if (x > boxRight) continue;
            ctx.beginPath();
            ctx.moveTo(x, boxTop);
            ctx.lineTo(x, boxBottom);
            ctx.stroke();
        }
    }
    if (yStep > 0) {
        for (let y = y0; y <= boxBottom; y += yStep) {
            if (y < boxTop) continue;
            ctx.beginPath();
            ctx.moveTo(boxLeft, y);
            ctx.lineTo(boxRight, y);
            ctx.stroke();
        }
        for (let y = y0 - yStep; y >= boxTop; y -= yStep) {
            if (y > boxBottom) continue;
            ctx.beginPath();
            ctx.moveTo(boxLeft, y);
            ctx.lineTo(boxRight, y);
            ctx.stroke();
        }
    }
    ctx.restore(); // end grid clipping
    // AXES (mirrored on box edges, not clipped)
    ctx.setLineDash([]);
    ctx.lineWidth = lineWidthAxes;
    ctx.strokeStyle = colorAxes;
    ctx.globalAlpha = opacityAxes;
    if (dashAxes.length) ctx.setLineDash(dashAxes);
    ctx.beginPath();
    ctx.moveTo(boxLeft, boxTop);
    ctx.lineTo(boxLeft, boxBottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(boxRight, boxTop);
    ctx.lineTo(boxRight, boxBottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(boxLeft, boxTop);
    ctx.lineTo(boxRight, boxTop);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(boxLeft, boxBottom);
    ctx.lineTo(boxRight, boxBottom);
    ctx.stroke();
    // TICKS & LABELS (top / left only labeled)
    if (drawTickMarks || labelTicks) {
        ctx.setLineDash([]);
        ctx.strokeStyle = colorAxes;
        ctx.fillStyle = colorAxes;
        ctx.lineWidth = 1;
        ctx.font = font;
        ctx.globalAlpha = opacityAxes;
        // X ticks: mirror on top and bottom
        if (xStep > 0) {
            for (let x = x0; x <= boxRight; x += xStep) {
                if (x < boxLeft) continue;
                if (drawTickMarks) {
                    ctx.beginPath();
                    ctx.moveTo(x, boxTop);
                    ctx.lineTo(x, boxTop + tickSize);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(x, boxBottom - tickSize);
                    ctx.lineTo(x, boxBottom);
                    ctx.stroke();
                }
                if (labelTicks) {
                    const text = String(x - x0);
                    const width = ctx.measureText(text).width;
                    ctx.fillText(text, x - width / 2, boxTop - labelOffset);
                }
            }
            for (let x = x0 - xStep; x >= boxLeft; x -= xStep) {
                if (x > boxRight) continue;
                if (drawTickMarks) {
                    ctx.beginPath();
                    ctx.moveTo(x, boxTop);
                    ctx.lineTo(x, boxTop + tickSize);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(x, boxBottom - tickSize);
                    ctx.lineTo(x, boxBottom);
                    ctx.stroke();
                }
                if (labelTicks) {
                    const text = String(x - x0);
                    const width = ctx.measureText(text).width;
                    ctx.fillText(text, x - width / 2, boxTop - labelOffset);
                }
            }
        }
        // Y ticks: mirror on left and right
        if (yStep > 0) {
            for (let y = y0; y <= boxBottom; y += yStep) {
                if (y < boxTop) continue;
                const value = y - y0;
                const text = String(value);
                const width = ctx.measureText(text).width;
                if (drawTickMarks) {
                    ctx.beginPath();
                    ctx.moveTo(boxLeft, y);
                    ctx.lineTo(boxLeft + tickSize, y);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(boxRight - tickSize, y);
                    ctx.lineTo(boxRight, y);
                    ctx.stroke();
                }
                if (labelTicks) {
                    ctx.fillText(text, boxLeft - labelOffset - width, y + labelOffset);
                }
            }
            for (let y = y0 - yStep; y >= boxTop; y -= yStep) {
                if (y > boxBottom) continue;
                const value = y - y0;
                const text = String(value);
                const width = ctx.measureText(text).width;
                if (drawTickMarks) {
                    ctx.beginPath();
                    ctx.moveTo(boxLeft, y);
                    ctx.lineTo(boxLeft + tickSize, y);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(boxRight - tickSize, y);
                    ctx.lineTo(boxRight, y);
                    ctx.stroke();
                }
                if (labelTicks) {
                    ctx.fillText(text, boxLeft - labelOffset - width, y + labelOffset);
                }
            }
        }
    }

    ctx.restore();
}

function draw_line(ctx, parameters = {}) {
    let {
        start = [0, 0],
        end = [1, 1],
        color = '#888',
        linewidth = 1,
        opacity = 1,
        dash = [],
    } = parameters;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = linewidth;
    ctx.globalAlpha = opacity;
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    ctx.lineTo(end[0], end[1]);
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

function draw_rectangle(ctx, parameters = {}) {
    let {
        coordinate = [0, 0],
        width = 20,
        height = 10,
        orientation = 0,
        colorFill = '#0ff',
        colorOutline = '#fff',
        opacityFill = 0.1,
        opacityOutline = 1,
        collision = false,
        meta = null,
    } = parameters;
    ctx.save();
    ctx.translate(coordinate[0], coordinate[1]);
    ctx.rotate(orientation);
    ctx.beginPath();
    ctx.rect(-width / 2, -height / 2, width, height);
    ctx.fillStyle = colorFill;
    ctx.globalAlpha = opacityFill;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = colorOutline;
    ctx.globalAlpha = opacityOutline;
    ctx.stroke();
    ctx.restore();
    if (collision) {
        collision_geometry_register({
            type: 'rect',
            cx: coordinate[0],
            cy: coordinate[1],
            w: width,
            h: height,
            angle: orientation,
            meta
        });
    }

}

function draw_robot_arm(ctx, parameters = {}) {
    let {
        scale = 1,
        name = '',
        position = {x: 0, y: 0},
        orientation = 0,
        colorBodyFill = '#888',
        colorBodyOutline = '#000',
        collision = false,
        meta = null,
    } = parameters;
    const s = scale;
    let frame = {
        x: position.x,
        y: position.y,
        angle: orientation,
    };
    const stack = [];

    function pushFrame() {
        stack.push({...frame});
    }

    function popFrame() {
        frame = stack.pop();
    }

    function rotateFrame(delta) {
        frame.angle += delta;
    }

    function translateFrameLocal(dx, dy) {
        const cosA = Math.cos(frame.angle);
        const sinA = Math.sin(frame.angle);
        frame.x += s * (dx * cosA - dy * sinA);
        frame.y += s * (dx * sinA + dy * cosA);
    }

    function worldPoint(localX, localY) {
        const cosA = Math.cos(frame.angle);
        const sinA = Math.sin(frame.angle);
        return {
            x: frame.x + s * (localX * cosA - localY * sinA),
            y: frame.y + s * (localX * sinA + localY * cosA),
        };
    }

    // base at origin
    draw_rectangle(ctx, {
        coordinate: [position.x, position.y],
        orientation: orientation,
        colorFill: colorBodyFill,
        colorOutline: colorBodyOutline,
        height: 30,
        width: 30,
        opacityFill: 0.5,
        collision: collision,
        meta: meta,
    });
    {
        const c = worldPoint(0, 0);
        draw_circle(ctx, {
            radius: 10 * s,
            centroid: [c.x, c.y],
            colorFill: '#f64',
            colorOutline: '#000',
            opacityFill: 1,
            opacityOutline: 1,
            collision: collision,
            meta,
        });
    }
    // first link
    pushFrame();
    rotateFrame(0);
    {
        const cRect = worldPoint(22.5, 0);
        draw_rectangle(ctx, {
            coordinate: [cRect.x, cRect.y],
            width: 45 * s,
            height: 12 * s,
            orientation: frame.angle,
            colorFill: '#aaa',
            colorOutline: '#000',
            opacityFill: 1,
            opacityOutline: 1,
            collision: collision,
            meta,
        });
        const cCircle = worldPoint(45, 0);
        draw_circle(ctx, {
            radius: 8 * s,
            centroid: [cCircle.x, cCircle.y],
            colorFill: '#f64',
            colorOutline: '#000',
            opacityFill: 1,
            opacityOutline: 1,
            collision: collision,
            meta,
        });
        // second link
        pushFrame();
        translateFrameLocal(45, 0);
        rotateFrame(-25 * Math.PI / 180);
        {
            const cRect2 = worldPoint(20, 0);
            draw_rectangle(ctx, {
                coordinate: [cRect2.x, cRect2.y],
                width: 40 * s,
                height: 10 * s,
                orientation: frame.angle,
                colorFill: '#888',
                colorOutline: '#000',
                opacityFill: 1,
                opacityOutline: 1,
                collision: collision,
                meta,
            });
            const cCircle2 = worldPoint(40, 0);
            draw_circle(ctx, {
                radius: 7 * s,
                centroid: [cCircle2.x, cCircle2.y],
                colorFill: '#f64',
                colorOutline: '#000',
                opacityFill: 1,
                opacityOutline: 1,
                collision: collision,
                meta,
            });
            // third link
            pushFrame();
            translateFrameLocal(40, 0);
            rotateFrame(30 * Math.PI / 180);
            {
                const cRect3 = worldPoint(17.5, 0);
                draw_rectangle(ctx, {
                    coordinate: [cRect3.x, cRect3.y],
                    width: 35 * s,
                    height: 8 * s,
                    orientation: frame.angle,
                    colorFill: '#aaa',
                    colorOutline: '#000',
                    opacityFill: 1,
                    opacityOutline: 1,
                    collision: collision,
                    meta,
                });
                const cCircle3 = worldPoint(35, 0);
                draw_circle(ctx, {
                    radius: 6 * s,
                    centroid: [cCircle3.x, cCircle3.y],
                    colorFill: '#f64',
                    colorOutline: '#000',
                    opacityFill: 1,
                    opacityOutline: 1,
                    collision: collision,
                    meta,
                });
                // end effector (gripper)
                pushFrame();
                translateFrameLocal(35, 0);
                {
                    const cBlock = worldPoint(3, 0);
                    draw_rectangle(ctx, {
                        coordinate: [cBlock.x, cBlock.y],
                        width: 18 * s,
                        height: 20 * s,
                        orientation: frame.angle,
                        colorFill: '#888',
                        colorOutline: '#000',
                        opacityFill: 1,
                        opacityOutline: 1,
                        collision: collision,
                        meta,
                    });
                    const cBarTop = worldPoint(25, -13);
                    draw_rectangle(ctx, {
                        coordinate: [cBarTop.x, cBarTop.y],
                        width: 26 * s,
                        height: 6 * s,
                        orientation: frame.angle,
                        colorFill: '#888',
                        colorOutline: '#000',
                        opacityFill: 1,
                        opacityOutline: 1,
                        collision: collision,
                        meta,
                    });
                    const cBarBot = worldPoint(25, 13);
                    draw_rectangle(ctx, {
                        coordinate: [cBarBot.x, cBarBot.y],
                        width: 26 * s,
                        height: 6 * s,
                        orientation: frame.angle,
                        colorFill: '#888',
                        colorOutline: '#000',
                        opacityFill: 1,
                        opacityOutline: 1,
                        collision: collision,
                        meta,
                    });
                    const cTipTop = worldPoint(38, -13);
                    draw_rectangle(ctx, {
                        coordinate: [cTipTop.x, cTipTop.y],
                        width: 4 * s,
                        height: 6 * s,
                        orientation: frame.angle,
                        colorFill: '#888',
                        colorOutline: '#000',
                        opacityFill: 1,
                        opacityOutline: 1,
                        collision: collision,
                        meta,
                    });
                    const cTipBot = worldPoint(38, 13);
                    draw_rectangle(ctx, {
                        coordinate: [cTipBot.x, cTipBot.y],
                        width: 4 * s,
                        height: 6 * s,
                        orientation: frame.angle,
                        colorFill: '#888',
                        colorOutline: '#000',
                        opacityFill: 1,
                        opacityOutline: 1,
                        collision: collision,
                        meta,
                    });
                }
                popFrame();
            }
            popFrame();
        }
        popFrame();
    }
    popFrame();
}

function draw_square(ctx, parameters = {}) {
    let {size = 12, ...rest} = parameters;
    draw_rectangle(ctx, {width: size, height: size, ...rest});
}

function draw_tangent(ctx, parameters = {}) {
    let {
        start = [0, 0],
        length = 100,
        angle = 0,
        color = '#888',
        linewidth = 1,
        opacity = 1,
        dash = [],
    } = parameters;
    let end = [start[0] + length * Math.cos(angle), start[1] + length * Math.sin(angle)];
    draw_line(ctx, {
        start: start,
        end: end,
        color: color,
        linewidth: linewidth,
        opacity: opacity,
        dash: dash,
    })
}

function draw_text(ctx, parameters = {}) {
    let {
        coordinate = [0, 0],
        text = 'TEXT',
        font = '10pt Times New Roman',
        color = '#888',
        opacity = 1,
    } = parameters;
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(text, coordinate[0], coordinate[1]);
    ctx.restore();
}

function draw_triangle(ctx, parameters = {}) {
    let {
        coordinate = [0, 0],
        orientation = 0,
        size = 1,
        colorFill = '#0ff',
        colorOutline = '#fff',
        opacityFill = 0.1,
        opacityOutline = 1,
        collision = false,
        meta = null,
    } = parameters;
    ctx.save();
    ctx.translate(coordinate[0], coordinate[1]);
    ctx.rotate(orientation);
    ctx.beginPath();
    ctx.moveTo(-size, -size);
    ctx.lineTo(1.2 * size, 0);
    ctx.lineTo(-size, size);
    ctx.closePath();
    ctx.fillStyle = colorFill;
    ctx.globalAlpha = opacityFill;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = colorOutline;
    ctx.globalAlpha = opacityOutline;
    ctx.stroke();
    ctx.rotate(-orientation);
    ctx.restore();
    if (collision) {
        const cosA = Math.cos(orientation);
        const sinA = Math.sin(orientation);
        const ptsLocal = [
            {x: -6, y: -6},
            {x: 6, y: 0},
            {x: -6, y: 6},
        ];
        const verts = ptsLocal.map(p => ({
            x: coordinate[0] + p.x * cosA - p.y * sinA,
            y: coordinate[1] + p.x * sinA + p.y * cosA,
        }));
        collision_geometry_register({type: 'poly', vertices: verts, meta});
    }
}

function draw_truss(ctx, parameters = {}) {
    let {
        elements = null,
        nodes = null,
        coordinate = [0, 0],
        orientation = 0,
        thickness = 6,
        colorOutline = '#000',
        colorFill = '#888',
        collision = false,
        meta = null,
    } = parameters;
    ctx.save();
    ctx.translate(coordinate[0], coordinate[1]);
    ctx.rotate(orientation);
    for (let k = 0; k < elements.length; k++) {
        let i = elements[k][0];
        let j = elements[k][1];
        let x1 = nodes[i][0];
        let y1 = nodes[i][1];
        let x2 = nodes[j][0];
        let y2 = nodes[j][1];
        let dx = x2 - x1;
        let dy = y2 - y1;
        let L = Math.sqrt(dx * dx + dy * dy);
        let angleLocal = Math.atan2(dy, dx);
        let cxLocal = (x1 + x2) / 2;
        let cyLocal = (y1 + y2) / 2;
        draw_rectangle(ctx, {
            coordinate: [cxLocal, cyLocal],
            width: L,
            height: thickness,
            orientation: angleLocal,
            colorFill: colorFill,
            colorOutline: colorOutline,
            opacityFill: 0.5,
            opacityOutline: 0.5,
        });
        if (collision) {
            const cosT = Math.cos(orientation);
            const sinT = Math.sin(orientation);
            const gx = coordinate[0] + cxLocal * cosT - cyLocal * sinT;
            const gy = coordinate[1] + cxLocal * sinT + cyLocal * cosT;
            const angleGlobal = orientation + angleLocal;
            collision_geometry_register({
                type: 'rect',
                cx: gx,
                cy: gy,
                w: L,
                h: thickness,
                angle: angleGlobal,
                meta: meta ?? {kind: 'truss', elementIndex: k}
            });
        }
    }
    ctx.restore();
}

function collision_geometry_reset() {
    COLLISION_SHAPES = [];
}

function collision_geometry_register(shape) {
    COLLISION_SHAPES.push(shape);
}

function collision_geometry_get(exclude) {
    return COLLISION_SHAPES.filter(s => !(s.meta && s.meta.name === exclude));
}

export {
    camera_apply,
    camera_reset,
    camera_set,
    collision_geometry_register,
    collision_geometry_reset,
    collision_geometry_get,
    draw_circle,
    draw_curve,
    draw_grid_axes,
    draw_grid_axes_box,
    draw_line,
    draw_rectangle,
    draw_robot_arm,
    draw_square,
    draw_tangent,
    draw_text,
    draw_triangle,
    draw_truss,
    SVG,
};